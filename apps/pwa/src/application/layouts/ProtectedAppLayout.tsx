import { Redirect, Slot, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@features/auth";
import { writeDisplaySessionRoute } from "@shared/navigation/displaySessionRoute";
import { routeByView, viewFromPathname } from "../navigation/routes";
import { AppLayout } from "./AppLayout";

export function ProtectedAppLayout() {
  const { accessToken, canAccessAdminCatalog, isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const activeView = viewFromPathname(pathname);

  useEffect(() => {
    if (!accessToken || !user?.id || isLoading) return;
    void writeDisplaySessionRoute(user.id, pathname);
  }, [accessToken, isLoading, pathname, user?.id]);

  if (isLoading) {
    return null;
  }

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  if (isAdminView(activeView) && !canAccessAdminCatalog) {
    return <Redirect href="/home" />;
  }

  return (
    <AppLayout
      activeView={activeView}
      onViewChange={(view) => {
        router.push(routeByView[view]);
      }}
    >
      <Slot />
    </AppLayout>
  );
}

function isAdminView(activeView: ReturnType<typeof viewFromPathname>) {
  return activeView.startsWith("adminCatalog");
}
