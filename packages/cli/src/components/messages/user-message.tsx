import { getMentionPattern } from "../input-bar";
import { EmptyBorder } from "../border";
import { useTheme } from "../../providers/theme";
import { Mode } from "@mantracode/database/enums";

type Props = {
    message: string;
    mode: Mode;
}

export function UserMessage({ message, mode }: Props) {
    const { colors } = useTheme();
    const parts: Array<{ text: string; isMention: boolean }> = [];
    let lastIndex = 0;
    const mentionPattern = getMentionPattern();
    let match;
    while ((match = mentionPattern.exec(message)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: message.slice(lastIndex, match.index), isMention: false });
        }
        parts.push({ text: match[0], isMention: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < message.length) {
        parts.push({ text: message.slice(lastIndex), isMention: false });
    }

    return (
        <box width={"100%"} alignItems="center">
            <box
                border={["left"]}
                borderColor={mode === Mode.PLAN ? colors.planMode : colors.primary}
                width={"100%"}
                customBorderChars={{
                    ...EmptyBorder,
                    vertical: "┃",
                    bottomLeft: "╹",
                }}
            >
                <box
                    justifyContent="center"
                    paddingX={2}
                    paddingY={1}
                    backgroundColor={colors.surface}
                    width={"100%"}
                >
                    <text>
                        {parts.length > 0
                            ? parts.map((part, i) =>
                                  part.isMention ? (
                                      <em key={i} fg={colors.primary}>{part.text}</em>
                                  ) : (
                                      part.text
                                  ),
                              )
                            : message}
                    </text>
                </box>
            </box>
        </box>
    )
}