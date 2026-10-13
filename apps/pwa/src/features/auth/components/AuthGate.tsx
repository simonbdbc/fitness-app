import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { readDisplaySessionRoute } from "@shared/navigation/displaySessionRoute";
import { ActionButton, BodyText, Card, CardHeader, ScreenShell, TitleText } from "@shared/ui";
import { useAuth } from "../providers/AuthProvider";

export function AuthGate({ children }: PropsWithChildren) {
  const { session, isLoading, isSubmitting, error, signIn } = useAuth();
  if (isLoading) return <ScreenShell><BodyText>Chargement de la démonstration…</BodyText></ScreenShell>;
  if (session) return <>{children}</>;
  return <ScreenShell><View className="gap-4">
    <TitleText>ACREA Fitness — Démonstration</TitleText>
    <BodyText>Évaluation en trois séances, six exercices et minuteur. Profil fictif et données enregistrées uniquement dans ce navigateur.</BodyText>
    <Card><CardHeader title="Connexion" description="Aucun compte, mot de passe ou service distant nécessaire." />
      {error ? <BodyText>{error}</BodyText> : null}
      <ActionButton disabled={isSubmitting} onPress={() => void signIn({email:"demo@example.test",password:"local-demo"})}>
        {isSubmitting ? "Ouverture…" : "Continuer en session locale"}
      </ActionButton>
    </Card>
  </View></ScreenShell>;
}

export function AuthenticatedRedirect() {
  const { canAccessAdminCatalog, user } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTarget(null);
    if (!user?.id) {
      setTarget("/home");
      return () => {
        active = false;
      };
    }

    void readDisplaySessionRoute({
      canAccessAdminCatalog,
      userId: user.id,
    }).then((pathname) => {
      if (active) setTarget(pathname ?? "/home");
    });

    return () => {
      active = false;
    };
  }, [canAccessAdminCatalog, user?.id]);

  return (
    <AuthGate>
      {target ? <Redirect href={target as never} /> : null}
    </AuthGate>
  );
}

