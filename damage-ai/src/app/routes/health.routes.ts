import { Router } from "express";
import { getGeminiConfigSummary } from "@/infrastructure/gemini/gemini-config.js";
import { pingGemini } from "@/infrastructure/gemini/gemini-health.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const gemini = getGeminiConfigSummary();
  res.json({
    status: "ok",
    service: "damage-ai",
    version: "2.0.0",
    gemini: {
      configured: gemini.configured,
      model: gemini.model,
      gateEnabled: gemini.gateEnabled,
    },
  });
});

healthRouter.get("/gemini", async (_req, res) => {
  const gemini = getGeminiConfigSummary();
  const ping = await pingGemini();
  res.status(ping.ok ? 200 : 503).json({
    status: ping.ok ? "ok" : "error",
    gemini: {
      ...gemini,
      ping: {
        ok: ping.ok,
        latencyMs: ping.latencyMs,
        error: ping.error,
        errorType: ping.errorType,
      },
    },
  });
});
