import { createVertex } from "@ai-sdk/google-vertex";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";

import { findSupportedChatModel } from "@mantracode/shared";
import type {
    SupportedChatModel,
    SupportedChatModelId,
    SupportedProvider,
} from "@mantracode/shared";

import type { LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";

const vertexProvider = createVertex({
    project: process.env.GOOGLE_VERTEX_PROJECT,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "global",
});

const vertexAnthropicProvider = createVertexAnthropic({
    project: process.env.GOOGLE_VERTEX_PROJECT,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
});

type GoogleVertexModelId = Extract<SupportedChatModel, { provider: "google-vertex" }>["id"];

export type ResolvedModel = {
    model: LanguageModel;
    provider: SupportedProvider;
    modelId: SupportedChatModelId;
    providerOptions?: ProviderOptions;
};

const GOOGLE_VERTEX_PROVIDER_OPTIONS: Partial<Record<GoogleVertexModelId, ProviderOptions>> = {
    "gemini-3.1-pro-preview": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingLevel: "high",
            },
            streamFunctionCallArguments: true,
        },
    },
    "gemini-3.5-flash": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingLevel: "high",
            },
            streamFunctionCallArguments: true,
        },
    },
    "gemini-3.1-flash-lite": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingLevel: "medium",
            },
            streamFunctionCallArguments: true,
        },
    },
    "gemini-2.5-pro": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 2048,
            },
        },
    },
    "gemini-2.5-flash": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 2048,
            },
        },
    },
    "gemini-2.5-flash-lite": {
        vertex: {
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 1024,
            },
        },
    },
};

function assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

const CLAUDE_MODEL_PREFIXES = ["claude-"] as const;

function isClaudeModel(modelId: string): boolean {
    const lowerModelId = modelId.toLowerCase();
    return CLAUDE_MODEL_PREFIXES.some((prefix) => lowerModelId.startsWith(prefix));
}

function resolveGoogleVertexModel(modelId: GoogleVertexModelId): ResolvedModel {
    const modelInstance = isClaudeModel(modelId)
        ? vertexAnthropicProvider(modelId)
        : vertexProvider(modelId);

    return {
        model: modelInstance,
        provider: "google-vertex",
        modelId,
        providerOptions: GOOGLE_VERTEX_PROVIDER_OPTIONS[modelId],
    };
}

function resolveSupportedChatModel(model: SupportedChatModel): ResolvedModel {
    const provider = model.provider;

    switch (provider) {
        case "google-vertex":
            return resolveGoogleVertexModel(model.id);
        default:
            return assertUnsupportedProvider(provider);
    }
}

export function isSupportedChatModel(modelId: string): modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId) !== undefined;
}

export function resolveChatModel(modelId: string): ResolvedModel {
    const model = findSupportedChatModel(modelId);
    if (!model) {
        throw new Error(`Unsupported model: ${modelId}`);
    }

    return resolveSupportedChatModel(model);
}