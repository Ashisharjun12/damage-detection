import { envConfig } from "@/config/env.js";
import type { M02Report } from "@/types/m02.v1.js";
import { logger } from "@/shared/logger.js";

export async function sendWebhook(report: M02Report): Promise<void> {
  if (!envConfig.WEBHOOK_URL) {
    logger.warn("WEBHOOK_URL not set, skipping webhook");
    return;
  }

  const payload = {
    event: "m02.damage_analysis.completed",
    event_id: `evt_${report.request_id}`,
    request_id: report.request_id,
    survey_id: report.survey_id,
    status: report.status,
    result: report,
  };

  const res = await fetch(envConfig.WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": envConfig.WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Webhook failed ${res.status}: ${body}`);
  }
}
