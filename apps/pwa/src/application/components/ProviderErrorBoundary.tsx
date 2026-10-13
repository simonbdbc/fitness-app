import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { reportTechnicalError } from "@shared/observability/technicalDiagnostics";

type ProviderErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  scope: string;
};

type ProviderErrorBoundaryState = {
  failed: boolean;
};

export class ProviderErrorBoundary extends Component<
  ProviderErrorBoundaryProps,
  ProviderErrorBoundaryState
> {
  state: ProviderErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ProviderErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportTechnicalError(this.props.scope, error, {
      componentStack: info.componentStack ?? "indisponible",
    });
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
