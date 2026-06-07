import { Text, TextAttributes } from "@opentui/core";

export function StatusBar() {
    return (
        <box flexDirection="row" gap={1}>
            <text fg={"#FF651D"}>Build</text>
            <text attributes={TextAttributes.BOLD} fg={"gray"}>
                ❯
            </text>
            <text>opus-4-6</text>
        </box>
    )
}