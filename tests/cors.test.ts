import { describe, expect, it } from "vitest";
import {
  CANONICAL_PRODUCTION_ORIGIN,
  resolveCorsOrigins,
} from "../src/cors.js";

describe("resolveCorsOrigins", () => {
  it("preserves configured origins and normalizes the public URL", () => {
    expect(
      resolveCorsOrigins({
        configuredOrigins:
          "http://localhost:5173, https://preview--idgestaoplaforma.lovable.app ",
        appPublicUrl: "https://idgestaoplaforma.lovable.app/app",
        nodeEnv: "development",
      }),
    ).toEqual([
      "http://localhost:5173",
      "https://preview--idgestaoplaforma.lovable.app",
      "https://idgestaoplaforma.lovable.app",
    ]);
  });

  it("always allows the canonical application origin in production", () => {
    expect(
      resolveCorsOrigins({
        configuredOrigins: "https://preview--idgestaoplaforma.lovable.app",
        nodeEnv: "production",
      }),
    ).toContain(CANONICAL_PRODUCTION_ORIGIN);
  });

  it("does not duplicate the canonical application origin", () => {
    expect(
      resolveCorsOrigins({
        configuredOrigins: CANONICAL_PRODUCTION_ORIGIN,
        appPublicUrl: `${CANONICAL_PRODUCTION_ORIGIN}/app`,
        nodeEnv: "production",
      }),
    ).toEqual([CANONICAL_PRODUCTION_ORIGIN]);
  });

  it("does not add the production origin outside production", () => {
    expect(
      resolveCorsOrigins({
        configuredOrigins: "http://localhost:5173",
        nodeEnv: "test",
      }),
    ).toEqual(["http://localhost:5173"]);
  });
});
