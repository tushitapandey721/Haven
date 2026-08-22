import { Router, type IRouter, type Request, type Response } from "express";
import {
  registerUser,
  loginUser,
  validateSessionToken,
  revokeSessionToken,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const { user, token } = await registerUser(email, password);
    res.cookie("haven_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Registration failed." });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const { user, token } = await loginUser(email, password);
    res.cookie("haven_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ user, token });
  } catch (err: any) {
    res.status(401).json({ error: err.message || "Login failed." });
  }
});

router.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/haven_token=([^;]+)/);
      if (match && match[1]) token = match[1];
    }

    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await validateSessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired or invalid" });
      return;
    }

    res.status(200).json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not retrieve user." });
  }
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/haven_token=([^;]+)/);
      if (match && match[1]) token = match[1];
    }

    if (token) {
      await revokeSessionToken(token);
    }

    res.clearCookie("haven_token");
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Logout failed." });
  }
});

export default router;
