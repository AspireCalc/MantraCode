import type { ReactNode } from "react"
import { MacOSScrollAccel, TextAttributes } from "@opentui/core";
import { InputBar } from "./input-bar";
import { Spinner } from "./spinner";
import { usePromptConfig } from "../providers/prompt-config";

function formatCompact(n: number): string {
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return Math.round(n / 1000) + "K";
}

type Props = {
    children?: ReactNode;
    onSubmit: (text: string) => void;
    inputDisabled?: boolean;
    loading?: boolean;
    interruptible?: boolean;
    totalTokens?: number;
    creditsUsed?: number;
    creditsTotal?: number;
};

const scrollAccel = new MacOSScrollAccel();

export function SessionShell({ children, onSubmit, inputDisabled = false, loading = false, interruptible = false, totalTokens = 0, creditsUsed = 0, creditsTotal = 0 }: Props) {

    const { mode } = usePromptConfig();

    return (
        <box
            flexDirection="column"
            flexGrow={1}
            width={"100%"}
            height={"100%"}
            paddingY={1}
            paddingX={2}
            gap={1}
        >
            <scrollbox flexGrow={1} width={"100%"} stickyScroll stickyStart="bottom" scrollAcceleration={scrollAccel}>
                <box gap={1}>{children}</box>
            </scrollbox>
            <box flexShrink={0}>
                <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
            </box>
            <box
                flexShrink={0}
                flexDirection="row"
                justifyContent="space-between"
                width={"100%"}
                height={1}
                gap={2}
                paddingLeft={1}
            >
                <box flexDirection="row" alignItems="center" gap={2}>
                    {loading ? (
                        <>
                            <Spinner mode={mode} />
                            {interruptible ? <text>esc to interrupt</text> : null}
                        </>
                    ) : null}
                </box>

                <box flexDirection="row" gap={1} flexShrink={0} marginLeft={"auto"}>
                    <text selectable={false}>{formatCompact(totalTokens)}</text>
                    <text selectable={false} attributes={TextAttributes.DIM}>tokens</text>
                    <text selectable={false} attributes={TextAttributes.DIM}>❯</text>
                    <text selectable={false}>{formatCompact(creditsUsed)}/{formatCompact(creditsTotal)}</text>
                    <text selectable={false} attributes={TextAttributes.DIM}>credits</text>
                </box>
            </box>
        </box>
    )

}