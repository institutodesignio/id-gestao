import Fastify from "fastify";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import { config } from "./config.js";

import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { personsRoutes } from "./routes/persons.js";
import { personAddressesRoutes } from "./routes/person-addresses.js";
import { personRelationshipsRoutes } from "./routes/person-relationships.js";
import { unitsRoutes } from "./routes/units.js";
import { projectsRoutes } from "./routes/projects.js";
import { projectUnitsRoutes } from "./routes/project-units.js";
import { membersRoutes } from "./routes/members.js";
import { organizationsRoutes } from "./routes/organizations.js";
import { projectTeamRoutes } from "./routes/project-team.js";
import { clinicalSupervisionRoutes } from "./routes/clinical-supervision.js";
import { neurodivergentIntakeRoutes } from "./routes/neurodivergent-intakes.js";
import { carePrivacyRoutes } from "./routes/care-privacy.js";
import { auditRoutes } from "./routes/audit.js";
import { invitationRoutes } from "./routes/invitations.js";
import { agendaRoutes } from "./routes/agenda.js";
import { documentRoutes } from "./routes/documents.js";
import { financeRoutes } from "./routes/finance.js";
import { rolesRoutes } from "./routes/roles.js";

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

      callback(null, config.corsOrigins.includes(origin));
    },

    credentials: false,

    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Authorization", "Content-Type"],
  });

  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(personsRoutes);
  await app.register(personAddressesRoutes);
  await app.register(personRelationshipsRoutes);
  await app.register(unitsRoutes);
  await app.register(organizationsRoutes);
  await app.register(projectsRoutes);
  await app.register(projectUnitsRoutes);
  await app.register(membersRoutes);
  await app.register(projectTeamRoutes);
  await app.register(clinicalSupervisionRoutes);
  await app.register(neurodivergentIntakeRoutes);
  await app.register(carePrivacyRoutes);
  await app.register(auditRoutes);
  await app.register(invitationRoutes);
  await app.register(agendaRoutes);
  await app.register(documentRoutes);
  await app.register(financeRoutes);
  await app.register(rolesRoutes);

  return app;
}
