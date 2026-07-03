import { Component, type ReactNode } from "react";
import { WidgetError } from "@/components/dashboard/WidgetPrimitives";

interface State { error: Error | null }

export class FinancialErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[FinancialWidget]", error); }
  render() {
    if (this.state.error) {
      return <WidgetError message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
