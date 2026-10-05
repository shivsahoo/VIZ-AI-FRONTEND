import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  /** Changing this (e.g. the current tab) clears a previous error. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a crashing page from taking down the whole app: the sidebar and header
 * stay usable and the user can retry or navigate elsewhere.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="ws-page">
        <div className="ws-empty" role="alert">
          <span className="ws-empty-icon" style={{ background: "color-mix(in srgb, var(--destructive) 12%, transparent)", color: "var(--destructive)" }}>
            <AlertTriangle className="w-7 h-7" aria-hidden="true" />
          </span>
          <p className="ws-empty-title">This page ran into a problem</p>
          <p className="ws-empty-text">
            Something in the data didn't look the way the page expected. You can try again or pick another page from the sidebar.
          </p>
          <button
            type="button"
            className="home-btn home-btn--primary"
            onClick={() => this.setState({ error: null })}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
