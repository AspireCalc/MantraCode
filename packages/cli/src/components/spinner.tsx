import "opentui-spinner/react";
import { useTheme } from "../providers/theme";
import { Mode } from "@mantracode/database/enums";

type Props = {
    mode?: Mode;
}

export function Spinner({ mode = Mode.BUILD }: Props) {
    const { colors } = useTheme();

    return (
        <spinner name="aesthetic" color={mode === Mode.PLAN ? colors.planMode : colors.primary} />
    )
}