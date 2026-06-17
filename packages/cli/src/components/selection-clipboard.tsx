import { useEffect, useRef } from "react";
import { useRenderer } from "@opentui/react";
import { useToast } from "../providers/toast";

export function SelectionClipboard() {
    const renderer = useRenderer();
    const toast = useToast();
    const lastCopiedRef = useRef<string>("");

    useEffect(() => {
        const handler = () => {
            const selection = renderer.getSelection();
            if (!selection) return;

            const text = selection.getSelectedText();
            if (text && text.trim() && text !== lastCopiedRef.current) {
                renderer.copyToClipboardOSC52(text);
                toast.show({ message: "Copied to clipboard" });
                lastCopiedRef.current = text;
            }
        };

        renderer.on("selection", handler);
        return () => {
            renderer.off("selection", handler);
        };
    }, [renderer, toast]);

    return null;
}
