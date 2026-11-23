import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { ToastContext } from "@/context/toast";
import { cn } from "@/utils/cn";

type ToastTone = "info" | "success" | "error";

interface ToastAction {
  label: string;
  onAction: () => void;
}

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: ToastAction;
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", action }: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { id, title, description, tone, action }]);
      const timer = window.setTimeout(
        () => dismiss(id),
        tone === "error" || action ? 6500 : 4200,
      );
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom,0px))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => {
          const Icon = item.tone === "success" ? Check : item.tone === "error" ? AlertCircle : Info;
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control px-4 py-3 text-on-accent shadow-xl animate-fade-up",
                item.tone === "error" ? "bg-[var(--bad)]" : item.tone === "success" ? "bg-[var(--good)]" : "bg-solid",
              )}
              role="status"
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-xs leading-5 text-on-accent/75">{item.description}</p> : null}
              </div>
              {item.action ? (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.onAction();
                    dismiss(item.id);
                  }}
                  className="shrink-0 self-center rounded-lg px-2 py-1 text-xs font-extrabold text-on-accent/90 transition hover:bg-on-accent/10 hover:text-on-accent"
                >
                  {item.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 -mt-1 rounded-lg p-1 text-on-accent/60 transition hover:bg-on-accent/10 hover:text-on-accent"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

