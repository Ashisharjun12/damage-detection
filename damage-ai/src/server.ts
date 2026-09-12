import App from "@/app.js";
import { envConfig } from "@/config/env.js";
import { logGeminiConfigOnStartup } from "@/infrastructure/gemini/gemini-config.js";
import { assertR2Configured } from "@/infrastructure/storage/r2.client.js";
import { logger } from "@/shared/logger.js";

const start = async () => {
  try {
    logGeminiConfigOnStartup("damage-ai-server");

    try {
      assertR2Configured();
      logger.info("R2 configured for annotated image uploads");
    } catch (r2Err) {
      logger.warn(
        { message: r2Err instanceof Error ? r2Err.message : r2Err },
        "R2 not fully configured — annotated uploads will fail until .env is set",
      );
    }

    const app = new App().getApp();
    const PORT = envConfig.PORT;

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(error, "Failed to start the server");
    process.exit(1);
  }
};

void start();
