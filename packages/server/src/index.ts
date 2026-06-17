import { writeFileSync, mkdirSync } from "fs";
import { Hono } from 'hono';
import chat from "./routes/chat";
import auth from "./routes/auth";
import billing from "./routes/billing";
import sessions from "./routes/sessions";
import { sentry } from '@sentry/hono/bun';
import * as Sentry from "@sentry/hono/bun";
import { HTTPException } from 'hono/http-exception';
import { requireAuth } from './middleware/require-auth';

const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (saKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const dir = "/tmp/gcp-keys";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/service-account.json`, saKey);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = `${dir}/service-account.json`;
}

const app = new Hono();

app.use(
    sentry(app, {
        dsn: "https://d878797cf875ca42b29334c0e2520f42@o4511552226263040.ingest.us.sentry.io/4511552239828992",
        tracesSampleRate: 1.0,
        enableLogs: true,
        sendDefaultPii: true,
    }),
);

app.get("/debug-sentry", () => {
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
        action: 'test_error_endpoint',
    });
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
    throw new Error("My first Sentry error!");
});

app.onError((error, c) => {
    if (error instanceof HTTPException) {
        Sentry.logger.warn("Handled HTPP error", {
            status: error.status,
            message: error.message || "Request failed",
            path: c.req.path,
            method: c.req.method,
        });

        return c.json({
            error: error.message || "Request failed"
        }, error.status);
    };

    Sentry.logger.error("Unhandled server error", {
        path: c.req.path,
        method: c.req.method,
        message: error instanceof Error ? error.message : "Unknown error",
    });

    return c.json({
        error: "Internal server error"
    }, 500);
});

app.use("/sessions/*", requireAuth);
app.use("/chat/*", requireAuth);
app.use("/billing/checkout", requireAuth);
app.use("/billing/credits", requireAuth);
app.use("/billing/portal", requireAuth);

const routes = app
    .route("/auth", auth)
    .route("/billing", billing)
    .route("/sessions", sessions)
    .route("/chat", chat);

export type AppType = typeof routes;

export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };