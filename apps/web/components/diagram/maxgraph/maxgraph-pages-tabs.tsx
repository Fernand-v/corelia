import type { PagesTabsProps } from "@/components/diagram/maxgraph/types";

export const MaxGraphPagesTabs = ({
  document,
  readOnly,
  onAdd,
  onRename,
  onDuplicate,
  onRemove,
  onSetActive
}: PagesTabsProps) => {
  return (
    <footer className="flex h-12 items-center gap-2 overflow-x-auto border-t border-[#e2e8f2] bg-white px-3">
      {document.pages.map((page) => {
        const active = page.id === document.activePageId;

        return (
          <div
            key={page.id}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
              active ? "border-line bg-paper" : "border-line bg-white"
            }`}
          >
            <button
              type="button"
              className="max-w-[140px] truncate text-xs font-semibold text-ink"
              onClick={() => onSetActive(page.id)}
            >
              {page.name}
            </button>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-mid hover:bg-line"
                  onClick={() => onRename(page.id)}
                  title="Renombrar"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-mid hover:bg-line"
                  onClick={() => onDuplicate(page.id)}
                  title="Duplicar"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-urgent hover:bg-urgent-muted"
                  onClick={() => onRemove(page.id)}
                  title="Eliminar"
                  disabled={document.pages.length <= 1}
                >
                  ×
                </button>
              </>
            ) : null}
          </div>
        );
      })}

      {!readOnly ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-7 items-center justify-center rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink hover:bg-line"
          title="Nueva página"
        >
          +
        </button>
      ) : null}
    </footer>
  );
};
