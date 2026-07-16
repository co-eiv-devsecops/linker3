import type { AppConfig } from "../config.ts";
import { loadConfig } from "../config.ts";
import { type Application, createApplication } from "../container.ts";

let application: Application | undefined;

/** Reuses initialized dependencies across warm serverless invocations. */
export function getServerlessApplication(config: AppConfig = loadConfig()): Application {
  application ??= createApplication(config);
  return application;
}
