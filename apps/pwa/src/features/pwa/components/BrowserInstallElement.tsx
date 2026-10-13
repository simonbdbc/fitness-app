import type { PropsWithChildren } from "react";

type BrowserInstallElementProps = PropsWithChildren<{
  enabled?: boolean;
}>;

export function BrowserInstallElement({ children }: BrowserInstallElementProps) {
  return children;
}
