import { useTheme } from "../providers/theme";

export function Header() {
    const { colors } = useTheme();

    return (
        <box justifyContent="center" alignItems="center">
            <box flexDirection="row" justifyContent="center" gap={0.5} alignItems="center">
                <ascii-font font="tiny" text="Mantra" color="#E5E5EA" />
                <ascii-font font="tiny" text="Code" color={colors.primary} />
            </box>
        </box>
    )
};