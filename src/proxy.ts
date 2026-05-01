import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico, brand assets
     * - any file with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\..*).*)",
  ],
};
