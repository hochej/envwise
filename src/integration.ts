import { classifyEnv } from "./classifier.js";
import type { ClassifyEnvResult, ClassifyOptions } from "./types.js";

export interface GondolinSecretDefinition {
  hosts: string[];
  value: string;
}

export interface GondolinIntegrationResult extends ClassifyEnvResult {
  secretsMap: Record<string, GondolinSecretDefinition>;
}

export function classifyEnvForGondolin(
  env: Record<string, string | undefined>,
  options?: ClassifyOptions,
): GondolinIntegrationResult {
  const classified = classifyEnv(env, options);
  const secretsMap: Record<string, GondolinSecretDefinition> = {};

  for (const secret of classified.secrets) {
    secretsMap[secret.name] = {
      hosts: secret.hosts,
      value: env[secret.name] ?? "",
    };
  }

  return {
    ...classified,
    secretsMap,
  };
}
