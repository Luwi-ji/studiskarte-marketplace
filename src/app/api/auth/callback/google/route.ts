import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/identity/auth";

// The one Better Auth route that stays public: Google sends the person back here.
// Everything else under /api/auth stays unmounted (it would return the student's own
// email and let a name change past our rules); the app calls `auth.api` from the server only.
export const { GET } = toNextJsHandler(auth);
