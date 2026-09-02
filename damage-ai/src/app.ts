import express, { Application } from "express";
import helmet from "helmet";
import { errorHandler } from "@/shared/errors/api-handler.js";
import { httpLogger } from "@/shared/middleware/logger.middleware.js";
import { healthRouter } from "@/app/routes/health.routes.js";
import { assessmentsRouter } from "@/app/routes/assessments.routes.js";

class App {
  private app: Application;

  constructor() {
    this.app = express();
    this.app.set("trust proxy", 1);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    this.app.use(helmet());
    this.app.use(httpLogger);
    this.app.use(express.json({ limit: "2mb" }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    this.app.use("/health", healthRouter);
    this.app.use("/v1", assessmentsRouter);
  }

  private setupErrorHandling() {
    this.app.use(errorHandler);
  }

  getApp(): Application {
    return this.app;
  }
}

export default App;
