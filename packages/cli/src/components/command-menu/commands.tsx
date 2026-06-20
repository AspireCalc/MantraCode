import type { Command } from "./types";
import { clearAuth } from "../../lib/auth";
import { performLogin } from "../../lib/oauth";
import { SUPPORTED_CHAT_MODELS } from "@mantracode/shared";
import { openBillingPortal, openUpgradeCheckout } from "../../lib/upgrade";
import { AgentsDialogContent, ModelsDialogContent, SessionDialogContent, ThemeDialogContent } from "../dialogs";

export const COMMANDS: Command[] = [
    {
        name: "new",
        description: "Start a new conversation",
        value: "/new",
        action: (ctx) => {
            ctx.navigate("/");
        },
    },
    {
        name: "reload",
        description: "Reload the session",
        value: "/reload",
        action: (ctx) => {
            ctx.navigate(ctx.pathname, { state: { _reload: Date.now() } });
        },
    },
    {
        name: "agents",
        description: "Switch agents",
        value: "/agents",
        action: (ctx) => {
            ctx.dialog.open({
                title: "Select Agent",
                children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />
            })
        },
    },
    {
        name: "models",
        description: "Select AI model for generation",
        value: "/models",
        action: (ctx) => {
            ctx.dialog.open({
                title: "Select Model",
                children: <ModelsDialogContent models={SUPPORTED_CHAT_MODELS.map((model) => model.id)} onSelectModel={ctx.setModel} currentModel={ctx.model} />
            })
        },
    },
    {
        name: "sessions",
        description: "Browse past sessions",
        value: "/sessions",
        action: (ctx) => {
            ctx.dialog.open({
                title: "Session",
                children: <SessionDialogContent />
            })
        },
    },
    {
        name: "theme",
        description: "Change color theme",
        value: "/theme",
        action: (ctx) => {
            ctx.dialog.open({
                title: "Select Theme",
                children: <ThemeDialogContent />
            })
        },
    },
    {
        name: "login",
        description: "Sign in with your browser",
        value: "/login",
        action: async (ctx) => {
            ctx.toast.show({ message: "Opening browser to sign in..." })

            try {
                await performLogin();
                ctx.toast.show({ variant: "success", message: "Successfully logged in.", duration: 8000 });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Login failed or timed out";

                ctx.toast.show({ variant: "error", message });
            }
        },
    },
    {
        name: "logout",
        description: "Sign out of your account",
        value: "/logout",
        action: (ctx) => {
            clearAuth();
            ctx.toast.show({ message: "Signed out", variant: "success" })
        },
    },
    {
        name: "upgrade",
        description: "Buy more credits",
        value: "/upgrade",
        action: async (ctx) => {
            ctx.toast.show({ message: "Opening credits checkout..." });

            try {
                await openUpgradeCheckout();
                ctx.toast.show({
                    variant: "success",
                    message: "Checkout opened in browser"
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to open checkout";
                ctx.toast.show({ variant: "error", message });
            }
        },
    },
    {
        name: "profile",
        description: "View your account profile and credits",
        value: "/profile",
        action: (ctx) => {
            ctx.navigate("/profile");
        },
    },
    {
        name: "usage",
        description: "Open billing portal in your browser",
        value: "/usage",
        action: async (ctx) => {
            ctx.toast.show({ message: "Opening billing portal..." });

            try {
                await openBillingPortal();
                ctx.toast.show({
                    variant: "success",
                    message: "Billing portal opened in browser"
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to open billing portal";
                ctx.toast.show({ variant: "error", message });
            }
        },
    },
    {
        name: "exit",
        description: "Quit the application",
        value: "/exit",
        action: (ctx) => {
            ctx.exit();
        }
    },
]