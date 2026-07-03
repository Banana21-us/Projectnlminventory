"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  detail?: string;
}

const ToastContext = createContext<((t: Omit<Toast, "id">) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  error: <TriangleAlert className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-brand" />,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-surface p-4 shadow-lg ring-1 ring-black/5"
            >
              {ICONS[t.kind]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-sm text-ink-soft">{t.detail}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-md p-1 text-ink-faint hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
