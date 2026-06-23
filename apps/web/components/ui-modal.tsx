"use client";

import { useEffect, type ReactNode } from "react";

const onEscape = (callback: () => void) => (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    callback();
  }
};

export const UiModal = ({
  open,
  onClose,
  title,
  children,
  footer,
  widthClassName = "max-w-lg"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = onEscape(onClose);
    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 sm:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-auto w-full ${widthClassName} rounded-2xl border border-line bg-white p-5 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2 py-1 text-xs text-mid hover:bg-line"
          >
            Cerrar
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
};
