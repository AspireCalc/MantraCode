import { Text, TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";
import { Mode } from "@mantracode/database/enums";

export function StatusBar() {
    const { colors } = useTheme();
    const { mode, model } = usePromptConfig();

    return (
        <box flexDirection="row" gap={1}>

            <text fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>
                {mode === Mode.PLAN ? "Plan" : "Build"}
            </text>

            <text attributes={TextAttributes.BOLD} fg={colors.dimSeparator}>
                ❯
            </text>
            <text>{model}</text>
        </box>
    )
}