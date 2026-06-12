import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
// import { HTTPException } from "hono/http-exception";
import * as Sentry from "@sentry/hono/bun";
import { z } from "zod";
import { findSupportedChatModel } from "@mantracode/shared";
import { db } from "@mantracode/database/client";
import { Role, Mode, MessageStatus } from "@mantracode/database/enums";

const createSessionSchema = z.object({
    title: z.string(),
    cwd: z.string().optional(),
    initialMessage: z
        .object({
            role: z.enum(Role),
            content: z.string(),
            mode: z.enum(Mode),
            model: z.string().refine((id) => !!findSupportedChatModel(id), "Unsupported model"),

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

const app = new Hono()
    .get("/", async (c) => {
        const sessions = await db.session.findMany({
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

        const id = c.req.param("id");
        const session = await db.session.findUnique({
            where: { id },
            include: {
                messages: { orderBy: { createdAt: "asc" } },
            },
        });

        if (!session) {
            Sentry.logger.warn("Session not found", {
                sessionId: id,
                userId: "mock-user",
            });

            return c.json({ error: "Session not found" }, 404);
        }

        Sentry.logger.info("Loaded session", {
            sessionId: session.id,
            messageCount: session.messages.length,
        });

        return c.json(session);
    })
    .post("/", createSessionValidator, async (c) => {
        const { initialMessage, ...data } = c.req.valid("json");

        const session = await db.session.create({
            data: {
                ...data,
                userId: "mock-user",
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

        Sentry.logger.info("Created session", {
            sessionId: session.id,
            title: session.title,
            hasInitialMessage: session.messages.length > 0,
            cwd: session.cwd,
        });

        return c.json(session, 201);
    });

export default app;