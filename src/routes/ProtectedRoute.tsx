import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Splash } from "@/components/common/Splash";
import { ErrorState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user, error, retry, logout } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Splash label="Restoring your session" />;
  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6">
        <ErrorState error={new Error(error || "Could not restore your session.")} onRetry={retry} />
        <button type="button" className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-transparent text-ink hover:[&:not(:disabled)]:bg-ink-5 -mt-6" onClick={() => void logout()}>
          Sign out instead
        </button>
      </div>
    );
  }
  if (status !== "authenticated" || !user) {
    // **A public page is public at the address people share.**
    //
    // The owner, 2026-11-22: *"xelvic.com/profile/its_me public profile hai to
    // khul jaani chahiye — abhi login pe redirect kar raha. Instagram,
    // Facebook hote hain — Google me link aa jaata hai, andar kuch action
    // karo tab login mange."* So the signed-in app's own addresses open their
    // read-only page for a stranger instead of bouncing to sign-in; every
    // action on that page still leads to `/signin?next=<this address>`.
    const path = location.pathname.replace(/\/+$/, "");
    if (/^\/profile\/[^/]+$/.test(path)) {
      return <Navigate to={`/u/${path.split("/")[2]}`} replace />;
    }
    if (/^\/drops\/[^/]+$/.test(path) && !path.startsWith("/drops/vibes")) {
      return <Navigate to={`/d/${path.split("/")[2]}`} replace />;
    }
    if (/^\/vibes\/[^/]+$/.test(path)) {
      return <Navigate to={`/v/${path.split("/")[2]}`} replace />;
    }
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Splash label="Restoring your session" />;
  if (status === "authenticated") return <Navigate to="/drops" replace />;
  return <>{children}</>;
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-dim">404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">This page is not here</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-dim">The address may be old, or the thing it pointed at is gone.</p>
      <Link to="/" className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-transparent bg-accent text-on-accent hover:[&:not(:disabled)]:brightness-105 mt-6">
        Back to Xelvic
      </Link>
    </div>
  );
}
