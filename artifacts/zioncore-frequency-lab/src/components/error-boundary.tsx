import React, {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { isChunkLoadError } from '@/lib/chunk-load-error';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

export function ZionCoreErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const chunkFailed = isChunkLoadError(error);
  return (
    <main className="page-wrap" role="alert" aria-labelledby="zioncore-recovery-title" data-testid="panel-display-recovery">
      <section className="panel" style={{ maxWidth: 660, margin: '36px auto', padding: 28 }}>
        <div className="eyebrow">ZIONCORE / RECOVERY</div>
        <h1 id="zioncore-recovery-title" className="page-title" style={{ fontSize: 34 }}>
          {chunkFailed ? 'This instrument could not load.' : 'ZionCore hit a display problem.'}
        </h1>
        <p>{chunkFailed
          ? 'A page download failed or no longer matches the current site version. Check your connection, then reload ZionCore to request a fresh page.'
          : 'This view could not be displayed. You can try rendering it again, reload the page, or return to the listening lab.'}</p>
        <p className="permission-note">Reloading or leaving this page can discard unsaved recordings and edits. These recovery controls do not erase saved browser records or start a new purchase.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          <button className="btn btn-primary" style={{ padding: '12px 16px' }} type="button" onClick={() => window.location.reload()} data-testid="button-reload-zioncore">Reload ZionCore</button>
          {!chunkFailed && <button className="btn btn-subtle" style={{ padding: '12px 16px' }} type="button" onClick={resetError} data-testid="button-retry-view">Try rendering again</button>}
          <a className="btn btn-subtle" style={{ padding: '12px 16px' }} href={import.meta.env?.BASE_URL ?? '/'} data-testid="link-error-lab">Return to lab</a>
        </div>
        <p className="permission-note" style={{ marginTop: 20 }}>If a reading was already submitted, use its existing recovery flow rather than starting another paid request. Its processing or payment status may still be unresolved.</p>
      </section>
    </main>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env?.DEV) {
      console.error('ErrorBoundary caught an error:', toError(error), info.componentStack);
    } else {
      console.error('ZionCore caught a display error. Recovery controls are available.');
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? ZionCoreErrorFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
