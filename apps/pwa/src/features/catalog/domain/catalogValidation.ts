export function normalizeEquipmentCode(value: string) {
  return value.trim().toLowerCase();
}

export function assertEquipmentLabelIsConcrete(label: string) {
  const normalized = label.trim().toLowerCase();
  if (
    normalized.includes("/") ||
    normalized.includes("optionnel") ||
    normalized === "aucun" ||
    normalized === "support" ||
    normalized === "support stable"
  ) {
    throw new Error(
      "Le libellé doit désigner un équipement concret et unique.",
    );
  }
}

export function normalizeCatalogCode(value: string) {
  const code = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!isStableCatalogCode(code)) {
    throw new Error(
      "Le code catalogue doit utiliser uniquement lettres minuscules, chiffres et tirets.",
    );
  }

  return code;
}

export function codeFromLabel(prefix: string, label: string) {
  return `${prefix}-${normalizeCatalogCode(label || `${Date.now()}`)}`;
}

export function requireTrimmed(value: string, label: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) throw new Error(`${label} est requis.`);
  return trimmedValue;
}

export function requireFiniteNumber(
  value: number | null | undefined,
  label: string,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} est requis.`);
  }
  return Math.trunc(value);
}

export function requirePositiveInteger(value: number, label: string) {
  const numberValue = requireFiniteNumber(value, label);
  if (numberValue <= 0) throw new Error(`${label} doit être supérieur à 0.`);
  return numberValue;
}

export function requireNonNegativeInteger(value: number, label: string) {
  const numberValue = requireFiniteNumber(value, label);
  if (numberValue < 0) {
    throw new Error(`${label} doit être supérieur ou égal à 0.`);
  }
  return numberValue;
}

export function clampCatalogLevel(value: number) {
  const level = requireFiniteNumber(value, "Niveau");
  return Math.min(10, Math.max(1, level));
}

export function isStableCatalogCode(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
