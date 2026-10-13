import {
  createElement,
  type PropsWithChildren,
  useEffect,
  useRef,
} from "react";

import { trackPwaEvent } from "../services/pwaAnalytics";

type BrowserInstallElementProps = PropsWithChildren<{
  enabled?: boolean;
}>;

type InstallElement = HTMLElement & {
  invalidReason?: string;
};

export function BrowserInstallElement({
  children,
  enabled = true,
}: BrowserInstallElementProps) {
  const installElementRef = useRef<InstallElement | null>(null);
  const isSupported =
    typeof window !== "undefined" && "HTMLInstallElement" in window;

  useEffect(() => {
    const installElement = installElementRef.current;
    if (!installElement) return undefined;

    const handlePromptAction = () => {
      trackPwaEvent("pwa_install_element_action");
    };
    const handlePromptDismiss = () => {
      trackPwaEvent("pwa_install_element_dismissed");
    };
    const handleValidationStatusChanged = () => {
      if (!installElement.invalidReason) return;
      trackPwaEvent("pwa_install_element_validation_error", {
        reason: installElement.invalidReason,
      });
    };

    installElement.addEventListener("promptaction", handlePromptAction);
    installElement.addEventListener("promptdismiss", handlePromptDismiss);
    installElement.addEventListener(
      "validationstatuschanged",
      handleValidationStatusChanged,
    );

    return () => {
      installElement.removeEventListener("promptaction", handlePromptAction);
      installElement.removeEventListener(
        "promptdismiss",
        handlePromptDismiss,
      );
      installElement.removeEventListener(
        "validationstatuschanged",
        handleValidationStatusChanged,
      );
    };
  }, [isSupported]);

  if (!enabled || !isSupported) return children;

  return createElement("install", {
    "aria-label": "Installer ACREA Fitness",
    ref: installElementRef,
  });
}
