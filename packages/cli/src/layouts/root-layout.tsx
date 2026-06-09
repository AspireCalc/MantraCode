import { Outlet } from "react-router";
import { ThemeProvider } from "../providers/theme";
import { ToastProvider } from "../providers/toast";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { DialogProvider } from "../providers/dialog";
import { ThemedRoot } from "./themed-root";

export function RootLayout() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <KeyboardLayerProvider>
                    <DialogProvider>
                        <ThemedRoot>
                            <Outlet />
                        </ThemedRoot>
                    </DialogProvider>
                </KeyboardLayerProvider>
            </ToastProvider>
        </ThemeProvider>
    )
}