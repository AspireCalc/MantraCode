import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
import { TextAttributes } from "@opentui/core";

export function Home() {
    const navigate = useNavigate();

    const handleSubmit = useCallback((text: string) => {
        navigate("/sessions/new", { state: { message: text } });
    }, [navigate]);

    return (
        <box
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
            gap={2}
            position="relative"
            width="100%"
            height="100%"
        >
            <Header />
            <box width={"100%"} maxWidth={78} paddingX={2}>
                <InputBar onSubmit={handleSubmit} />
            </box>
            <box marginTop={-1} flexDirection="row" flexWrap="wrap" justifyContent="space-between" width={"100%"} maxWidth={78} paddingX={2}>
                <box flexDirection="row" gap={1}>
                    <text selectable={false} attributes={TextAttributes.BOLD}>enter</text>
                    <text selectable={false} attributes={TextAttributes.DIM}>new line</text>
                </box>
                <box flexDirection="row" gap={1}>
                    <text selectable={false} attributes={TextAttributes.BOLD}>shift + enter</text>
                    <text selectable={false} attributes={TextAttributes.DIM}>submit</text>
                </box>
            </box>
        </box>
    )
}