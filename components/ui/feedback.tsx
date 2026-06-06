"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/* ---------------- Toasts ---------------- */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  info: (m: string) => useToastStore.getState().push("info", m),
};

const TOAST_ICON = {
  success: <CheckCircle2 size={16} className="text-emerald-500" />,
  error: <AlertCircle size={16} className="text-destructive" />,
  info: <Info size={16} className="text-primary" />,
};

/* ---------------- Confirm dialog ---------------- */

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = {
  opts: ConfirmOpts | null;
  resolve: ((v: boolean) => void) | null;
  open: (opts: ConfirmOpts) => Promise<boolean>;
  close: (v: boolean) => void;
};

const useConfirmStore = create<ConfirmState>((set, get) => ({
  opts: null,
  resolve: null,
  open: (opts) =>
    new Promise<boolean>((resolve) => set({ opts, resolve })),
  close: (v) => {
    get().resolve?.(v);
    set({ opts: null, resolve: null });
  },
}));

export function confirm(opts: ConfirmOpts) {
  return useConfirmStore.getState().open(opts);
}

/* ---------------- Mounted UI (place once in layout) ---------------- */

export function Feedback() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const { opts, close } = useConfirmStore();

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="flex items-start gap-2.5 glass-strong rounded-lg px-3.5 py-3 text-sm text-foreground animate-in fade-in slide-in-from-top-2"
          >
            <span className="mt-0.5 shrink-0">{TOAST_ICON[t.kind]}</span>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="ปิด" className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm */}
      {opts && (
        <div
          className="fixed inset-0 z-[110] bg-black/30 flex items-center justify-center p-4"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="glass-strong w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">{opts.title}</p>
            {opts.message && <p className="text-sm text-muted-foreground mt-1.5">{opts.message}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => close(false)}
                className="flex-1 border border-border text-muted-foreground py-2 rounded-lg text-sm hover:bg-accent"
              >
                {opts.cancelLabel ?? "ยกเลิก"}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium text-white ${
                  opts.danger ? "bg-destructive hover:opacity-90" : "bg-primary hover:bg-primary/90"
                }`}
              >
                {opts.confirmLabel ?? "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
