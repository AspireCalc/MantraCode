export type ModelPricing = {
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
};


export type SupportedProvider = "anthropic" | "openai" | "google" | "google-vertex" | "xai";


type SupportedChatModelDefinition = {
    id: string;
    provider: SupportedProvider;
    pricing: ModelPricing;
}


export const SUPPORTED_CHAT_MODELS = [
    {
        id: "gemini-3.1-pro-preview",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 2.0,
            outputUsdPerMillionTokens: 12.0,
        },
    },
    {
        id: "gemini-3.5-flash",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 1.5,
            outputUsdPerMillionTokens: 9.0,
        },
    },
    {
        id: "gemini-3.1-flash-lite",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 0.25,
            outputUsdPerMillionTokens: 1.5,
        },
    },
    {
        id: "gemini-2.5-pro",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 1.25,
            outputUsdPerMillionTokens: 10.0,
        },
    },
    {
        id: "gemini-2.5-flash",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 0.3,
            outputUsdPerMillionTokens: 2.5,
        },
    },
    {
        id: "gemini-2.5-flash-lite",
        provider: "google-vertex",
        pricing: {
            inputUsdPerMillionTokens: 0.1,
            outputUsdPerMillionTokens: 0.4,
        },
    },
] as const satisfies readonly SupportedChatModelDefinition[];


export type SupportedChatModel = (typeof SUPPORTED_CHAT_MODELS)[number];
export type SupportedChatModelId = SupportedChatModel["id"];


export function findSupportedChatModel(modelId: string) {
    return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId);
}


export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId = "gemini-3.5-flash";