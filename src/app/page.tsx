import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/policies";

// The real home page lives at /dashboard (guesthouse accounts at /guesthouse).
// The proxy already redirects "/" before this ever renders for a normal
// request — this is only a defense-in-depth fallback.
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? homeFor(session.user.role) : "/login");
}
