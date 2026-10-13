import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

import {
  defaultThemeName,
  themeTokensByName,
} from "@shared/theme/tokens";

const initialThemeColor = themeTokensByName[defaultThemeName].colors.background;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={initialThemeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ACREA Fitness" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="application-name" content="ACREA Fitness" />
        <meta name="description" content="Programme ACREA Fitness offline-first." />
        <link rel="canonical" href="https://app.acrea-fitness.fr/" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/app-icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script src="/install-prompt-bridge.js" />
        <title>ACREA Fitness</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
