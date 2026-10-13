export type {
  CatalogProgrammingPort,
  CatalogProgrammingSnapshot,
} from "./contracts/programmingCatalog";
export type {
  CatalogEquipmentOption,
  CatalogExercise,
  CatalogFormat,
} from "./types";
export {
  resolveCatalogEvaluationProtocolVersionWithDatabase,
  type CatalogEvaluationProtocolVersion,
} from "./services/catalogEvaluationProtocol";
export { localCatalogProgrammingPort } from "./services/catalogProgrammingAdapter";
