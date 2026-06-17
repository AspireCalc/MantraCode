import { Polar } from "@polar-sh/sdk";

type PolarServer = "sandbox" | "production";

function getRequiredEnv(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required`);
    }
    return value;
}

export function getPolarAccessToken() {
    return getRequiredEnv("POLAR_ACCESS_TOKEN");
}

export function getPolarProductId() {
    return getRequiredEnv("POLAR_PRODUCT_ID");
}

export function getPolarCreditsMeterId() {
    return getRequiredEnv("POLAR_CREDITS_METER_ID");
}

export function getPolarServer(): PolarServer {
    const server = process.env.POLAR_SERVER;
    if (!server) {
        return "sandbox";
    }

    if (server !== "sandbox" && server !== "production") {
        throw new Error("POLAR_SERVER must be either 'sandbox' pr 'production'");
    }

    return server;
}

const polar = new Polar({
    accessToken: getPolarAccessToken(),
    server: getPolarServer(),
});

function hasStatusCode(error: unknown): error is { statusCode: number } {
    return (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
    );
}

type CreateCheckoutUrlParams = {
    customerExternalId: string;
    requestUrl: string;
};

export async function createCheckoutUrl({ customerExternalId, requestUrl }: CreateCheckoutUrlParams) {
    const result = await polar.checkouts.create({
        products: [getPolarProductId()],
        successUrl: new URL("/billing/success", requestUrl).toString(),
        externalCustomerId: customerExternalId,
        metadata: { source: "mantracode-cli" },
    });

    return result.url;
}

export async function createCustomerPortalUrl({ customerExternalId, requestUrl }: CreateCheckoutUrlParams) {
    const result = await polar.customerSessions.create({
        externalCustomerId: customerExternalId,
        returnUrl: new URL("/billing/success", requestUrl).toString(),
    });

    return result.customerPortalUrl;
}

export type CreditsMeterInfo = {
    consumedUnits: number;
    creditedUnits: number;
    balance: number;
};

async function getCreditsMeter(customerExternalId: string): Promise<CreditsMeterInfo | null> {
    try {
        const customerState = await polar.customers.getStateExternal({
            externalId: customerExternalId,
        });

        const matchingMeters = customerState.activeMeters.filter((meter) => meter.meterId === getPolarCreditsMeterId());

        if (matchingMeters.length > 1) {
            throw new Error("Expected exactly one matching Polar credits meter")
        }

        const creditsMeter = matchingMeters[0];
        if (!creditsMeter) return null;

        return {
            consumedUnits: creditsMeter.consumedUnits,
            creditedUnits: creditsMeter.creditedUnits,
            balance: creditsMeter.balance,
        };
    } catch (error) {
        if (hasStatusCode(error) && error.statusCode === 404) {
            return null;
        }
        throw error;
    }
}

export async function getAvailableCreditsBalance(customerExternalId: string) {
    const meter = await getCreditsMeter(customerExternalId);
    return meter?.balance ?? 0;
}

export async function getCreditsSummary(customerExternalId: string) {
    const meter = await getCreditsMeter(customerExternalId);
    return {
        used: meter?.consumedUnits ?? 0,
        total: meter?.creditedUnits ?? 0,
    };
}

type IngestAiUsageParams = {
    externalCustomerId: string;
    eventId: string;
    credits: number;
}

export async function ingestAiUsage({ externalCustomerId, eventId, credits }: IngestAiUsageParams) {
    if (credits <= 0) {
        return;
    }

    await polar.events.ingest({
        events: [
            {
                name: "mantracode_usage",
                externalId: eventId,
                externalCustomerId,
                metadata: { credits },
            },
        ],
    });
};

