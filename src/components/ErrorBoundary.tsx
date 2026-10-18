import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/perf';

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the route), the boundary resets itself. */
  resetKey?: unknown;
  label?: string;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

/**
 * Error boundaries must be class components. We use two layers: one around the
 * whole app (last resort) and one around each route so a crash while reading
 * never takes the library down with it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-3xl" aria-hidden>
          ⚠️
        </div>
        <h2 className="text-lg font-semibold">{this.props.label ?? 'Something went wrong'}</h2>
        <p className="text-sm text-muted">
          {error.message || 'An unexpected error occurred.'} Your library and highlights are safe — they’re stored on this device.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={this.reset}>
            Try again
          </button>
          <button className="btn-outline" onClick={() => (window.location.hash = '#/')}>
            Back to library
          </button>
        </div>
      </div>
    );
  }
}
