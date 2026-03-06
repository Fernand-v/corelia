import type { PrismaClient } from "@prisma/client";
import {
  frontendSettingsDefaults,
  frontendSettingsSchema,
  type AdminUpdateFrontendSettingsInput,
  type FrontendSettings,
  type TaskStatusColors
} from "@corelia/types";

const FRONTEND_SETTINGS_ID = 1;
const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;

type FrontendSettingsRecord = {
  id: number;
  organizationName: string;
  taskStatusColorPending: string;
  taskStatusColorInReview: string;
  taskStatusColorCompleted: string;
  updatedAt: Date;
};

const normalizeHexColor = (value: string) => value.trim().toUpperCase();
const normalizeOrganizationName = (value: string) => value.trim().replace(/\s+/g, " ");

const resolveColor = (value: string | null | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeHexColor(value);
  if (!HEX_COLOR_REGEX.test(normalized)) {
    return fallback;
  }

  return normalized;
};

const defaultsToRowData = () => ({
  organizationName: frontendSettingsDefaults.organizationName,
  taskStatusColorPending: frontendSettingsDefaults.taskStatusColors.PENDIENTE,
  taskStatusColorInReview: frontendSettingsDefaults.taskStatusColors.EN_REVISION,
  taskStatusColorCompleted: frontendSettingsDefaults.taskStatusColors.COMPLETADA
});

const mapRecordToFrontendSettings = (record: FrontendSettingsRecord | null): FrontendSettings => {
  const taskStatusColors: TaskStatusColors = {
    PENDIENTE: resolveColor(record?.taskStatusColorPending, frontendSettingsDefaults.taskStatusColors.PENDIENTE),
    EN_REVISION: resolveColor(
      record?.taskStatusColorInReview,
      frontendSettingsDefaults.taskStatusColors.EN_REVISION
    ),
    COMPLETADA: resolveColor(
      record?.taskStatusColorCompleted,
      frontendSettingsDefaults.taskStatusColors.COMPLETADA
    )
  };

  const organizationName = record?.organizationName?.trim()
    ? normalizeOrganizationName(record.organizationName)
    : frontendSettingsDefaults.organizationName;

  return frontendSettingsSchema.parse({
    organizationName,
    taskStatusColors,
    updatedAt: (record?.updatedAt ?? new Date()).toISOString()
  });
};

export const getFrontendSettings = async (prisma: PrismaClient): Promise<FrontendSettings> => {
  const record = await prisma.frontendSettings.findUnique({
    where: { id: FRONTEND_SETTINGS_ID }
  });

  return mapRecordToFrontendSettings(record);
};

export const updateFrontendSettings = async (
  prisma: PrismaClient,
  input: AdminUpdateFrontendSettingsInput
): Promise<FrontendSettings> => {
  const data = {
    ...(input.organizationName !== undefined
      ? { organizationName: normalizeOrganizationName(input.organizationName) }
      : {}),
    ...(input.taskStatusColors?.PENDIENTE !== undefined
      ? { taskStatusColorPending: normalizeHexColor(input.taskStatusColors.PENDIENTE) }
      : {}),
    ...(input.taskStatusColors?.EN_REVISION !== undefined
      ? { taskStatusColorInReview: normalizeHexColor(input.taskStatusColors.EN_REVISION) }
      : {}),
    ...(input.taskStatusColors?.COMPLETADA !== undefined
      ? { taskStatusColorCompleted: normalizeHexColor(input.taskStatusColors.COMPLETADA) }
      : {})
  };

  const record = await prisma.frontendSettings.upsert({
    where: { id: FRONTEND_SETTINGS_ID },
    create: {
      id: FRONTEND_SETTINGS_ID,
      ...defaultsToRowData(),
      ...data
    },
    update: data
  });

  return mapRecordToFrontendSettings(record);
};

export const resetFrontendSettings = async (prisma: PrismaClient): Promise<FrontendSettings> => {
  const record = await prisma.frontendSettings.upsert({
    where: { id: FRONTEND_SETTINGS_ID },
    create: {
      id: FRONTEND_SETTINGS_ID,
      ...defaultsToRowData()
    },
    update: defaultsToRowData()
  });

  return mapRecordToFrontendSettings(record);
};
