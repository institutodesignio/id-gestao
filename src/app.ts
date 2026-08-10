import Fastify from "fastify";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import { config } from "./config.js";

import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { personsRoutes } from "./routes/persons.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(helmet);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        config.corsOrigins.includes(origin);

      callback(null, isAllowed);
    },

    credentials: false,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Authorization",
      "Content-Type",
    ],
  });

  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(personsRoutes);

  return app;
}