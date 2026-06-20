import open from "open";
import { saveAuth } from "./auth";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

type OAuthState = {
    nonce: string;
    port: number;
}

function toBase64Url(input: Uint8Array | string) {
    return Buffer.from(input).toString("base64url");
}

async function createPkceChallenge(verifier: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return toBase64Url(new Uint8Array(digest));
}

function encodeState(state: OAuthState) {
    return toBase64Url(JSON.stringify(state));
}

function decodeState(state: string) {
    const [encoded] = state.split(".");
    if (!encoded) {
        throw new Error("Invalid state");
    }

    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as OAuthState;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

const ASCII_BANNER = `┌─────────────────────────────────────┐
│          MantraCode CLI              │
└─────────────────────────────────────┘`;

function htmlPage(title: string, body: string, success: boolean): string {
    const fg = success ? "#059669" : "#dc2626";
    const accentBg = success ? "#ecfdf5" : "#fef2f2";
    const accentBorder = success ? "#a7f3d0" : "#fecaca";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    font-family: 'Courier New', 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    background: #fafafa;
    color: #1e293b;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    margin: 0;
    padding: 2rem;
    text-align: center;
  }
  .logo {
    font-size: 13px;
    line-height: 1.15;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 2.5rem;
    white-space: pre;
  }
  .status {
    background: ${accentBg};
    border: 2px solid ${accentBorder};
    border-radius: 0;
    padding: 1.25rem 2rem;
    max-width: 540px;
    width: 100%;
    animation: fadeIn 0.35s ease-out;
  }
  h1 {
    font-size: 1.25rem;
    font-weight: 700;
    color: ${fg};
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  p {
    font-size: 0.875rem;
    color: #475569;
    margin: 0;
    line-height: 1.6;
  }
  .detail {
    font-size: 0.8125rem;
    background: #f1f5f9;
    padding: 0.75rem 1rem;
    margin-top: 0.75rem;
    word-break: break-word;
    color: ${fg};
    border-left: 3px solid ${fg};
  }
  .footer {
    margin-top: 2rem;
    font-size: 0.8125rem;
    color: #94a3b8;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
<div class="logo">${ASCII_BANNER}</div>
<div class="status">
  <h1>${title}</h1>
  ${body}
</div>
<div class="footer">Close this tab and return to the terminal.</div>
<script>
  ${success ? 'setTimeout(() => window.close(), 2000);' : ''}
</script>
</body>
</html>`;
}

export async function performLogin() {
    const clerkFrontendAPI = process.env.CLERK_FRONTEND_API;
    const clientId = process.env.CLERK_OAUTH_CLIENT_ID;
    const apiUrl = process.env.API_URL ?? "http://localhost:3000";

    if (!clerkFrontendAPI) throw new Error("CLERK_FRONTEND_API not set");
    if (!clientId) throw new Error("CLERK_OAUTH_CLIENT_ID not set");

    const nonce = crypto.randomUUID();
    const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const codeChallenge = await createPkceChallenge(codeVerifier);

    let settled = false;

    return new Promise<{ token: string }>((resolve, reject) => {
        const server = Bun.serve({
            port: 0,
            async fetch(req) {
                const url = new URL(req.url);

                if (url.pathname !== "/callback") {
                    return new Response(htmlPage("Not Found", "<p>The callback endpoint was not found.</p>", false), { status: 404, headers: { "Content-Type": "text/html" } });
                }

                const error = url.searchParams.get("error");
                if (error) {
                    const msg = url.searchParams.get("error_description") ?? error;
                    settled = true;
                    reject(new Error(msg));
                    setTimeout(() => server.stop(), 500);
                    return new Response(htmlPage("Authentication Failed", `<p>The OAuth provider returned an error.</p><div class="detail">${msg}</div>`, false), { status: 400, headers: { "Content-Type": "text/html" } });
                }

                const code = url.searchParams.get("code");
                const state = url.searchParams.get("state");
                if (!code || !state) {
                    settled = true;
                    reject(new Error("Missing code or state"));
                    setTimeout(() => server.stop(), 500);
                    return new Response(htmlPage("Bad Request", "<p>The callback request was missing required parameters.</p>", false), { status: 400, headers: { "Content-Type": "text/html" } });
                }

                try {
                    const payload = decodeState(state);
                    if (payload.nonce !== nonce) {
                        throw new Error("State mismatch");
                    }
                } catch (err) {
                    settled = true;
                    reject(err);
                    setTimeout(() => server.stop(), 500);
                    return new Response(htmlPage("Invalid State", `<p>${getErrorMessage(err)}</p>`, false), { status: 400, headers: { "Content-Type": "text/html" } });
                }

                try {
                    const redirectUri = `${apiUrl}/auth/callback`;

                    const tokenRes = await fetch(`${clerkFrontendAPI}/oauth/token`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams({
                            grant_type: "authorization_code",
                            code,
                            redirect_uri: redirectUri,
                            client_id: clientId,
                            code_verifier: codeVerifier,
                        }),
                    });

                    if (!tokenRes.ok) {
                        const details = await tokenRes.text();
                        throw new Error(details || "Failed to exchange authorization code");
                    }

                    const tokenData = (await tokenRes.json()) as { access_token: string };

                    settled = true;
                    saveAuth({ token: tokenData.access_token });
                    resolve({ token: tokenData.access_token });
                    setTimeout(() => server.stop(), 500);
                    return new Response(htmlPage("Authenticated!", "<p>Your authentication was successful. You are now signed in to MantraCode CLI.</p>", true), { headers: { "Content-Type": "text/html" } });
                } catch (err) {
                    settled = true;
                    reject(err);
                    const message = getErrorMessage(err);
                    setTimeout(() => server.stop(), 500);
                    return new Response(htmlPage("Authentication Failed", `<p>Failed to exchange the authorization code for a token.</p><div class="detail">${message}</div>`, false), { status: 400, headers: { "Content-Type": "text/html" } });
                }
            },
        });

        const port = server.port;
        if (typeof port !== "number") {
            server.stop();
            reject(new Error("Failed to start callback server"));
            return;
        }

        const state = encodeState({ port, nonce });
        const redirectUri = `${apiUrl}/auth/callback`;

        const authorizeUrl = new URL(`${clerkFrontendAPI}/oauth/authorize`);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("scope", "openid email profile");
        authorizeUrl.searchParams.set("state", state);
        authorizeUrl.searchParams.set("prompt", "login");
        authorizeUrl.searchParams.set("code_challenge", codeChallenge);
        authorizeUrl.searchParams.set("code_challenge_method", "S256");

        open(authorizeUrl.toString()).catch((err) => {
            if (settled) return;
            settled = true;
            server.stop();
            reject(new Error(`Failed to open browser: ${getErrorMessage(err)}`));
        });

        setTimeout(() => {
            if (!settled) {
                settled = true;
                server.stop();
                reject(new Error("Login timed out"));
            }
        }, LOGIN_TIMEOUT_MS)
    });
}