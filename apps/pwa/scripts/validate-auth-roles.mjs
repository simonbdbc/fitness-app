#!/usr/bin/env node

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const env = readEnvFile(path.join(projectRoot, ".env"));
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Supabase local doit être configuré dans apps/pwa/.env.");
}

if (!isLocalSupabaseUrl(supabaseUrl)) {
  throw new Error(
    `auth:roles:check refuse une URL Supabase distante: ${supabaseUrl}`,
  );
}

const accounts = [
  {
    email: "basic@example.test",
    password: "demo-session",
    role: "basic",
  },
  {
    email: "premium@example.test",
    password: "premium-session",
    role: "premium",
  },
  {
    email: "admin@example.test",
    password: "admin-session",
    role: "admin",
  },
];

await main();

async function main() {
  const anonClient = createLocalClient();
  const { data: publicCatalog, error: publicCatalogError } = await anonClient
    .from("catalog_pillars")
    .select("id")
    .limit(1);
  assertNoError(publicCatalogError, "lecture catalogue anonyme");
  assert(publicCatalog?.length === 1, "le catalogue anonyme doit être lisible");

  const { data: anonProfiles, error: anonProfilesError } = await anonClient
    .from("user_profiles")
    .select("id");
  assert(
    Boolean(anonProfilesError) || (anonProfiles?.length ?? 0) === 0,
    "un utilisateur anonyme ne doit lire aucun profil",
  );

  const clients = new Map();
  const userIds = new Map();
  for (const account of accounts) {
    const client = createLocalClient();
    const { data: signInData, error: signInError } =
      await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
    assertNoError(signInError, `connexion ${account.role}`);
    assert(signInData.user, `utilisateur ${account.role} absent après connexion`);

    const { data: profiles, error: profileError } = await client
      .from("user_profiles")
      .select("id,email,display_name,account_type");
    assertNoError(profileError, `lecture profil ${account.role}`);
    assert(profiles?.length === 1, `${account.role} doit lire uniquement son profil`);
    assert(
      profiles?.[0]?.account_type === account.role,
      `rôle ${account.role} attendu, reçu ${profiles?.[0]?.account_type}`,
    );

    const originalName = profiles?.[0]?.display_name ?? null;
    const checkName = `${account.role} role check`;
    const { error: displayNameError } = await client
      .from("user_profiles")
      .update({ display_name: checkName })
      .eq("id", signInData.user.id);
    assertNoError(displayNameError, `mise à jour display_name ${account.role}`);

    const { error: roleEscalationError } = await client
      .from("user_profiles")
      .update({ account_type: "admin" })
      .eq("id", signInData.user.id);
    assert(roleEscalationError, `${account.role} ne doit pas modifier account_type`);

    const { data: unchangedProfile, error: unchangedProfileError } = await client
      .from("user_profiles")
      .select("account_type")
      .eq("id", signInData.user.id)
      .single();
    assertNoError(unchangedProfileError, `relecture rôle ${account.role}`);
    assert(
      unchangedProfile?.account_type === account.role,
      `le rôle ${account.role} ne doit pas être modifié par le client`,
    );

    const { error: restoreNameError } = await client
      .from("user_profiles")
      .update({ display_name: originalName })
      .eq("id", signInData.user.id);
    assertNoError(restoreNameError, `restauration display_name ${account.role}`);
    clients.set(account.role, client);
    userIds.set(account.role, signInData.user.id);
  }

  await assertForeignProfileAccessDenied(clients.get("basic"), userIds.get("premium"));
  await assertCatalogWriteDenied(clients.get("basic"), "basic");
  await assertCatalogWriteDenied(clients.get("premium"), "premium");
  await assertAdminCatalogWrites(clients.get("admin"));
  await assertNewSignupDefaultsToBasic();

  for (const client of clients.values()) {
    await client.auth.signOut();
  }

  console.log("auth:roles:check passed");
}

async function assertForeignProfileAccessDenied(client, foreignId) {
  const { data: profiles, error } = await client.from("user_profiles").select("id,display_name").eq("id", foreignId);
  assertNoError(error, "lecture de profil étranger");
  assert(profiles?.length === 0, "le profil étranger doit rester invisible");
  const { data: updated, error: updateError } = await client.from("user_profiles").update({ display_name: "Foreign change must be refused" }).eq("id", foreignId).select("id");
  assertNoError(updateError, "mise à jour filtrée par RLS");
  assert(updated?.length === 0, "une mutation étrangère doit modifier zéro profil");
}

