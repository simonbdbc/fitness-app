import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Port minimal utilisé par les repositories et les migrations.
 * L'implémentation Expo SQLite reste confinée au runtime de composition.
 */
export type LocalDatabase = Pick<
  SQLiteDatabase,
  | "execAsync"
  | "getAllAsync"
  | "getFirstAsync"
  | "runAsync"
  | "withTransactionAsync"
>;
