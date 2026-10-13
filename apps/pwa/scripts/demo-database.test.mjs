import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import ts from "typescript";
const source=readFileSync(new URL("../src/shared/db/migrations.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const migration=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const adapter=sqlite=>({execAsync:async s=>sqlite.exec(s),getFirstAsync:async(s,p=[])=>sqlite.prepare(s).get(...p)??null,getAllAsync:async(s,p=[])=>sqlite.prepare(s).all(...p),runAsync:async(s,p=[])=>sqlite.prepare(s).run(...p),withTransactionAsync:async f=>{sqlite.exec("BEGIN");try{await f();sqlite.exec("COMMIT");}catch(e){sqlite.exec("ROLLBACK");throw e;}}});
test("demo initializes an empty isolated SQLite schema and is idempotent",async()=>{
 const sqlite=new DatabaseSync(":memory:");try{
  const db=adapter(sqlite);await migration.runLocalDatabaseMigrations(db);
  assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version,1);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM catalog_exercises").get().n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM acrea_profiles").get().n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sync_metadata WHERE key='catalog'").get().n,1);
  sqlite.exec("CREATE TABLE test_persistence(value TEXT); INSERT INTO test_persistence VALUES ('synthetic-demo-value');");
  await migration.runLocalDatabaseMigrations(db);
  assert.equal(sqlite.prepare("SELECT value FROM test_persistence").get().value,"synthetic-demo-value");
 }finally{sqlite.close();}
});
test("unsupported demonstration schema fails without deleting existing local data",async()=>{
 const sqlite=new DatabaseSync(":memory:");try{
  sqlite.exec("CREATE TABLE test_persistence(value TEXT); INSERT INTO test_persistence VALUES ('synthetic-preserved'); PRAGMA user_version=2;");
  await assert.rejects(migration.runLocalDatabaseMigrations(adapter(sqlite)),/incompatible/);
  assert.equal(sqlite.prepare("SELECT value FROM test_persistence").get().value,"synthetic-preserved");
 }finally{sqlite.close();}
});
