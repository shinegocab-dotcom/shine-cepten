import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class DriverErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const rawMsg = error instanceof Error ? error.message : String(error);
    let friendly = rawMsg;
    try {
      const parsed = JSON.parse(rawMsg) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        friendly = `Database access error (${parsed.operationType || 'sync'} on ${parsed.path || 'record'}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, errorMessage: friendly };
  }

  componentDidCatch(error: unknown) {
    console.error('SHINE CAPTAIN ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-[#1E1E1E] p-5 text-white">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#14161A] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600/20 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-display text-lg font-extrabold text-white">
              SHINE CAPTAIN Recovery
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300">
              {this.state.errorMessage || 'An unexpected interruption occurred.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#F5C518] px-4 text-sm font-extrabold text-[#1E1E1E]"
            >
              <RefreshCw className="h-4 w-4" />
              Reload SHINE CAPTAIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
