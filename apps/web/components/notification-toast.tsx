"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastItem = {
  id: string;
  title: string;
  body: string;
  priority: string;
  createdAt: number;
};

const TOAST_DURATION_MS = 5000;
const TOAST_MAX_VISIBLE = 3;

const summarizeBody = (body: string, maxLength = 100) => {
  const compact = body
    .replace(/\s*Ruta:\s*\/\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact || compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
};

export const useNotificationToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((payload: { title: string; body: string; priority: string }) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}-${Date.now()}`;

    setToasts((current) => {
      const next = [...current, { ...payload, id, createdAt: Date.now() }];
      return next.slice(-TOAST_MAX_VISIBLE);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
};

export const NotificationToastContainer = ({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <NotificationToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const NotificationToast = ({
  toast,
  onDismiss
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, TOAST_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onDismiss, toast.id]);

  const isUrgent = toast.priority === "URGENTE";
  const borderColor = isUrgent ? "border-rose-300" : "border-accent/30";
  const accentBar = isUrgent ? "bg-rose-500" : "bg-accent";

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${borderColor} bg-white shadow-lg transition-all duration-300 ${
        exiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
      }`}
      role="alert"
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} />
      <div className="flex items-start gap-3 py-3 pl-4 pr-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 leading-snug">{toast.title}</p>
          {toast.body ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {summarizeBody(toast.body)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
          className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar notificación"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
