import { useQuery } from "@tanstack/react-query";
import {
  frontendSettingsDefaults,
  frontendSettingsSchema,
  type FrontendSettings,
  type TaskStatus,
  type TaskStatusColors
} from "@corelia/types";
import { getApiBaseUrl } from "@/lib/api";

const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;
const API_V1_SUFFIX = "/api/v1";

const normalizeHexColor = (value: string) => value.trim().toUpperCase();

const normalizeOrganizationName = (value: string) => value.trim().replace(/\s+/g, " ");

const resolveStatusBaseUrl = () => {
  const apiBase = getApiBaseUrl();

  if (apiBase.endsWith(API_V1_SUFFIX)) {
    return apiBase.slice(0, -API_V1_SUFFIX.length);
  }

  return apiBase;
};

const resolveFrontendSettingsUrl = () => `${resolveStatusBaseUrl()}/status/frontend-settings`;

const frontendSettingsFallback: FrontendSettings = {
  organizationName: frontendSettingsDefaults.organizationName,
  taskStatusColors: {
    ...frontendSettingsDefaults.taskStatusColors
  },
  updatedAt: new Date(0).toISOString()
};

const sanitizeColor = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeHexColor(value);
  if (!HEX_COLOR_REGEX.test(normalized)) {
    return fallback;
  }
  return normalized;
};

const sanitizeSettings = (settings: FrontendSettings): FrontendSettings => ({
  organizationName: settings.organizationName.trim()
    ? normalizeOrganizationName(settings.organizationName)
    : frontendSettingsDefaults.organizationName,
  taskStatusColors: {
    PENDIENTE: sanitizeColor(
      settings.taskStatusColors.PENDIENTE,
      frontendSettingsDefaults.taskStatusColors.PENDIENTE
    ),
    EN_REVISION: sanitizeColor(
      settings.taskStatusColors.EN_REVISION,
      frontendSettingsDefaults.taskStatusColors.EN_REVISION
    ),
    COMPLETADA: sanitizeColor(
      settings.taskStatusColors.COMPLETADA,
      frontendSettingsDefaults.taskStatusColors.COMPLETADA
    )
  },
  updatedAt: settings.updatedAt
});

const fetchFrontendSettings = async (): Promise<FrontendSettings> => {
  const response = await fetch(resolveFrontendSettingsUrl(), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar la configuración visual");
  }

  const payload = await response.json();
  const parsed = frontendSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Configuración visual inválida");
  }

  return sanitizeSettings(parsed.data);
};

export const useFrontendSettings = () => {
  const query = useQuery({
    queryKey: ["frontend-settings"],
    queryFn: fetchFrontendSettings,
    staleTime: 60_000,
    retry: 1
  });

  return {
    ...query,
    settings: query.data ?? frontendSettingsFallback
  };
};

export const getTaskStatusColor = (
  status: TaskStatus,
  taskStatusColors: TaskStatusColors | undefined
) => {
  const fromConfig = taskStatusColors?.[status];
  if (!fromConfig) {
    return frontendSettingsDefaults.taskStatusColors[status];
  }

  return sanitizeColor(fromConfig, frontendSettingsDefaults.taskStatusColors[status]);
};

export const hexToRgba = (hexColor: string, alpha: number) => {
  const safe = sanitizeColor(hexColor, "#64748B");
  const hex = safe.slice(1);
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const boundedAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${boundedAlpha})`;
};

const readableTextColor = (hexColor: string) => {
  const safe = sanitizeColor(hexColor, "#64748B").slice(1);
  const value = Number.parseInt(safe, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? "#0F172A" : "#F8FAFC";
};

export const getTaskStatusBadgeStyle = (
  status: TaskStatus,
  taskStatusColors: TaskStatusColors | undefined
) => {
  const color = getTaskStatusColor(status, taskStatusColors);
  return {
    borderColor: hexToRgba(color, 0.4),
    backgroundColor: hexToRgba(color, 0.16),
    color: readableTextColor(color)
  };
};
