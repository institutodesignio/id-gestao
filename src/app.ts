import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(helmet);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      callback(null, config.corsOrigins.includes(origin));
    },
    credentials: false,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  await app.register(healthRoutes);
  await app.register(meRoutes);

  return app;
}
