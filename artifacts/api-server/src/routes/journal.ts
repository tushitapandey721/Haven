import { Router } from "express";
import { resolveRequestUserId } from "../lib/auth";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "../lib/sentinel-store";

export const journalRouter = Router();

journalRouter.get("/", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req);
    const entries = await listJournalEntries(userId);
    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

journalRouter.post("/", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req);
    const body = req.body || {};
    const entry = await createJournalEntry(userId, {
      title: typeof body.title === "string" ? body.title : undefined,
      content: typeof body.content === "string" ? body.content : undefined,
      vibe: typeof body.vibe === "string" ? body.vibe : undefined,
      paperStyle: typeof body.paperStyle === "string" ? body.paperStyle : undefined,
      fontStyle: typeof body.fontStyle === "string" ? body.fontStyle : undefined,
      stickers: Array.isArray(body.stickers) ? body.stickers : undefined,
      photos: Array.isArray(body.photos) ? body.photos : undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
    });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

journalRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req);
    const entry = await getJournalEntry(userId, req.params.id);
    if (!entry) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

journalRouter.patch("/:id", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req);
    const body = req.body || {};
    const entry = await updateJournalEntry(userId, req.params.id, {
      title: typeof body.title === "string" ? body.title : undefined,
      content: typeof body.content === "string" ? body.content : undefined,
      vibe: typeof body.vibe === "string" ? body.vibe : undefined,
      paperStyle: typeof body.paperStyle === "string" ? body.paperStyle : undefined,
      fontStyle: typeof body.fontStyle === "string" ? body.fontStyle : undefined,
      stickers: Array.isArray(body.stickers) ? body.stickers : undefined,
      photos: Array.isArray(body.photos) ? body.photos : undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
    });
    if (!entry) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

journalRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req);
    const deleted = await deleteJournalEntry(userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
