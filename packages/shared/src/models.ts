export type ModelPricing = {
    inputInrPerMillionTokens: number;
    outputInrPerMillionTokens: number;
};

export type SupportedProvider =
    | "anthropic"
    | "openai"
    | "google"
    | "google-vertex"
    | "xai";

type SupportedChatModelDefinition = {
    id: string;
    provider: SupportedProvider;
    pricing: ModelPricing;
};

export const SUPPORTED_CHAT_MODELS = [
    {
        id: "gemini-3.1-pro-preview",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 190,
            outputInrPerMillionTokens: 1140,
        },
    },
    {
        id: "gemini-3.5-flash",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 142.5,
            outputInrPerMillionTokens: 855,
        },
    },
    {
        id: "gemini-3.1-flash-lite",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 23.75,
            outputInrPerMillionTokens: 142.5,
        },
    },
    {
        id: "gemini-2.5-pro",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 118.75,
            outputInrPerMillionTokens: 950,
        },
    },
    {
        id: "gemini-2.5-flash",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 28.5,
            outputInrPerMillionTokens: 237.5,
        },
    },
    {
        id: "gemini-2.5-flash-lite",
        provider: "google-vertex",
        pricing: {
            inputInrPerMillionTokens: 9.5,
            outputInrPerMillionTokens: 38,
        },
    },
] as const satisfies readonly SupportedChatModelDefinition[];

export type SupportedChatModel = (typeof SUPPORTED_CHAT_MODELS)[number];
export type SupportedChatModelId = SupportedChatModel["id"];

export function findSupportedChatModel(modelId: string) {
    return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId);
}

export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId = "gemini-3.5-flash";