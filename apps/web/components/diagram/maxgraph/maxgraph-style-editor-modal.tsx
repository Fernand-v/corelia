import { useEffect, useState } from "react";

import { UiModal } from "@/components/ui-modal";

export const styleObjectToString = (style: Record<string, unknown>): string =>
  Object.entries(style)
    .map(([key, value]) => `${key}=${String(value)};`)
    .join("");

export const styleStringToObject = (input: string): Record<string, string> => {
  const output: Record<string, string> = {};

  input
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const [rawKey, ...rawValue] = chunk.split("=");
      const key = rawKey?.trim();
      const value = rawValue.join("=").trim();
      if (!key) {
        return;
      }
      output[key] = value;
    });

  return output;
};

export const MaxGraphStyleEditorModal = ({
  open,
  style,
  onClose,
  onApply,
  onReset
}: {
  open: boolean;
  style: Record<string, unknown>;
  onClose: () => void;
  onApply: (style: Record<string, string>) => void;
  onReset: () => void;
}) => {
  const [draft, setDraft] = useState(styleObjectToString(style));

  useEffect(() => {
    setDraft(styleObjectToString(style));
  }, [style]);

  return (
    <UiModal open={open} onClose={onClose} title="Editor de estilo avanzado" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Edita el style string (draw.io/maxGraph): <code>rounded=1;fillColor=#dae8fc;</code>
        </p>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={8}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-blue-400"
        />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview parseado</p>
          <pre className="mt-1 max-h-40 overflow-auto text-[11px] text-slate-700">
            {JSON.stringify(styleStringToObject(draft), null, 2)}
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Restablecer
          </button>
          <button
            type="button"
            onClick={() => onApply(styleStringToObject(draft))}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Aplicar
          </button>
        </div>
      </div>
    </UiModal>
  );
};
