import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  defaultThemeName,
  type ThemeFamily,
  type ThemeMode,
  type ThemeName,
  type ThemeTokens,
  themeTokensByName,
} from "./tokens";

export type { ThemeFamily, ThemeMode, ThemeName, ThemeTokens } from "./tokens";

type ThemeContextValue = {
  themeFamily: ThemeFamily;
  themeMode: ThemeMode;
  themeName: ThemeName;
  tokens: ThemeTokens;
  setThemeFamily: (themeFamily: ThemeFamily) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setThemeName: (themeName: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStorageKey = "acrea-fitness.theme";

type ThemeColorMetaElement = {
  setAttribute: (name: string, value: string) => void;
};

type ThemeColorDocument = {
  querySelector: (selector: string) => ThemeColorMetaElement | null;
};

function updateWebThemeColor(themeColor: string) {
  if (Platform.OS !== "web") {
    return;
  }

  const maybeDocument = (
    globalThis as typeof globalThis & { document?: ThemeColorDocument }
  ).document;
  const themeColorMeta = maybeDocument?.querySelector(
    'meta[name="theme-color"]',
  );

  themeColorMeta?.setAttribute("content", themeColor);
}

function isThemeName(value: string | null): value is ThemeName {
  return Boolean(value && value in themeTokensByName);
}

function storedThemeNameToThemeName(value: string | null): ThemeName {
  if (isThemeName(value)) {
    return value;
  }

  if (value === "dark") {
    return "pulse-dark";
  }

  if (value === "light") {
    return "pulse-light";
  }

  return defaultThemeName;
}

function themeNameFromParts(
  themeFamily: ThemeFamily,
  themeMode: ThemeMode,
): ThemeName {
  return `${themeFamily}-${themeMode}` as ThemeName;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeName, setThemeNameState] = useState<ThemeName>(defaultThemeName);
  const [hasLoadedStoredTheme, setHasLoadedStoredTheme] = useState(false);
  const hasReceivedExplicitThemeRef = useRef(false);
  const tokens = themeTokensByName[themeName];

  const setThemeName = useCallback((nextThemeName: ThemeName) => {
    hasReceivedExplicitThemeRef.current = true;
    setThemeNameState(nextThemeName);
  }, []);

  const setThemeFamily = useCallback((nextThemeFamily: ThemeFamily) => {
    hasReceivedExplicitThemeRef.current = true;
    setThemeNameState((currentThemeName) =>
      themeNameFromParts(
        nextThemeFamily,
        themeTokensByName[currentThemeName].mode,
      ),
    );
  }, []);

  const setThemeMode = useCallback((nextThemeMode: ThemeMode) => {
    hasReceivedExplicitThemeRef.current = true;
    setThemeNameState((currentThemeName) =>
      themeNameFromParts(
        themeTokensByName[currentThemeName].family,
        nextThemeMode,
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(themeStorageKey)
      .then((storedThemeName) => {
        if (!cancelled && !hasReceivedExplicitThemeRef.current) {
          setThemeNameState(storedThemeNameToThemeName(storedThemeName));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHasLoadedStoredTheme(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredTheme) {
      return;
    }

    void AsyncStorage.setItem(themeStorageKey, themeName);
  }, [hasLoadedStoredTheme, themeName]);

  useEffect(() => {
    updateWebThemeColor(tokens.colors.background);
  }, [tokens.colors.background]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeFamily: tokens.family,
      themeMode: tokens.mode,
      themeName,
      tokens,
      setThemeFamily,
      setThemeMode,
      setThemeName,
      toggleTheme: () => {
        hasReceivedExplicitThemeRef.current = true;
        setThemeNameState((currentThemeName) => {
          const currentTokens = themeTokensByName[currentThemeName];

          return themeNameFromParts(
            currentTokens.family,
            currentTokens.mode === "light" ? "dark" : "light",
          );
        });
      },
    }),
    [setThemeFamily, setThemeMode, setThemeName, themeName, tokens],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return theme;
}

export function useThemeTokens() {
  return useTheme().tokens;
}
