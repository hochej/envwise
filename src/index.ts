export { classify, classifyEnv } from "./classifier.js";
export type { DotenvParseResult, ParseDotenvOptions } from "./dotenv.js";
export { parseDotenv } from "./dotenv.js";
export type { GondolinIntegrationResult, GondolinSecretDefinition } from "./integration.js";
export { classifyEnvForGondolin } from "./integration.js";
export {
  getPatternStore,
  PatternCompilationError,
  PatternIntegrityError,
  PatternSchemaError,
} from "./patterns.js";
export type {
  ClassifyEnvResult,
  ClassifyOptions,
  ClassifyResult,
  MatchSource,
  SecretMappingData,
} from "./types.js";
