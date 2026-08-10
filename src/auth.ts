import type { FastifyRequest } from "fastify";
import { createUserSupabaseClient } from "./plugins/supabase.js";

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (!header) return null;

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuthenticatedUser(request: FastifyRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      statusCode: 401,
      error: "AUTHENTICATION_REQUIRED",
    };
  }

  const supabase = createUserSupabaseClient(token);

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    request.log.error(
      {
        message: error.message,
        status: error.status,
        name: error.name,
      },
      "Supabase authentication failed"
    );

    return {
      ok: false as const,
      statusCode: 401,
      error: "INVALID_OR_EXPIRED_TOKEN",
    };
  }

  if (!data.user) {
    request.log.error(
      "Supabase authentication returned no user"
    );

    return {
      ok: false as const,
      statusCode: 401,
      error: "INVALID_OR_EXPIRED_TOKEN",
    };
  }

  return {
    ok: true as const,
    token,
    user: data.user,
    supabase,
  };
}