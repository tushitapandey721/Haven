import crypto from "node:crypto";
import type { Request } from "express";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db, users, sessions } from "@workspace/db";
import { getLocalUserId } from "./sentinel-store";

export interface UserProfile {
  id: string;
  email: string;
  role: "USER" | "RESEARCHER" | "ADMIN";
  createdAt: string;
}

// In-memory fallback session and user storage for mock / offline runs
const memUsersByEmail = new Map<string, { id: string; email: string; passwordHash: string; role: "USER"; createdAt: Date }>();
const memUsersById = new Map<string, { id: string; email: string; passwordHash: string; role: "USER"; createdAt: Date }>();
const memSessions = new Map<string, { id: string; userId: string; expiresAt: Date; revokedAt?: Date }>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash === "local-profile-no-password") return true;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(derivedKey, "hex"));
}

export function generateToken(): string {
  return "haven_" + crypto.randomBytes(32).toString("hex");
}

export async function registerUser(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const passwordHash = hashPassword(password);
  const token = generateToken();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing[0]) {
      throw new Error("An account with this email already exists.");
    }

    const [created] = await db
      .insert(users)
      .values({
        email: cleanEmail,
        passwordHash,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create user account.");
    }

    await db.insert(sessions).values({
      userId: created.id,
      refreshTokenHash: tokenHash,
      expiresAt,
    });

    const userProfile: UserProfile = {
      id: created.id,
      email: created.email,
      role: (created.role as "USER" | "RESEARCHER" | "ADMIN") || "USER",
      createdAt: created.createdAt.toISOString(),
    };

    // Store in-memory cache as well
    memUsersByEmail.set(cleanEmail, {
      id: created.id,
      email: cleanEmail,
      passwordHash,
      role: "USER",
      createdAt: created.createdAt,
    });
    memUsersById.set(created.id, {
      id: created.id,
      email: cleanEmail,
      passwordHash,
      role: "USER",
      createdAt: created.createdAt,
    });
    memSessions.set(tokenHash, {
      id: crypto.randomUUID(),
      userId: created.id,
      expiresAt,
    });

    return { user: userProfile, token };
  } catch (err: any) {
    // If database unavailable or table missing, fallback to in-memory store
    if (err.message && err.message.includes("already exists")) throw err;
    if (err.message && err.message.includes("Password must be")) throw err;
    if (err.message && err.message.includes("valid email")) throw err;

    if (memUsersByEmail.has(cleanEmail)) {
      throw new Error("An account with this email already exists.");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const memUser = { id, email: cleanEmail, passwordHash, role: "USER" as const, createdAt: now };
    memUsersByEmail.set(cleanEmail, memUser);
    memUsersById.set(id, memUser);
    memSessions.set(tokenHash, {
      id: crypto.randomUUID(),
      userId: id,
      expiresAt,
    });

    return {
      user: {
        id,
        email: cleanEmail,
        role: "USER",
        createdAt: now.toISOString(),
      },
      token,
    };
  }
}

export async function loginUser(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error("Email and password are required.");
  }

  const token = generateToken();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: tokenHash,
      expiresAt,
    });

    memSessions.set(tokenHash, {
      id: crypto.randomUUID(),
      userId: user.id,
      expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: (user.role as "USER" | "RESEARCHER" | "ADMIN") || "USER",
        createdAt: user.createdAt.toISOString(),
      },
      token,
    };
  } catch (err: any) {
    if (err.message && err.message.includes("Invalid email or password")) throw err;

    // Check in-memory store
    const memUser = memUsersByEmail.get(cleanEmail);
    if (!memUser || !verifyPassword(password, memUser.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    memSessions.set(tokenHash, {
      id: crypto.randomUUID(),
      userId: memUser.id,
      expiresAt,
    });

    return {
      user: {
        id: memUser.id,
        email: memUser.email,
        role: memUser.role,
        createdAt: memUser.createdAt.toISOString(),
      },
      token,
    };
  }
}

export async function validateSessionToken(token: string): Promise<UserProfile | null> {
  if (!token || !token.startsWith("haven_")) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Check in-memory session first
  const memSession = memSessions.get(tokenHash);
  if (memSession && !memSession.revokedAt && memSession.expiresAt > new Date()) {
    const memUser = memUsersById.get(memSession.userId);
    if (memUser) {
      return {
        id: memUser.id,
        email: memUser.email,
        role: memUser.role,
        createdAt: memUser.createdAt.toISOString(),
      };
    }
  }

  try {
    const result = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.refreshTokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!result[0]) return null;

    const { user } = result[0];
    return {
      id: user.id,
      email: user.email,
      role: (user.role as "USER" | "RESEARCHER" | "ADMIN") || "USER",
      createdAt: user.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const memSession = memSessions.get(tokenHash);
  if (memSession) {
    memSession.revokedAt = new Date();
  }

  try {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, tokenHash));
  } catch {
    // Ignore DB errors on revoke
  }
}

export async function resolveRequestUserId(req: Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const user = await validateSessionToken(token);
    if (user) return user.id;
  }

  // Check cookie if present
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(/haven_token=([^;]+)/);
    if (match && match[1]) {
      const user = await validateSessionToken(match[1]);
      if (user) return user.id;
    }
  }

  return getLocalUserId();
}
