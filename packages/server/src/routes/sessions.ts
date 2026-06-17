import { z } from "zod";
import { Hono } from "hono";
import * as Sentry from "@sentry/hono/bun";
import { zValidator } from "@hono/zod-validator";
import { db } from "@mantracode/database/client";
import { isSupportedChatModel } from "../lib/models";
// import { HTTPException } from "hono/http-exception";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { Role, Mode, MessageStatus } from "@mantracode/database/enums";
import { requireCreditsBalance } from "../middleware/require-credits-balance";

const createSessionSchema = z.object({
    title: z.string(),
    cwd: z.string().optional(),
    initialMessage: z
        .object({
            role: z.enum(Role),
            content: z.string(),
            mode: z.enum(Mode),
            model: z.string().refine(isSupportedChatModel, "Unsupported model"),

        }).optional(),
});

const createSessionValidator = zValidator("json", createSessionSchema, (result, c) => {
    if (!result.success) {
        Sentry.logger.warn("Session creation validation failed", {
            path: c.req.path,
            issues: result.error.issues.length,
        });

        return c.json({ error: "Invalid request body" }, 400);
    }
});

const app = new Hono<AuthenticatedEnv>()
    .get("/", async (c) => {
        const userId = c.get("userId");

        const sessions = await db.session.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                createdAt: true
            },
        });

        Sentry.logger.info("Listed sessions", {
            count: sessions.length,
        })

        return c.json(sessions);
    })
    .get("/:id", async (c) => {
        // await new Promise((r) => setTimeout(r, 5000));

        // throw new HTTPException(
        //     500, {message: "Mock error: session loading failed"}
        // );

        const userId = c.get("userId");
        const id = c.req.param("id");
        const session = await db.session.findUnique({
            where: { id, userId },
            include: {
                messages: { orderBy: { createdAt: "asc" } },
            },
        });

        if (!session) {
            Sentry.logger.warn("Session not found", {
                sessionId: id,
                userId: userId,
            });

            return c.json({ error: "Session not found" }, 404);
        }

        Sentry.logger.info("Loaded session", {
            sessionId: session.id,
            messageCount: session.messages.length,
        });

        return c.json(session);
    })
    .get("/:id/tokens", async (c) => {
        const userId = c.get("userId");
        const id = c.req.param("id");
        const session = await db.session.findUnique({
            where: { id, userId },
            select: { totalTokens: true },
        });
        if (!session) return c.json({ error: "Session not found" }, 404);
        return c.json(session);
    })
    .post("/", requireCreditsBalance, createSessionValidator, async (c) => {
        const userId = c.get("userId");
        const { initialMessage, ...data } = c.req.valid("json");

        const session = await db.session.create({
            data: {
                ...data,
                userId,
                ...(initialMessage && {
                    messages: {
                        create: {
                            role: initialMessage.role,
                            content: initialMessage.content,
                            mode: initialMessage.mode,
                            model: initialMessage.model,
                            status: MessageStatus.COMPLETE,
                            duration: 0,
                        },
                    },
                }),
            },
            include: { messages: true },
        });

        if (session.title === "New Session" && session.messages.length > 0) {
            const { nameSessionViaVertex: nameSession } = await import("./chat");
            const userQuery = session.messages[0]?.content;
            if (userQuery) {
                nameSession(session.id, userQuery);
            }
        }

        Sentry.logger.info("Created session", {
            sessionId: session.id,
            title: session.title,
            hasInitialMessage: session.messages.length > 0,
            cwd: session.cwd,
        });

        return c.json(session, 201);
    });

export default app;