import type { Mode } from "@aspirenx/mantracode-database/enums";
import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import type { SupportedChatModelId } from "@aspirenx/mantracode-shared";

export type CommandContext = {
    exit: () => void;
    toast: ToastContextValue;
    dialog: DialogContextValue;
    navigate: (path: string, options?: { state?: unknown; replace?: boolean }) => void;
    pathname: string;
    mode: Mode;
    setMode: (mode: Mode) => void;
    model: SupportedChatModelId;
    setModel: (model: SupportedChatModelId) => void;
};

export type Command = {
    name: string;
    description: string;
    value: string;
    action?: (ctx: CommandContext) => void | Promise<void>;
};