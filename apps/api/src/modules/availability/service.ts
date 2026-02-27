import type { FastifyInstance } from "fastify";

export class AvailabilityService {
  constructor(private readonly app: FastifyInstance) {}

  async createBlock(input: {
    userId: string;
    type: "VACACIONES" | "PERMISO" | "AUSENCIA" | "NO_DISPONIBLE";
    startAt: string;
    endAt: string;
    note?: string;
  }) {
    return this.app.prisma.availabilityBlock.create({
      data: {
        userId: input.userId,
        type: input.type,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        note: input.note
      }
    });
  }

  async upsertSchedule(input: {
    userId: string;
    schedule: {
      timezone: string;
      weekDays: number[];
      startHour: string;
      endHour: string;
    };
    maxActiveTasks: number;
    periodHoursCapacity: number;
  }) {
    return this.app.prisma.workSchedule.upsert({
      where: { userId: input.userId },
      update: {
        timezone: input.schedule.timezone,
        weekDays: input.schedule.weekDays,
        startHour: input.schedule.startHour,
        endHour: input.schedule.endHour,
        maxActiveTasks: input.maxActiveTasks,
        periodHoursCapacity: input.periodHoursCapacity
      },
      create: {
        userId: input.userId,
        timezone: input.schedule.timezone,
        weekDays: input.schedule.weekDays,
        startHour: input.schedule.startHour,
        endHour: input.schedule.endHour,
        maxActiveTasks: input.maxActiveTasks,
        periodHoursCapacity: input.periodHoursCapacity
      }
    });
  }

  async checkAssignment(input: {
    userId: string;
    assignAt: string;
    requireOutOfScheduleConfirmation: boolean;
  }) {
    const at = new Date(input.assignAt);

    const block = await this.app.prisma.availabilityBlock.findFirst({
      where: {
        userId: input.userId,
        startAt: { lte: at },
        endAt: { gte: at },
        type: { in: ["VACACIONES", "AUSENCIA"] }
      }
    });

    if (block) {
      return {
        allowed: false,
        blocked: true,
        warning: null,
        reason: "El usuario está en vacaciones o ausencia"
      };
    }

    const schedule = await this.app.prisma.workSchedule.findUnique({ where: { userId: input.userId } });
    if (!schedule) {
      return {
        allowed: true,
        blocked: false,
        warning: null,
        reason: null
      };
    }

    const day = at.getDay();
    const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    const inDay = schedule.weekDays.includes(day);
    const inHour = hhmm >= schedule.startHour && hhmm <= schedule.endHour;

    if (!inDay || !inHour) {
      if (!input.requireOutOfScheduleConfirmation) {
        return {
          allowed: false,
          blocked: false,
          warning: "Asignación fuera de jornada laboral",
          reason: "Se requiere confirmación explícita"
        };
      }

      return {
        allowed: true,
        blocked: false,
        warning: "Asignación fuera de jornada laboral confirmada",
        reason: null
      };
    }

    return {
      allowed: true,
      blocked: false,
      warning: null,
      reason: null
    };
  }
}
