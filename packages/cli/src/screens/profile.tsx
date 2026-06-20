import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "../lib/api-client";
import { clearAuth } from "../lib/auth";
import { useTheme } from "../providers/theme";
import { useToast } from "../providers/toast";
import { openBillingPortal } from "../lib/upgrade";
import { TextAttributes } from "@opentui/core";

type ProfileData = {
    user: {
        id: string;
        email: string | null;
        name: string | null;
        username: string | null;
        imageUrl: string;
        createdAt: number;
        lastSignInAt: number | null;
        lastActiveAt: number | null;
        twoFactorEnabled: boolean;
        passwordEnabled: boolean;
        primaryEmailAddress: string | null;
    } | null;
    credits: {
        used: number;
        total: number;
    };
};

function formatDate(ts: number | null): string {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatIndian(n: number): string {
    const s = String(Math.floor(n));
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    if (!rest) return last3;
    const groups: string[] = [];
    let r = rest;
    while (r.length > 0) {
        groups.push(r.slice(-2));
        r = r.slice(0, -2);
    }
    return groups.reverse().join(",") + "," + last3;
}

function formatCompact(n: number): string {
    if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1).replace(/\.0$/, "") + "Cr";
    if (n >= 1_00_000) return (n / 1_00_000).toFixed(1).replace(/\.0$/, "") + "L";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
}

