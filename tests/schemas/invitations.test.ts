import {describe,expect,it} from "vitest";
import {inviteMemberSchema} from "../../src/schemas/invitations.js";

describe("member invitation schema",()=>{
  it("normalizes a valid invitation",()=>{const result=inviteMemberSchema.parse({email:"  Pessoa@Example.org ",full_name:"  Maria da Silva  ",role_id:"44444444-4444-4444-8444-444444444444"});expect(result).toEqual({email:"pessoa@example.org",full_name:"Maria da Silva",role_id:"44444444-4444-4444-8444-444444444444"});});
  it("rejects invalid email and role",()=>{expect(inviteMemberSchema.safeParse({email:"invalid",full_name:"A",role_id:"x"}).success).toBe(false);});
});
