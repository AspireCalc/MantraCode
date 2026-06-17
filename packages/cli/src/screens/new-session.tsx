import { z } from "zod";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { Mode } from "@mantracode/database/enums";
import { useEffect, useMemo, useRef } from "react";
import { UserMessage } from "../components/messages";
import { getErrorMessage } from "../lib/https-errors";
import { useLocation, useNavigate } from "react-router";
import { SessionShell } from "../components/session-shell";

const newSessionStateSchema = z.object({
    message: z.string(),
    mode: z.enum(Mode),
    model: z.string(),
});

export function NewSession() {
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const hasStartedRef = useRef(false);

    const state = useMemo(() => {
        const parsed = newSessionStateSchema.safeParse(location.state);

        return parsed.success ? parsed.data : null;
    }, [location.state]);

    useEffect(() => {
        if (!state) {
            navigate("/", { replace: true });
        }
    }, [state, navigate]);

    useEffect(() => {
        if (!state || hasStartedRef.current) return;

        hasStartedRef.current = true;

        let ignore = false;

        const createSession = async () => {
            try {
                const res = await apiClient.sessions.$post({
                    json: {
                        title: "New Session",
                        cwd: process.cwd(),
                        initialMessage: {
                            role: "USER",
                            content: state.message,
                            mode: state.mode,
                            model: state.model,
                        },
                    }
                });

                if (ignore) return;
                if (!res.ok) {
                    throw new Error(await getErrorMessage(res));
                }

                const session = await res.json();

                navigate(`/sessions/${session.id}`, { replace: true, state: { session } });
            } catch (error) {
                if (ignore) return;
                toast.show({
                    variant: "error",
                    message: error instanceof Error ? error.message : "Failed to create session",
                });
                navigate("/", { replace: true });
            }
        };

        createSession();

        return () => {
            ignore = true;
        };
    }, [state, navigate, toast]);

    if (!state) return null;

    return (
        <SessionShell onSubmit={() => { }} inputDisabled loading>
            <UserMessage message={state.message} mode={state.mode} />
        </SessionShell>
    )
}