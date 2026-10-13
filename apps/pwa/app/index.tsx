import { Redirect } from "expo-router";

import { useAuth } from "@features/auth";

export default function IndexRoute() {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) return null;
  if (!accessToken) return <Redirect href="/login" />;

  return <Redirect href="/home" />;
}