async function assertCatalogWriteDenied(client, role) {
  const { error } = await client.from("catalog_equipment").insert({
    code: `auth-role-check-${role}`,
    label: `Auth role check ${role}`,
    label_en: `Auth role check ${role}`,
    category: "sport",
  });
  assert(error, `${role} ne doit pas insérer dans catalog_equipment`);
}

async function assertAdminCatalogWrites(client) {
  const equipmentCode = "auth-role-check-admin";
  await client.from("catalog_equipment").delete().eq("code", equipmentCode);

  const { data: insertedEquipment, error: equipmentInsertError } = await client
    .from("catalog_equipment")
    .insert({
      category: "sport",
      code: equipmentCode,
      label: "Auth role check admin",
      label_en: "Auth role check admin",
    })
    .select("id")
    .single();
  assertNoError(equipmentInsertError, "insertion équipement admin");

  const { error: exerciseMutationError } = await client
    .from("catalog_exercises")
    .update({ label: "Auth role check admin" })
    .eq("id", -1);
  assert(exerciseMutationError, "la bibliothèque V2 reste en lecture seule via Data API, même pour admin");

  const { data: exercise, error: exerciseError } = await client
    .from("catalog_exercises")
    .select("id")
    .limit(1)
    .single();
  assertNoError(exerciseError, "lecture exercice pour RPC session");

  const sessionCode = "auth-role-check-session";
  await client.from("catalog_session_templates").delete().eq("code", sessionCode);
  const now = new Date().toISOString();
  const { data: sessionId, error: sessionInsertError } = await client.rpc(
    "admin_upsert_catalog_session_template",
    {
      p_id: 0,
      p_code: sessionCode,
      p_title: "Auth role check session",
      p_description: "Session de validation locale",
      p_exercise_id: exercise.id,
      p_phase: "main",
      p_levels: [1, 2],
      p_is_active: true,
      p_source_status: "auth roles check",
      p_updated_at: now,
    },
  );
  assertNoError(sessionInsertError, "création RPC session admin");
  assert(Number.isFinite(Number(sessionId)), "la RPC doit retourner un identifiant");

  const { error: invalidUpdateError } = await client.rpc(
    "admin_upsert_catalog_session_template",
    {
      p_id: Number(sessionId),
      p_code: sessionCode,
      p_title: "Titre qui doit être annulé",
      p_description: "",
      p_exercise_id: exercise.id,
      p_phase: "main",
      p_levels: [],
      p_is_active: true,
      p_source_status: "auth roles check",
      p_updated_at: new Date().toISOString(),
    },
  );
  assert(invalidUpdateError, "une session sans niveau doit être rejetée");

  const { data: persistedSession, error: persistedSessionError } = await client
    .from("catalog_session_templates")
    .select("title,catalog_session_template_levels(level)")
    .eq("id", Number(sessionId))
    .single();
  assertNoError(persistedSessionError, "relecture session après erreur RPC");
  assert(
    persistedSession?.title === "Auth role check session",
    "la RPC invalide ne doit pas modifier le template",
  );
  assert(
    persistedSession?.catalog_session_template_levels?.length === 2,
    "la RPC invalide ne doit pas remplacer les niveaux",
  );

  const { error: sessionDeleteError } = await client
    .from("catalog_session_templates")
    .delete()
    .eq("id", Number(sessionId));
  assertNoError(sessionDeleteError, "suppression session de contrôle");

  const { error: equipmentDeleteError } = await client
    .from("catalog_equipment")
    .delete()
    .eq("id", insertedEquipment.id);
  assertNoError(equipmentDeleteError, "suppression équipement de contrôle");
}

async function assertNewSignupDefaultsToBasic() {
  const client = createLocalClient();
  const email = `role-check-basic-${randomUUID()}@example.test`;
  const password = "role-check-session";
  let { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    ({ data, error } = await client.auth.signUp({
      email, password, options: { data: { account_type: "admin", role: "admin" } },
    }));
  }

  assertNoError(error, "création du compte de contrôle basic");
  assert(data.user, "compte de contrôle basic absent");

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("account_type")
    .eq("id", data.user.id)
    .single();
  assertNoError(profileError, "profil du nouveau compte basic");
  assert(
    profile?.account_type === "basic",
    "une inscription doit créer un profil basic",
  );
  await client.auth.signOut();
}

function createLocalClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function isLocalSupabaseUrl(value) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function assertNoError(error, label) {
  if (error) {
    throw new Error(`${label}: ${error.message ?? String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
