import dotenv from "dotenv";
import path from "path";
import { Environment, EnvironmentVariables, validateConfig } from "./validate";

const envFiles: Record<string, string> = {
  development: ".env.development",
  production: ".env.production",
  local: ".env.local",
  test: ".env.test",
};

const envFilePath = path.join(
  __dirname,
  "..",
  "..",
  envFiles[process.env.NODE_ENV as string] || envFiles.local
);

dotenv.config({
  path: envFilePath,
});

export function config(options?: {
  skipValidation?: boolean;
}): EnvironmentVariables {
  const configVals = {
    NODE_ENV: (process.env.NODE_ENV as Environment) || Environment.Local,
    FEED_REQUEST_SERVICE_URL: process.env.FEED_REQUEST_SERVICE_URL as string,
    POSTGRES_URI: process.env.POSTGRES_URI as string,
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE as string,
  } as const;

  if (!options?.skipValidation) {
    validateConfig(configVals);
  }

  return configVals;
}

export type ConfigKeys = ReturnType<typeof config>;
