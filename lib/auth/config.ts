import { createHmac } from "node:crypto";

import type { UserRole } from "@prisma/client";
import type { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { PrismaInquiryRateLimitAdapter } from "@/features/inquiries/repository";
import { resolveClientIp, type InquiryProxyMode } from "@/features/inquiries/request-context";
import { prisma } from "@/lib/db/prisma";

import { verifyPassword } from "./password";

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,p=4,t=3$A32FX5PrdImdm9qBxC6+qA$BackJ7Iy3z07j5TWmUSPdi40FtW7PU6HMcyTTq135bA";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
  updatedAt: Date;
};

export type AuthRateLimitInput = {
  key: string;
  limit: number;
  windowSeconds: number;
  now: Date;
};

export interface AuthRateLimitAdapter {
  consume(input: AuthRateLimitInput): Promise<boolean>;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function authRateLimitKey(kind: "pair" | "email" | "ip", value: string, secret: string): string {
  if (secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(`auth:${kind}:${value}`).digest("hex");
}

export async function applyAuthRateLimits(
  adapter: AuthRateLimitAdapter,
  input: { email: string; ip?: string; now: Date; secret: string },
): Promise<boolean> {
  const email = normalizeEmail(input.email);
  const requests: AuthRateLimitInput[] = input.ip
    ? [
        { key: authRateLimitKey("pair", `${input.ip}\n${email}`, input.secret), limit: 5, windowSeconds: 15 * 60, now: input.now },
        { key: authRateLimitKey("email", email, input.secret), limit: 20, windowSeconds: 60 * 60, now: input.now },
        { key: authRateLimitKey("ip", input.ip, input.secret), limit: 50, windowSeconds: 60 * 60, now: input.now },
      ]
    : [{ key: authRateLimitKey("email", email, input.secret), limit: 20, windowSeconds: 60 * 60, now: input.now }];

  const results = await Promise.all(requests.map((request) => adapter.consume(request)));
  return results.every(Boolean);
}

type CredentialAuthorizerDependencies = {
  findActiveUserByEmail(email: string): Promise<CredentialUser | null>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  consumeRateLimit(input: { email: string; ip?: string }): Promise<boolean>;
};

export function createCredentialAuthorizer(dependencies: CredentialAuthorizerDependencies) {
  return async function authorize(
    credentials: { email?: string; password?: string } | undefined,
    context: { ip?: string },
  ): Promise<(User & { role: UserRole; version: string }) | null> {
    const email = normalizeEmail(credentials?.email ?? "");
    const password = credentials?.password ?? "";
    const [user, allowed] = await Promise.all([
      dependencies.findActiveUserByEmail(email),
      dependencies.consumeRateLimit({ email, ip: context.ip }),
    ]);
    const passwordMatches = await dependencies.verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);

    if (!user || !passwordMatches || !allowed) return null;
    return {
      id: user.id,
      role: user.role,
      version: user.updatedAt.toISOString(),
    };
  };
}

function proxyMode(): InquiryProxyMode {
  const mode = process.env.INQUIRY_PROXY_MODE;
  if (mode === "vercel" || mode === "nginx" || mode === "direct") return mode;
  throw new Error("INQUIRY_PROXY_MODE must define the trusted proxy boundary");
}

function requestIp(headers: Record<string, unknown> | undefined): string | undefined {
  const value = (name: string) => typeof headers?.[name] === "string" ? headers[name] : undefined;
  return resolveClientIp(proxyMode(), {
    "x-vercel-forwarded-for": value("x-vercel-forwarded-for"),
    "x-real-ip": value("x-real-ip"),
  });
}

const authorizeCredentials = createCredentialAuthorizer({
  findActiveUserByEmail(email) {
    return prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
      select: { id: true, email: true, name: true, passwordHash: true, role: true, updatedAt: true },
    });
  },
  verify: verifyPassword,
  consumeRateLimit({ email, ip }) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is required");
    return applyAuthRateLimits(new PrismaInquiryRateLimitAdapter(), { email, ip, now: new Date(), secret });
  },
});

const secureCookies = process.env.NODE_ENV === "production";

export const authOptions: AuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  useSecureCookies: secureCookies,
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-yueshou.session-token" : "yueshou.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies },
    },
  },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Staff credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials, request) {
        return authorizeCredentials(credentials, { ip: requestIp(request.headers) });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      const candidate = user as (User & { role?: UserRole; version?: string }) | undefined;
      if (candidate?.id && candidate.role && candidate.version) {
        return { sub: candidate.id, role: candidate.role, version: candidate.version };
      }
      return { sub: token.sub, role: token.role, version: token.version };
    },
    session({ session, token }) {
      if (
        typeof token.sub === "string" &&
        (token.role === "ADMIN" || token.role === "EDITOR") &&
        typeof token.version === "string"
      ) {
        session.user = { id: token.sub, role: token.role, version: token.version };
      }
      return session;
    },
  },
};
