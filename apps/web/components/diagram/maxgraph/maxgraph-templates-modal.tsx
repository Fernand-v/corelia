import type { DiagramKind } from "@corelia/types";

import { UiModal } from "@/components/ui-modal";

export type DiagramTemplatePreset = {
  id: string;
  name: string;
  description: string;
  nodes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    value: string;
    style: Record<string, string | number | boolean>;
  }>;
};

const TEMPLATE_PRESETS: Record<DiagramKind, DiagramTemplatePreset[]> = {
  FLUJO: [
    {
      id: "login-flow",
      name: "Login flow",
      description: "Inicio, validación, acceso",
      nodes: [
        { x: 80, y: 120, width: 140, height: 50, value: "Start", style: { shape: "ellipse", fillColor: "#10b981", strokeColor: "#059669", fontColor: "#ffffff" } },
        { x: 300, y: 110, width: 200, height: 70, value: "Validar credenciales", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } },
        { x: 570, y: 95, width: 120, height: 120, value: "¿Válido?", style: { shape: "rhombus", fillColor: "#fbbf24", strokeColor: "#d97706" } }
      ]
    },
    {
      id: "checkout",
      name: "Checkout process",
      description: "Flujo checkout ecommerce",
      nodes: [
        { x: 90, y: 120, width: 180, height: 70, value: "Carrito", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } },
        { x: 360, y: 120, width: 180, height: 70, value: "Pago", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } },
        { x: 630, y: 120, width: 180, height: 70, value: "Confirmación", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } }
      ]
    },
    {
      id: "cicd",
      name: "CI/CD pipeline",
      description: "Pipeline simple",
      nodes: [
        { x: 100, y: 120, width: 170, height: 70, value: "Build", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } },
        { x: 360, y: 120, width: 170, height: 70, value: "Test", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } },
        { x: 620, y: 120, width: 170, height: 70, value: "Deploy", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } }
      ]
    }
  ],
  SECUENCIA: [
    {
      id: "rest-api",
      name: "REST API call",
      description: "Cliente -> API -> DB",
      nodes: [
        { x: 90, y: 80, width: 100, height: 120, value: "Cliente", style: { shape: "umlActor", strokeColor: "#4f6ef7" } },
        { x: 320, y: 90, width: 160, height: 80, value: "API", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } },
        { x: 590, y: 90, width: 160, height: 80, value: "DB", style: { shape: "cylinder", fillColor: "#336791", strokeColor: "#234a67", fontColor: "#ffffff" } }
      ]
    },
    {
      id: "auth-flow",
      name: "Auth flow",
      description: "Flujo de autenticación",
      nodes: [
        { x: 90, y: 80, width: 100, height: 120, value: "Usuario", style: { shape: "umlActor", strokeColor: "#4f6ef7" } },
        { x: 330, y: 90, width: 180, height: 80, value: "Auth Service", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#8b5cf6" } }
      ]
    },
    {
      id: "microservices",
      name: "Microservices",
      description: "Interacción de servicios",
      nodes: [
        { x: 120, y: 90, width: 170, height: 80, value: "Gateway", style: { rounded: 1, fillColor: "#eff6ff", strokeColor: "#3b82f6" } },
        { x: 380, y: 90, width: 170, height: 80, value: "Service A", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } },
        { x: 640, y: 90, width: 170, height: 80, value: "Service B", style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981" } }
      ]
    }
  ],
  UML_CLASES: [
    {
      id: "mvc",
      name: "MVC básico",
      description: "Model/View/Controller",
      nodes: [
        { x: 90, y: 100, width: 220, height: 140, value: "Controller", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } },
        { x: 370, y: 100, width: 220, height: 140, value: "Model", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } },
        { x: 650, y: 100, width: 220, height: 140, value: "View", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } }
      ]
    },
    {
      id: "repository",
      name: "Repository pattern",
      description: "Service + Repository",
      nodes: [
        { x: 120, y: 110, width: 240, height: 150, value: "UserService", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } },
        { x: 470, y: 110, width: 240, height: 150, value: "UserRepository", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } }
      ]
    },
    {
      id: "observer",
      name: "Observer",
      description: "Patrón observer",
      nodes: [
        { x: 110, y: 100, width: 230, height: 150, value: "Subject", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } },
        { x: 470, y: 100, width: 230, height: 150, value: "Observer", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981" } }
      ]
    }
  ],
  ENTIDAD_RELACION: [
    {
      id: "ecommerce-er",
      name: "E-commerce",
      description: "Users, Orders, Products",
      nodes: [
        { x: 80, y: 120, width: 220, height: 130, value: "users", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 380, y: 120, width: 220, height: 130, value: "orders", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 680, y: 120, width: 220, height: 130, value: "products", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } }
      ]
    },
    {
      id: "blog-er",
      name: "Blog",
      description: "Posts, Users, Comments",
      nodes: [
        { x: 120, y: 120, width: 220, height: 130, value: "users", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 430, y: 120, width: 220, height: 130, value: "posts", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 740, y: 120, width: 220, height: 130, value: "comments", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } }
      ]
    },
    {
      id: "auth-er",
      name: "Auth schema",
      description: "Users, sessions, roles",
      nodes: [
        { x: 140, y: 120, width: 220, height: 130, value: "users", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 460, y: 120, width: 220, height: 130, value: "sessions", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } },
        { x: 780, y: 120, width: 220, height: 130, value: "roles", style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316" } }
      ]
    }
  ],
  ESTADO: [
    {
      id: "order-state",
      name: "Order lifecycle",
      description: "Estado de orden",
      nodes: [
        { x: 90, y: 140, width: 24, height: 24, value: "", style: { shape: "ellipse", fillColor: "#000000", strokeColor: "#000000" } },
        { x: 220, y: 120, width: 180, height: 80, value: "Pendiente", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#f59e0b" } },
        { x: 470, y: 120, width: 180, height: 80, value: "Completado", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#10b981" } }
      ]
    },
    {
      id: "session-state",
      name: "User session",
      description: "Estado de sesión",
      nodes: [
        { x: 110, y: 130, width: 24, height: 24, value: "", style: { shape: "ellipse", fillColor: "#000000", strokeColor: "#000000" } },
        { x: 260, y: 115, width: 190, height: 90, value: "Activa", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } },
        { x: 540, y: 115, width: 190, height: 90, value: "Expirada", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#64748b" } }
      ]
    },
    {
      id: "payment-state",
      name: "Payment",
      description: "Estados de pago",
      nodes: [
        { x: 120, y: 120, width: 200, height: 90, value: "Creado", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7" } },
        { x: 420, y: 120, width: 200, height: 90, value: "Procesando", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#f59e0b" } },
        { x: 720, y: 120, width: 200, height: 90, value: "Fallido", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#ef4444" } }
      ]
    }
  ],
  ARQUITECTURA: [
    {
      id: "c4-webapp",
      name: "Web app básica",
      description: "Persona, sistema, DB",
      nodes: [
        { x: 80, y: 120, width: 220, height: 120, value: "Persona", style: { rounded: 1, fillColor: "#1168BD", strokeColor: "#0c4f95", fontColor: "#ffffff" } },
        { x: 390, y: 120, width: 260, height: 140, value: "Sistema Web", style: { rounded: 1, fillColor: "#438DD5", strokeColor: "#1168BD" } },
        { x: 760, y: 130, width: 220, height: 120, value: "DB", style: { shape: "cylinder", fillColor: "#336791", strokeColor: "#234a67", fontColor: "#ffffff" } }
      ]
    },
    {
      id: "c4-microservices",
      name: "Microservices",
      description: "Gateway + servicios",
      nodes: [
        { x: 100, y: 110, width: 240, height: 120, value: "API Gateway", style: { rounded: 1, fillColor: "#438DD5", strokeColor: "#1168BD" } },
        { x: 420, y: 110, width: 240, height: 120, value: "Service A", style: { rounded: 1, fillColor: "#85BBF0", strokeColor: "#438DD5" } },
        { x: 740, y: 110, width: 240, height: 120, value: "Service B", style: { rounded: 1, fillColor: "#85BBF0", strokeColor: "#438DD5" } }
      ]
    },
    {
      id: "c4-mobile",
      name: "Mobile + API",
      description: "App mobile + backend",
      nodes: [
        { x: 140, y: 120, width: 220, height: 130, value: "Mobile App", style: { rounded: 1, fillColor: "#85BBF0", strokeColor: "#438DD5" } },
        { x: 500, y: 120, width: 260, height: 140, value: "Backend API", style: { rounded: 1, fillColor: "#438DD5", strokeColor: "#1168BD" } },
        { x: 870, y: 130, width: 220, height: 120, value: "DB", style: { shape: "cylinder", fillColor: "#336791", strokeColor: "#234a67", fontColor: "#ffffff" } }
      ]
    }
  ],
  BPMN: [
    {
      id: "bpmn-login",
      name: "Login flow",
      description: "BPMN login básico",
      nodes: [
        { x: 90, y: 130, width: 60, height: 60, value: "Start", style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#2563eb", strokeWidth: 2 } },
        { x: 250, y: 115, width: 190, height: 90, value: "Validar", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } },
        { x: 550, y: 100, width: 120, height: 120, value: "Gateway", style: { shape: "rhombus", fillColor: "#ffffff", strokeColor: "#2563eb" } }
      ]
    },
    {
      id: "bpmn-approval",
      name: "Approval",
      description: "Flujo de aprobación",
      nodes: [
        { x: 120, y: 120, width: 60, height: 60, value: "Start", style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#2563eb", strokeWidth: 2 } },
        { x: 300, y: 110, width: 180, height: 90, value: "Revisión", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } },
        { x: 580, y: 110, width: 180, height: 90, value: "Aprobar", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } }
      ]
    },
    {
      id: "bpmn-incidente",
      name: "Incident handling",
      description: "Gestión de incidente",
      nodes: [
        { x: 140, y: 120, width: 180, height: 90, value: "Detectar", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } },
        { x: 450, y: 120, width: 180, height: 90, value: "Mitigar", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } },
        { x: 760, y: 120, width: 180, height: 90, value: "Cerrar", style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb" } }
      ]
    }
  ]
};

export const getTemplatesForKind = (kind: DiagramKind): DiagramTemplatePreset[] => TEMPLATE_PRESETS[kind] ?? [];

export const MaxGraphTemplatesModal = ({
  open,
  kind,
  onClose,
  onApply
}: {
  open: boolean;
  kind: DiagramKind;
  onClose: () => void;
  onApply: (template: DiagramTemplatePreset, mode: "replace" | "append") => void;
}) => {
  const templates = getTemplatesForKind(kind);

  return (
    <UiModal open={open} onClose={onClose} title="Plantillas" widthClassName="max-w-4xl">
      <div className="space-y-3">
        <p className="text-xs text-mid">
          Selecciona una plantilla para <strong>{kind}</strong> y elige si reemplaza o se añade al canvas.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="rounded-lg border border-line bg-white p-3">
              <p className="text-sm font-semibold text-ink">{template.name}</p>
              <p className="mt-1 text-xs text-mid">{template.description}</p>
              <p className="mt-1 text-[11px] text-faint">Nodos: {template.nodes.length}</p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
                  onClick={() => onApply(template, "append")}
                >
                  Añadir
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-md bg-ink px-2 py-1 text-xs font-semibold text-white"
                  onClick={() => onApply(template, "replace")}
                >
                  Reemplazar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </UiModal>
  );
};
