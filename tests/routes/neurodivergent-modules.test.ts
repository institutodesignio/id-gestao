import Fastify from "fastify";import{beforeEach,describe,expect,it,vi}from"vitest";
vi.mock("../../src/auth.js",()=>({requireAuthenticatedUser:vi.fn()}));
import{requireAuthenticatedUser}from"../../src/auth.js";import{neurodivergentIntakeRoutes}from"../../src/routes/neurodivergent-intakes.js";import{carePrivacyRoutes}from"../../src/routes/care-privacy.js";
const auth=vi.mocked(requireAuthenticatedUser);const id="11111111-1111-4111-8111-111111111111";
async function build(){const app=Fastify({logger:false});await app.register(neurodivergentIntakeRoutes);await app.register(carePrivacyRoutes);return app;}
describe("modules 7 through 11 authentication",()=>{beforeEach(()=>{vi.clearAllMocks();auth.mockResolvedValue({ok:false,statusCode:401,error:"AUTHENTICATION_REQUIRED"})});
 it("protects intake lists",async()=>{const app=await build();const r=await app.inject({method:"GET",url:"/api/v1/neurodivergent-intakes"});expect(r.statusCode).toBe(401);await app.close()});
 it("protects intake submission",async()=>{const app=await build();const r=await app.inject({method:"POST",url:"/api/v1/neurodivergent-intakes/submit",payload:{}});expect(r.statusCode).toBe(401);await app.close()});
 it("protects consent revocation",async()=>{const app=await build();const r=await app.inject({method:"PATCH",url:`/api/v1/neurodivergent-intakes/${id}/consents/${id}/revoke`,payload:{reason:"Solicitação"}});expect(r.statusCode).toBe(401);await app.close()});
 it("protects care requests",async()=>{const app=await build();const r=await app.inject({method:"GET",url:"/api/v1/care-requests"});expect(r.statusCode).toBe(401);await app.close()});
 it("protects indicators",async()=>{const app=await build();const r=await app.inject({method:"GET",url:"/api/v1/indicators/neurodivergent-population?dimension=condition"});expect(r.statusCode).toBe(401);await app.close()});
 it("protects privacy requests",async()=>{const app=await build();const r=await app.inject({method:"GET",url:"/api/v1/privacy/requests"});expect(r.statusCode).toBe(401);await app.close()});
});
