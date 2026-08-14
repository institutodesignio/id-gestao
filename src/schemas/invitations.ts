import {z} from "zod";
export const inviteMemberSchema=z.object({email:z.string().trim().email().max(254).transform(value=>value.toLowerCase()),full_name:z.string().trim().min(1).max(200),role_id:z.string().uuid()}).strict();
