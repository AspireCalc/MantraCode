import type { LanguageModelUsage } from "ai";
import { SUPPORTED_CHAT_MODELS, findSupportedChatModel, type ModelPricing } from "@mantracode/shared";

type CalculateCreditsForUsageParams = {
    provider: string;
    model: string;
    usage: LanguageModelUsage;
}

type BillableUsage = {
    credits: number;
};

type TokenCounts = {
    inputTokens: number;
    outputTokens: number;
};

const TOKENS_PER_MILLION = 1_000_000;
const INR_PER_CREDIT = 0.01;

function getTokenCounts(usage: LanguageModelUsage): TokenCounts {
    const inputTokens = usage.inputTokens;
    const outputTokens = usage.outputTokens;

    if (inputTokens == null || outputTokens == null) {
        throw new Error("Credit conversion requires input and output token count");
    }

    return {
        inputTokens,
        outputTokens
    };
};

function getModelPricing(provider: string, model: string): ModelPricing {
    const supportedModel = findSupportedChatModel(model);

    if (!supportedModel || supportedModel.provider !== provider) {
        if (!SUPPORTED_CHAT_MODELS.some((supportedModel) => supportedModel.provider === provider)) {
            throw new Error(`Unsupported billing provider: ${provider}`)
        }

        throw new Error(`Unsupported billing model: ${model}`);
    }

    return supportedModel.pricing;
}

function estimateCostInr({ inputTokens, outputTokens }: TokenCounts, pricing: ModelPricing) {
    return (
        (inputTokens * pricing.inputInrPerMillionTokens + outputTokens * pricing.outputInrPerMillionTokens) / TOKENS_PER_MILLION
    );
}

function convertInrToCredits(estimatedCostInr: number) {
    if (estimatedCostInr <= 0) {
        return 0;
    }

    return Math.max(1, Math.ceil(estimatedCostInr / INR_PER_CREDIT));
}

export function calculateCreditsForUsage({ provider, model, usage }: CalculateCreditsForUsageParams): BillableUsage {
    const tokenCounts = getTokenCounts(usage);
    const pricing = getModelPricing(provider, model);
    const estimatedCostInr = estimateCostInr(tokenCounts, pricing);
    const credits = convertInrToCredits(estimatedCostInr);

    return {
        credits,
    };
}


