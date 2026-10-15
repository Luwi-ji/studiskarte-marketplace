import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/identity/auth";

// The sign-in form uses server actions, but Better Auth's own routes stay
// reachable (session lookups, sign-out). Our before-hook guards the code
// endpoints, so a direct call cannot get a code for a non-school address.
export const { GET, POST } = toNextJsHandler(auth);
