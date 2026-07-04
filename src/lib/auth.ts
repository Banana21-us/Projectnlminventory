import NextAuth from "next-auth";
import type { Role } from "@prisma/client";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  throw new Error("AUTH_SECRET is not set — refusing to start with an unsigned session cookie.");
}

const LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60_000;

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Self-hosted behind a Cloudflare tunnel — the Host header is the
  // tunnel's, so it must be trusted explicitly (Auth.js UntrustedHost).
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.username ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Throttle by client IP and by account, like Laravel's login throttle.
        // Behind cloudflared the client IP arrives in these headers.
        const ip =
          request?.headers?.get("cf-connecting-ip") ??
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "local";
        if (
          !rateLimit(`login:ip:${ip}`, LOGIN_ATTEMPTS * 3, LOGIN_WINDOW_MS) ||
          !rateLimit(`login:email:${email}`, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS)
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role ?? "STAFF") as Role;
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
