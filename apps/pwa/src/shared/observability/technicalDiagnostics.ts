export type TechnicalDiagnostic = {
  context?: Readonly<Record<string, string | number | boolean | null>>;
  message: string;
  occurredAt: string;
  scope: string;
};

const maximumRecentDiagnostics = 50;
const recentDiagnostics: TechnicalDiagnostic[] = [];
const reportedDegradationScopes = new Set<string>();

export function reportTechnicalError(
  scope: string,
  error: unknown,
  context?: TechnicalDiagnostic["context"],
): TechnicalDiagnostic {
  const diagnostic = createTechnicalDiagnostic(scope, error, context);
  rememberTechnicalDiagnostic(diagnostic);
  console.error(`[${scope}] ${diagnostic.message}`, context ?? {});
  return diagnostic;
}

export function reportTechnicalDegradation(
  scope: string,
  error: unknown,
  context?: TechnicalDiagnostic["context"],
): TechnicalDiagnostic {
  const diagnostic = createTechnicalDiagnostic(scope, error, context);
  rememberTechnicalDiagnostic(diagnostic);
  console.warn(`[${scope}] ${diagnostic.message}`, context ?? {});
  return diagnostic;
}

export function reportTechnicalDegradationOnce(
  scope: string,
  error: unknown,
  context?: TechnicalDiagnostic["context"],
): TechnicalDiagnostic | null {
  if (reportedDegradationScopes.has(scope)) return null;
  reportedDegradationScopes.add(scope);
  return reportTechnicalDegradation(scope, error, context);
}

export function getRecentTechnicalDiagnostics(): readonly TechnicalDiagnostic[] {
  return [...recentDiagnostics];
}

export function clearRecentTechnicalDiagnostics(): void {
  recentDiagnostics.length = 0;
  reportedDegradationScopes.clear();
}

function createTechnicalDiagnostic(
  scope: string,
  error: unknown,
  context?: TechnicalDiagnostic["context"],
): TechnicalDiagnostic {
  return {
    context,
    message: technicalErrorMessage(error),
    occurredAt: new Date().toISOString(),
    scope,
  };
}

function rememberTechnicalDiagnostic(diagnostic: TechnicalDiagnostic): void {
  recentDiagnostics.push(diagnostic);
  if (recentDiagnostics.length > maximumRecentDiagnostics) {
    recentDiagnostics.shift();
  }
}

function technicalErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Erreur technique sans détail exploitable.";
}
