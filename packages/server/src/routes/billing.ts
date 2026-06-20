import { Hono } from "hono";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { createCheckoutUrl, createCustomerPortalUrl, getCreditsSummary } from "../lib/polar";
import { clerkClient } from "../lib/auth";

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

const app = new Hono<AuthenticatedEnv>()
    .post("/checkout", async (c) => {
        const userId = c.get("userId");
        return c.json({
            url: await createCheckoutUrl({ customerExternalId: userId, requestUrl: c.req.url }),
        });
    })
    .post("/portal", async (c) => {
        const userId = c.get("userId");
        return c.json({
            url: await createCustomerPortalUrl({ customerExternalId: userId, requestUrl: c.req.url }),
        });
    })
    .get("/credits", async (c) => {
        const userId = c.get("userId");
        const credits = await getCreditsSummary(userId);
        return c.json(credits);
    })
    .get("/me", async (c) => {
        const userId = c.get("userId");
        if (!userId) {
            return c.json({ error: "Not authenticated" }, 401);
        }
        const [user, credits] = await Promise.all([
            clerkClient.users.getUser(userId).catch(() => null),
            getCreditsSummary(userId).catch(() => ({ used: 0, total: 0 })),
        ]);
        return c.json({
            user: user ? {
                id: user.id,
                email: user.emailAddresses[0]?.emailAddress ?? null,
                name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
                username: user.username,
                imageUrl: user.imageUrl,
                createdAt: user.createdAt,
                lastSignInAt: user.lastSignInAt,
                lastActiveAt: user.lastActiveAt,
                twoFactorEnabled: user.twoFactorEnabled,
                passwordEnabled: user.passwordEnabled,
                primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
            } : null,
            credits,
        });
    })
    .get("/success", (c) => c.html(htmlPage("Purchase Successful!", "<p>Your credits have been added to your account. You are now ready to use MantraCode.</p>", true)));

export default app;