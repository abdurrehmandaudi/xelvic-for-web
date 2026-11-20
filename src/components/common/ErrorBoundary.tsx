import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandMark } from "@/components/icons/Brand";
import { claimRetry, isBrokenTree, retriedRecently } from "./recover";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  recovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error) {
    return { error, recovering: isBrokenTree(error) && !retriedRecently() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Xelvic render error", error, info.componentStack);
    if (!this.state.recovering) return;
    if (claimRetry()) {
      window.location.reload();
      return;
    }
    this.setState({ recovering: false });
  }

  render() {
    if (this.state.error && this.state.recovering) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
          <BrandMark size={52} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Putting this screen back together
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-dim">
              React lost the thread of this screen, which nothing on the page can repair. Reloading
              it once for you.
            </p>
          </div>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
          <BrandMark size={52} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Something broke on this screen</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-dim">
              The rest of Xelvic is still here. Reload the page and try again.
            </p>
            <pre className="mt-4 max-w-md overflow-auto rounded-xl bg-black/5 p-3 text-left text-[11px] text-dim">
              {this.state.error.message}
            </pre>
          </div>
          <button type="button" className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-transparent bg-accent text-on-accent hover:[&:not(:disabled)]:brightness-105" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
