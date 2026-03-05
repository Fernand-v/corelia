export type MaxGraphContextMenuState = {
  open: boolean;
  x: number;
  y: number;
};

export const MaxGraphContextMenu = ({
  state,
  onClose,
  onEditStyle,
  onEditData,
  onSelectConnected,
  onSelectSameType,
  onGroup,
  onBringToFront,
  onSendToBack,
  onLockToggle,
  onCopyStyle,
  onPasteStyle,
  onDelete
}: {
  state: MaxGraphContextMenuState;
  onClose: () => void;
  onEditStyle: () => void;
  onEditData: () => void;
  onSelectConnected: () => void;
  onSelectSameType: () => void;
  onGroup: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onLockToggle: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  onDelete: () => void;
}) => {
  if (!state.open) {
    return null;
  }

  const Item = ({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) => (
    <button
      type="button"
      className={`w-full rounded px-2 py-1 text-left text-xs transition hover:bg-slate-100 ${
        danger ? "text-red-600" : "text-slate-700"
      }`}
      onClick={() => {
        onClick();
        onClose();
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="absolute z-40 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
      style={{ left: state.x, top: state.y }}
      onMouseLeave={onClose}
    >
      <Item label="Editar estilo" onClick={onEditStyle} />
      <Item label="Editar datos" onClick={onEditData} />
      <Item label="Seleccionar conectados" onClick={onSelectConnected} />
      <Item label="Seleccionar mismo tipo" onClick={onSelectSameType} />
      <Item label="Agrupar" onClick={onGroup} />
      <Item label="Traer al frente" onClick={onBringToFront} />
      <Item label="Enviar al fondo" onClick={onSendToBack} />
      <Item label="Bloquear/Desbloquear" onClick={onLockToggle} />
      <Item label="Copiar estilo" onClick={onCopyStyle} />
      <Item label="Pegar estilo" onClick={onPasteStyle} />
      <Item label="Eliminar" onClick={onDelete} danger />
    </div>
  );
};