export function Profile() {
    const navigate = useNavigate();
    const { colors } = useTheme();
    const toast = useToast();
    const [data, setData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const fetch = async () => {
            try {
                const res = await apiClient.billing.me.$get({ signal: controller.signal });
                if (res.ok) {
                    const json: ProfileData = await res.json();
                    setData(json);
                }
            } catch { }
            setLoading(false);
        };
        fetch();
        return () => controller.abort();
    }, []);

    const handleLogout = useCallback(() => {
        clearAuth();
        toast.show({ message: "Signed out", variant: "success" });
        navigate("/");
    }, [navigate, toast]);

    const handlePortal = useCallback(async () => {
        toast.show({ message: "Opening billing portal..." });
        try {
            await openBillingPortal();
            toast.show({ variant: "success", message: "Billing portal opened in browser" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to open billing portal";
            toast.show({ variant: "error", message });
        }
    }, [toast]);

    const remaining = data ? Math.max(0, data.credits.total - data.credits.used) : 0;

    return (
        <box
            flexDirection="column"
            flexGrow={1}
            width="100%"
            height="100%"
            paddingY={1}
            paddingX={2}
            gap={1}
        >
            <box
                border={true}
                borderColor={colors.primary}
                width="100%"
                flexDirection="column"
            >
                <box
                    flexDirection="row"
                    alignItems="center"
                    height={1}
                    paddingX={2}
                >
                    <box onMouseDown={() => navigate(-1)}>
                        <text
                            attributes={TextAttributes.BOLD}
                            fg={colors.primary}
                            selectable={false}
                        >
                            {" [back]"}
                        </text>
                    </box>
                    <box flexGrow={1} />
                    <text attributes={TextAttributes.BOLD} selectable={false}>
                        Profile
                    </text>
                    <box flexGrow={1} />
                    <box width={6} />
                </box>
            </box>

            {loading ? (
                <box flexGrow={1} alignItems="center" justifyContent="center">
                    <box flexDirection="column" gap={1} alignItems="center">
                        <text attributes={TextAttributes.DIM} selectable={false}>
                            Loading profile...
                        </text>
                    </box>
                </box>
            ) : data ? (
                <box flexDirection="column" gap={1} flexGrow={1}>
                    <box
                        border={true}
                        borderColor={colors.dimSeparator}
                        flexDirection="column"
                        paddingX={2}
                        paddingY={1}
                        gap={1}
                    >
                        <text attributes={TextAttributes.BOLD} fg={colors.primary} selectable={false}>
                            {"  Account"}
                        </text>
                        <box height={1} paddingX={0}>
                            <text fg={colors.dimSeparator} attributes={TextAttributes.DIM} selectable={false}>
                                {"  "}{"─".repeat(76)}
                            </text>
                        </box>
                        <box flexDirection="column" gap={0} paddingX={2}>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Email</text>
                                <text selectable={false}>{data.user?.email ?? "—"}</text>
                            </box>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Name</text>
                                <text selectable={false}>{data.user?.name ?? "—"}</text>
                            </box>
                            {data.user?.username && (
                                <box flexDirection="row" gap={2} height={1}>
                                    <text fg={colors.dimSeparator} selectable={false} width={16}>Username</text>
                                    <text selectable={false}>{data.user.username}</text>
                                </box>
                            )}
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Joined</text>
                                <text selectable={false}>{data.user ? formatDate(data.user.createdAt) : "—"}</text>
                            </box>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Last Sign In</text>
                                <text selectable={false}>{data.user ? formatDate(data.user.lastSignInAt) : "—"}</text>
                            </box>
                            <box height={1} />
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>2FA</text>
                                <text
                                    fg={data.user?.twoFactorEnabled ? colors.success : colors.error}
                                    attributes={TextAttributes.BOLD}
                                    selectable={false}
                                >
                                    {data.user?.twoFactorEnabled ? "Enabled" : "Disabled"}
                                </text>
                            </box>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Password</text>
                                <text
                                    fg={data.user?.passwordEnabled ? colors.success : colors.dimSeparator}
                                    selectable={false}
                                >
                                    {data.user?.passwordEnabled ? "Set" : "Not set"}
                                </text>
                            </box>
                        </box>
                    </box>

                    <box
                        border={true}
                        borderColor={colors.dimSeparator}
                        flexDirection="column"
                        paddingX={2}
                        paddingY={1}
                        gap={1}
                    >
                        <text attributes={TextAttributes.BOLD} fg={colors.primary} selectable={false}>
                            {"  Credits"}
                        </text>
                        <box height={1} paddingX={0}>
                            <text fg={colors.dimSeparator} attributes={TextAttributes.DIM} selectable={false}>
                                {"  "}{"─".repeat(76)}
                            </text>
                        </box>
                        <box flexDirection="column" gap={0} paddingX={2}>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Used</text>
                                <text selectable={false}>
                                    {formatIndian(data.credits.used)} ({formatCompact(data.credits.used)})
                                </text>
                            </box>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Total Purchased</text>
                                <text selectable={false}>
                                    {formatIndian(data.credits.total)} ({formatCompact(data.credits.total)})
                                </text>
                            </box>
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.dimSeparator} selectable={false} width={16}>Remaining</text>
                                <text
                                    fg={remaining > 0 ? colors.success : colors.error}
                                    attributes={TextAttributes.BOLD}
                                    selectable={false}
                                >
                                    {formatIndian(remaining)} ({formatCompact(remaining)})
                                </text>
                            </box>
                            <box height={1} />
                            <box flexDirection="row" gap={2} height={1}>
                                <text fg={colors.primary} selectable={false} attributes={TextAttributes.BOLD}>
                                    {"  "}
                                </text>
                                <box onMouseDown={handlePortal}>
                                    <text
                                        fg={colors.primary}
                                        attributes={TextAttributes.BOLD}
                                        selectable={false}
                                    >
                                        {"  Open Billing Portal"}
                                    </text>
                                </box>
                            </box>
                        </box>
                    </box>

                    <box flexDirection="column" gap={1} paddingTop={1}>
                        <box
                            flexDirection="row"
                            justifyContent="center"
                            gap={2}
                            paddingY={1}
                        >
                            <box onMouseDown={handleLogout}>
                                <box
                                    border={true}
                                    borderColor={colors.error}
                                    paddingX={3}
                                    paddingY={0}
                                >
                                    <text
                                        fg={colors.error}
                                        attributes={TextAttributes.BOLD}
                                        selectable={false}
                                    >
                                        Logout
                                    </text>
                                </box>
                            </box>
                        </box>
                    </box>
                </box>
            ) : (
                <box flexGrow={1} alignItems="center" justifyContent="center">
                    <box flexDirection="column" gap={1} alignItems="center">
                        <text fg={colors.error} attributes={TextAttributes.BOLD} selectable={false}>
                            Failed to load profile
                        </text>
                        <text attributes={TextAttributes.DIM} selectable={false}>
                            Run /login to sign in
                        </text>
                    </box>
                </box>
            )}
        </box>
    );
}
