import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import type { TextInputProps, TextStyle } from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { readDisplaySessionRoute } from "@shared/navigation/displaySessionRoute";
import { ActionButton, BodyText, Card, CardHeader, ScreenShell, TitleText } from "@shared/ui";
import { getLegalLinks } from "@shared/legal/legalLinks";
import { useAuth } from "../providers/AuthProvider";

export function AuthGate({ children }: PropsWithChildren) {
  const {
    clearError,
    clearNotice,
    error,
    isConfigured,
    isLoading,
    isSubmitting,
    notice,
    session,
    signIn,
    signUp,
  } = useAuth();
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const legalLinks = getLegalLinks();

  if (isLoading) {
    return (
      <AuthShell>
        <AuthBrandHeader />
        <Card>
          <CardHeader
            title="Restauration de session"
            description="Vérification de l'accès au programme ACREA."
          />
        </Card>
      </AuthShell>
    );
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <AuthShell>
      <View className="w-full max-w-full min-w-0 gap-3">
        <AuthBrandHeader />

        {!isConfigured ? (
          <Card variant="info">
            <CardHeader
              title="Mode invité"
              description="Tu peux tester l'application avec une session locale."
            />
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Connexion"
            description="Accéder à l’évaluation de niveau, au profil et au programme de la semaine."
          />

          {notice ? (
            <BodyText style={{ color: tokens.colors.successText }}>
              {notice}
            </BodyText>
          ) : null}
          {error ? (
            <BodyText style={{ color: tokens.colors.dangerText }}>
              {error}
            </BodyText>
          ) : null}
          {localError ? (
            <BodyText style={{ color: tokens.colors.dangerText }}>
              {localError}
            </BodyText>
          ) : null}

          {isConfigured ? (
            <View className="w-full max-w-full min-w-0 gap-3">
              <AuthInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="email"
                style={{
                  backgroundColor: tokens.colors.surfaceElevated,
                  borderColor: tokens.colors.border,
                  borderRadius: designTheme.radii.control,
                  color: tokens.colors.textPrimary,
                }}
                textContentType="emailAddress"
                value={email}
              />
              <AuthInput
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="mot de passe"
                secureTextEntry
                style={{
                  backgroundColor: tokens.colors.surfaceElevated,
                  borderColor: tokens.colors.border,
                  borderRadius: designTheme.radii.control,
                  color: tokens.colors.textPrimary,
                }}
                textContentType="password"
                value={password}
              />
              <View className="w-full max-w-full min-w-0 flex-row flex-wrap gap-2">
                <ActionButton
                  className="min-w-[148px] flex-1"
                  disabled={isSubmitting}
                  onPress={() => {
                    const credentials = buildCredentials(email, password);
                    if (!credentials) {
                      setLocalError("Email et mot de passe sont requis.");
                      return;
                    }

                    setLocalError(null);
                    clearError();
                    clearNotice();
                    void signIn(credentials);
                  }}
                  variant="primary"
                >
                  {isSubmitting ? "Connexion..." : "Se connecter"}
                </ActionButton>
                <ActionButton
                  className="min-w-[148px] flex-1"
                  disabled={isSubmitting}
                  onPress={() => {
                    const credentials = buildCredentials(email, password);
                    if (!credentials) {
                      setLocalError("Email et mot de passe sont requis.");
                      return;
                    }

                    setLocalError(null);
                    clearError();
                    clearNotice();
                    void signUp(credentials);
                  }}
                  variant="secondary"
                >
                  Créer un compte
                </ActionButton>
              </View>
              <View className="w-full max-w-full min-w-0 gap-1 pt-1">
                <BodyText>
                  En créant un compte, vous reconnaissez avoir lu les conditions
                  générales d'utilisation et la politique de confidentialité.
                </BodyText>
                <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                  <LegalLink url={legalLinks.terms}>Conditions générales</LegalLink>
                  <LegalLink url={legalLinks.privacy}>Confidentialité</LegalLink>
                  <LegalLink url={legalLinks.cookies}>Cookies</LegalLink>
                </View>
              </View>
            </View>
          ) : (
            <ActionButton
              disabled={isSubmitting}
              onPress={() => {
                clearError();
                clearNotice();
                void signIn({
                  email: "demo@acrea.local",
                  password: "demo-session",
                });
              }}
              variant="primary"
            >
              {isSubmitting ? "Connexion..." : "Continuer en session locale"}
            </ActionButton>
          )}
        </Card>
      </View>
    </AuthShell>
  );
}

function LegalLink({ children, url }: PropsWithChildren<{ url: string }>) {
  const tokens = useThemeTokens();

  return (
    <Text
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={{
        color: tokens.colors.accent,
        fontSize: 14,
        fontWeight: "700",
        textDecorationLine: "underline",
      }}
    >
      {children}
    </Text>
  );
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

function AuthBrandHeader() {
  const tokens = useThemeTokens();

  return (
    <View className="w-full max-w-full min-w-0 gap-2 py-5">
      <TitleText className="text-[34px] leading-[38px]">
        ACREA Fitness
      </TitleText>
      <BodyText style={{ color: tokens.colors.accent }}>
        Poids du corps, niveaux, Cardio contrôlé et proprioception progressive.
      </BodyText>
    </View>
  );
}

function AuthShell({ children }: PropsWithChildren) {
  return <ScreenShell>{children}</ScreenShell>;
}

function AuthInput({
  style,
  ...props
}: TextInputProps & { style: TextStyle }) {
  return (
    <TextInput
      {...props}
      className="box-border w-full max-w-full min-w-0 border px-3 py-3 text-base"
      placeholderTextColor="#8f9aa8"
      style={style}
    />
  );
}

function buildCredentials(email: string, password: string) {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !password) {
    return null;
  }

  return {
    email: trimmedEmail,
    password,
  };
}
