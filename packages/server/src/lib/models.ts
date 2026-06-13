// import { anthropic } from "@ai-sdk/anthropic";
// import { openai } from "@ai-sdk/openai";
// import { google } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
// import { xai } from "@ai-sdk/xai";

import { findSupportedChatModel } from "@mantracode/shared";
import type { SupportedChatModel, SupportedChatModelId, SupportedProvider } from "@mantracode/shared";

import type { LanguageModel } from "ai";

const vertexProvider = createVertex({
    project: process.env.GOOGLE_VERTEX_PROJECT,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "global",
});

// type AnthropicModelId = Extract<SupportedChatModel, { provider: "anthropic" }>["id"];
// type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];
// type GoogleModelId = Extract<SupportedChatModel, { provider: "google" }>["id"];
type GoogleVertexModelId = Extract<SupportedChatModel, { provider: "google-vertex" }>["id"];
// type XAIModelId = Extract<SupportedChatModel, { provider: "xai" }>["id"];

export type ResolvedModel = {
    model: LanguageModel;
    provider: SupportedProvider;
    modelId: SupportedChatModelId;
}

function assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

// function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
//     return {
//         model: anthropic(modelId),
//         provider: "anthropic",
//         modelId,
//     };
// }

// function resolveOpenAIModel(modelId: OpenAIModelId): ResolvedModel {
//     return {
//         model: openai(modelId),
//         provider: "openai",
//         modelId,
//     };
// }

// function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
//     return {
//         model: google(modelId),
//         provider: "google",
//         modelId,
//     };
// }

function resolveGoogleVertexModel(modelId: GoogleVertexModelId): ResolvedModel {
    return {
        model: vertexProvider.languageModel(modelId),
        provider: "google-vertex",
        modelId,
    };
}

// function resolveXAIModel(modelId: XAIModelId): ResolvedModel {
//     return {
//         model: xai(modelId),
//         provider: "xai",
//         modelId,
//     };
// }

function resolveSupportedChatModel(model: SupportedChatModel): ResolvedModel {
    const provider = model.provider;

    switch (provider) {
        // case "anthropic":
        //     return resolveAnthropicModel(model.id);
        // case "openai":
        //     return resolveOpenAIModel(model.id);
        // case "google":
        //     return resolveGoogleModel(model.id);
        case "google-vertex":
            return resolveGoogleVertexModel(model.id);
        // case "xai":
        //     return resolveXAIModel(model.id);
        default:
            return assertUnsupportedProvider(provider);
    }
};


export function isSupportedChatModel(modelId: string): modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId) !== null;
}

export function resolveChatModel(modelId: string): ResolvedModel {
    const model = findSupportedChatModel(modelId);
    if (!model) {
      throw new Error(`Unsupported model: ${modelId}`);
    }

    return resolveSupportedChatModel(model);
}