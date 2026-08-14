import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("../../src/auth.js",()=>({requireAuthenticatedUser:vi.fn()}));
vi.mock("../../src/plugins/supabase.js",()=>({createAdminSupabaseClient:vi.fn(()=>null),createSystemSupabaseClient:vi.fn()}));
vi.mock("../../src/config.js",()=>({config:{APP_PUBLIC_URL:undefined}}));
import {requireAuthenticatedUser} from "../../src/auth.js";
import {auditRoutes} from "../../src/routes/audit.js";
import {invitationRoutes} from "../../src/routes/invitations.js";
const auth=vi.mocked(requireAuthenticatedUser);
async function build(){const app=Fastify({logger:false});await app.register(auditRoutes);await app.register(invitationRoutes);return app;}
describe("production administration routes",()=>{beforeEach(()=>vi.clearAllMocks());it("protects audit access",async()=>{auth.mockResolvedValue({ok:false,statusCode:401,error:"AUTHENTICATION_REQUIRED"} as any);const app=await build();expect((await app.inject({method:"GET",url:"/api/v1/audit-events"})).statusCode).toBe(401);await app.close();});it("protects invitations",async()=>{auth.mockResolvedValue({ok:false,statusCode:401,error:"AUTHENTICATION_REQUIRED"} as any);const app=await build();expect((await app.inject({method:"POST",url:"/api/v1/members/invite",payload:{}})).statusCode).toBe(401);await app.close();});});
