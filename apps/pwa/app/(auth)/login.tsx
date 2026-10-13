import { AuthenticatedRedirect } from "@features/auth";

export default function LoginRoute() {
  return <AuthenticatedRedirect />;
}
