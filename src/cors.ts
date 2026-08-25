export const CANONICAL_PRODUCTION_ORIGIN =
  "https://idgestao.gestaoaviva.com.br";

type NodeEnvironment = "development" | "test" | "production";

interface ResolveCorsOriginsInput {
  configuredOrigins: string;
  appPublicUrl?: string;
  nodeEnv: NodeEnvironment;
}

export function resolveCorsOrigins({
  configuredOrigins,
  appPublicUrl,
  nodeEnv,
}: ResolveCorsOriginsInput): string[] {
  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (appPublicUrl) {
    origins.push(new URL(appPublicUrl).origin);
  }

  if (nodeEnv === "production") {
    origins.push(CANONICAL_PRODUCTION_ORIGIN);
  }

  return [...new Set(origins)];
}
