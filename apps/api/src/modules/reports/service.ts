import type { FastifyInstance } from "fastify";
import type { ReportsExecutiveResponse, ReportsExecutiveQuery, RoleCode } from "@corelia/types";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

const ACTIVE_TASK_STATUSES = new Set(["PENDIENTE", "EN_REVISION"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 365;
const DEFAULT_CAPACITY_SLOTS = 5;

type TaskRecord = {
  id: string;
  projectId: string;
  assigneeId: string | null;
  createdById: string;
  status: "PENDIENTE" | "EN_REVISION" | "COMPLETADA";
  dueDate: Date | null;
  completedAt: Date | null;
  pendingActivatedAt: Date | null;
  startDate: Date | null;
  createdAt: Date;
};

type ScopeItem = {
  id: string;
  name: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const percentage = (numerator: number, denominator: number) => {
  if (denominator <= 0) {
    return 0;
  }
  return round2((numerator / denominator) * 100);
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const formatShortDate = (value: Date) => value.toISOString().slice(0, 10);

const asFullName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim();

const appendWorksheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Array<Record<string, string | number>>
) => {
  const worksheet = workbook.addWorksheet(name);
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, Math.min(48, header.length + 4))
  }));

  for (const row of rows) {
    worksheet.addRow(row);
  }
};

const isSupportedRole = (role: RoleCode) =>
  role === "COLABORADOR" ||
  role === "COORDINADOR_EQUIPO" ||
  role === "LIDER_PROYECTO" ||
  role === "ADMINISTRADOR";

type ScopeResolution = {
  role: RoleCode;
  projectFilter: string | null;
  teamFilter: string | null;
  projectIds: string[];
  teamIds: string[];
  projects: ScopeItem[];
  teams: ScopeItem[];
};

type ReportInput = ReportsExecutiveQuery & {
  actorId: string;
  activeRole: RoleCode;
};

export class ReportsService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private resolveRange(input: ReportsExecutiveQuery) {
    const now = new Date();
    const to = input.to ? new Date(input.to) : now;
    if (Number.isNaN(to.getTime())) {
      throw new Error("Fecha 'to' inválida");
    }

    const from = input.from ? new Date(input.from) : new Date(to.getTime() - 29 * DAY_MS);
    if (Number.isNaN(from.getTime())) {
      throw new Error("Fecha 'from' inválida");
    }

    if (from.getTime() > to.getTime()) {
      throw new Error("Rango inválido: 'from' debe ser menor o igual que 'to'");
    }

    const diffDays = Math.floor((to.getTime() - from.getTime()) / DAY_MS);
    if (diffDays > MAX_RANGE_DAYS) {
      throw new Error(`El rango máximo permitido es ${MAX_RANGE_DAYS} días`);
    }

    return { from, to };
  }

  private isOnTime(task: TaskRecord): boolean {
    if (!task.dueDate) {
      return false;
    }
    if (task.status !== "COMPLETADA") {
      return false;
    }
    if (!task.completedAt) {
      return false;
    }
    return task.completedAt.getTime() <= task.dueDate.getTime();
  }

  private isBreached(task: TaskRecord, now: Date): boolean {
    if (!task.dueDate) {
      return false;
    }
    if (task.status === "COMPLETADA") {
      if (!task.completedAt) {
        return true;
      }
      return task.completedAt.getTime() > task.dueDate.getTime();
    }
    return task.dueDate.getTime() < now.getTime();
  }

  private inRange(date: Date | null, from: Date, to: Date): boolean {
    if (!date) {
      return false;
    }
    const time = date.getTime();
    return time >= from.getTime() && time <= to.getTime();
  }

  private async resolveScope(input: {
    actorId: string;
    activeRole: RoleCode;
    projectFilter?: string;
    teamFilter?: string;
  }): Promise<ScopeResolution> {
    if (!isSupportedRole(input.activeRole)) {
      throw this.forbidden("Tu rol no tiene acceso a reportes ejecutivos");
    }

    let allowedProjects: ScopeItem[] = [];
    let allowedTeams: ScopeItem[] = [];

    if (input.activeRole === "ADMINISTRADOR") {
      const [projects, teams] = await Promise.all([
        this.app.prisma.project.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        }),
        this.app.prisma.team.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        })
      ]);
      allowedProjects = projects;
      allowedTeams = teams;
    } else if (input.activeRole === "LIDER_PROYECTO") {
      const projects = await this.app.prisma.project.findMany({
        where: {
          OR: [
            { ownerId: input.actorId },
            {
              members: {
                some: {
                  userId: input.actorId,
                role: {
                  is: {
                    key: "LIDER_PROYECTO"
                  }
                }
                }
              }
            }
          ]
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      });

      const projectIds = projects.map((project) => project.id);
      const linkedTeams =
        projectIds.length === 0
          ? []
          : await this.app.prisma.projectTeamLink.findMany({
              where: {
                projectId: { in: projectIds }
              },
              include: {
                team: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            });

      allowedProjects = projects;
      allowedTeams = [...new Map(linkedTeams.map((link) => [link.team.id, link.team])).values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    } else if (input.activeRole === "COORDINADOR_EQUIPO") {
      const memberships = await this.app.prisma.teamMember.findMany({
        where: {
          userId: input.actorId
        },
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      const teamIds = memberships.map((membership) => membership.teamId);
      const links =
        teamIds.length === 0
          ? []
          : await this.app.prisma.projectTeamLink.findMany({
              where: {
                teamId: { in: teamIds }
              },
              include: {
                project: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            });

      allowedTeams = [...new Map(memberships.map((membership) => [membership.team.id, membership.team])).values()].sort(
        (a, b) => a.name.localeCompare(b.name)
      );
      allowedProjects = [...new Map(links.map((link) => [link.project.id, link.project])).values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    } else {
      const [projects, memberships] = await Promise.all([
        this.app.prisma.project.findMany({
          where: {
            OR: [{ ownerId: input.actorId }, { members: { some: { userId: input.actorId } } }]
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        }),
        this.app.prisma.teamMember.findMany({
          where: {
            userId: input.actorId
          },
          include: {
            team: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      ]);

      allowedProjects = projects;
      allowedTeams = [...new Map(memberships.map((membership) => [membership.team.id, membership.team])).values()].sort(
        (a, b) => a.name.localeCompare(b.name)
      );
    }

    const allowedProjectSet = new Set(allowedProjects.map((project) => project.id));
    const allowedTeamSet = new Set(allowedTeams.map((team) => team.id));

    if (input.projectFilter && !allowedProjectSet.has(input.projectFilter)) {
      throw this.forbidden("El proyecto solicitado está fuera de tu alcance");
    }
    if (input.teamFilter && !allowedTeamSet.has(input.teamFilter)) {
      throw this.forbidden("El equipo solicitado está fuera de tu alcance");
    }

    const allowedProjectIds = [...allowedProjectSet];
    const allowedTeamIds = [...allowedTeamSet];

    const links =
      allowedProjectIds.length === 0 || allowedTeamIds.length === 0
        ? []
        : await this.app.prisma.projectTeamLink.findMany({
            where: {
              projectId: {
                in: allowedProjectIds
              },
              teamId: {
                in: allowedTeamIds
              }
            },
            select: {
              projectId: true,
              teamId: true
            }
          });

    const teamIdsByProject = new Map<string, Set<string>>();
    const projectIdsByTeam = new Map<string, Set<string>>();

    for (const link of links) {
      const byProject = teamIdsByProject.get(link.projectId) ?? new Set<string>();
      byProject.add(link.teamId);
      teamIdsByProject.set(link.projectId, byProject);

      const byTeam = projectIdsByTeam.get(link.teamId) ?? new Set<string>();
      byTeam.add(link.projectId);
      projectIdsByTeam.set(link.teamId, byTeam);
    }

    if (input.projectFilter && input.teamFilter) {
      const linkedProjects = projectIdsByTeam.get(input.teamFilter) ?? new Set<string>();
      if (!linkedProjects.has(input.projectFilter)) {
        throw this.forbidden("El proyecto no está vinculado al equipo seleccionado");
      }
    }

    let scopedProjects = [...allowedProjects];
    let scopedTeams = [...allowedTeams];

    if (input.teamFilter) {
      const allowedByTeam = projectIdsByTeam.get(input.teamFilter) ?? new Set<string>();
      scopedProjects = scopedProjects.filter((project) => allowedByTeam.has(project.id));
    }

    if (input.projectFilter) {
      const allowedByProject = teamIdsByProject.get(input.projectFilter) ?? new Set<string>();
      scopedTeams = scopedTeams.filter((team) => allowedByProject.has(team.id));
    }

    const projectFilter = input.projectFilter ?? null;
    const teamFilter = input.teamFilter ?? null;

    const projectIds = projectFilter
      ? [projectFilter]
      : scopedProjects.map((project) => project.id);

    const teamIds = teamFilter ? [teamFilter] : scopedTeams.map((team) => team.id);

    return {
      role: input.activeRole,
      projectFilter,
      teamFilter,
      projectIds,
      teamIds,
      projects: scopedProjects,
      teams: scopedTeams
    };
  }

  private buildDailySeries(input: {
    from: Date;
    to: Date;
    tasksForCreated: TaskRecord[];
    tasksForCompleted: TaskRecord[];
    slaUniverse: TaskRecord[];
    timeEntries: Array<{ minutes: number; loggedAt: Date }>;
    now: Date;
  }) {
    const series = new Map<
      string,
      {
        date: string;
        created: number;
        completed: number;
        due: number;
        slaOnTime: number;
        slaBreached: number;
        loggedMinutes: number;
      }
    >();

    for (let cursor = new Date(input.from); cursor.getTime() <= input.to.getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
      const key = toDateKey(cursor);
      series.set(key, {
        date: key,
        created: 0,
        completed: 0,
        due: 0,
        slaOnTime: 0,
        slaBreached: 0,
        loggedMinutes: 0
      });
    }

    for (const task of input.tasksForCreated) {
      const key = toDateKey(task.createdAt);
      const bucket = series.get(key);
      if (bucket) {
        bucket.created += 1;
      }
    }

    for (const task of input.tasksForCompleted) {
      if (!task.completedAt) {
        continue;
      }
      const key = toDateKey(task.completedAt);
      const bucket = series.get(key);
      if (bucket) {
        bucket.completed += 1;
      }
    }

    for (const task of input.slaUniverse) {
      if (!task.dueDate) {
        continue;
      }
      const key = toDateKey(task.dueDate);
      const bucket = series.get(key);
      if (!bucket) {
        continue;
      }
      bucket.due += 1;
      if (this.isOnTime(task)) {
        bucket.slaOnTime += 1;
      }
      if (this.isBreached(task, input.now)) {
        bucket.slaBreached += 1;
      }
    }

    for (const entry of input.timeEntries) {
      const key = toDateKey(entry.loggedAt);
      const bucket = series.get(key);
      if (bucket) {
        bucket.loggedMinutes += entry.minutes;
      }
    }

    return [...series.values()];
  }

  async getExecutiveReport(input: ReportInput): Promise<ReportsExecutiveResponse> {
    const now = new Date();
    const range = this.resolveRange(input);
    const scope = await this.resolveScope({
      actorId: input.actorId,
      activeRole: input.activeRole,
      ...(input.projectId ? { projectFilter: input.projectId } : {}),
      ...(input.teamId ? { teamFilter: input.teamId } : {})
    });

    const tasks: TaskRecord[] =
      scope.projectIds.length === 0
        ? []
        : await this.app.prisma.task.findMany({
            where: {
              projectId: {
                in: scope.projectIds
              },
              ...(scope.role === "COLABORADOR"
                ? {
                    OR: [{ assigneeId: input.actorId }, { createdById: input.actorId }]
                  }
                : {})
            },
            select: {
              id: true,
              projectId: true,
              assigneeId: true,
              createdById: true,
              status: true,
              dueDate: true,
              completedAt: true,
              pendingActivatedAt: true,
              startDate: true,
              createdAt: true
            }
          });

    const tasksForCreated =
      scope.role === "COLABORADOR"
        ? tasks.filter(
            (task) =>
              task.createdById === input.actorId &&
              this.inRange(task.createdAt, range.from, range.to)
          )
        : tasks.filter((task) => this.inRange(task.createdAt, range.from, range.to));

    const tasksForCompleted =
      scope.role === "COLABORADOR"
        ? tasks.filter(
            (task) =>
              task.assigneeId === input.actorId &&
              this.inRange(task.completedAt, range.from, range.to)
          )
        : tasks.filter((task) => this.inRange(task.completedAt, range.from, range.to));

    const cycleHours = tasksForCompleted
      .map((task) => {
        const startedAt = task.pendingActivatedAt ?? task.startDate ?? task.createdAt;
        if (!task.completedAt) {
          return null;
        }
        const diff = task.completedAt.getTime() - startedAt.getTime();
        if (diff <= 0) {
          return null;
        }
        return diff / (1000 * 60 * 60);
      })
      .filter((value): value is number => value !== null);

    const timeEntries =
      scope.projectIds.length === 0
        ? []
        : await this.app.prisma.timeEntry.findMany({
            where: {
              task: {
                projectId: {
                  in: scope.projectIds
                }
              },
              loggedAt: {
                gte: range.from,
                lte: range.to
              },
              ...(scope.role === "COLABORADOR"
                ? {
                    userId: input.actorId
                  }
                : {})
            },
            select: {
              minutes: true,
              loggedAt: true
            }
          });

    const totalLoggedMinutes = timeEntries.reduce((acc, item) => acc + item.minutes, 0);

    const slaUniverse =
      scope.role === "COLABORADOR"
        ? tasks.filter(
            (task) =>
              task.assigneeId === input.actorId &&
              this.inRange(task.dueDate, range.from, range.to)
          )
        : tasks.filter((task) => this.inRange(task.dueDate, range.from, range.to));

    const slaOnTime = slaUniverse.filter((task) => this.isOnTime(task)).length;
    const slaBreached = slaUniverse.filter((task) => this.isBreached(task, now)).length;

    const projectProgress = scope.projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter((task) => task.status === "COMPLETADA").length;
      const overdueOpenTasks = projectTasks.filter(
        (task) =>
          task.status !== "COMPLETADA" &&
          task.dueDate !== null &&
          task.dueDate.getTime() < now.getTime()
      ).length;
      const projectSlaUniverse = projectTasks.filter((task) =>
        this.inRange(task.dueDate, range.from, range.to)
      );
      const projectOnTime = projectSlaUniverse.filter((task) => this.isOnTime(task)).length;

      return {
        projectId: project.id,
        projectName: project.name,
        totalTasks,
        completedTasks,
        completionPct: percentage(completedTasks, totalTasks),
        overdueOpenTasks,
        slaPct: percentage(projectOnTime, projectSlaUniverse.length)
      };
    });

    let workloadActiveTasksNow = 0;
    let workloadCapacitySlots = 0;
    let workloadOverloadedCount = 0;
    let workloadByUser: ReportsExecutiveResponse["blocks"]["workload"]["byUser"] = [];
    let workloadByTeam: ReportsExecutiveResponse["blocks"]["workload"]["byTeam"] = [];

    if (scope.role === "COLABORADOR") {
      const activeTasksNow = tasks.filter(
        (task) => task.assigneeId === input.actorId && ACTIVE_TASK_STATUSES.has(task.status)
      ).length;

      const schedule = await this.app.prisma.workSchedule.findUnique({
        where: { userId: input.actorId },
        select: { maxActiveTasks: true }
      });
      const capacitySlots = schedule?.maxActiveTasks ?? DEFAULT_CAPACITY_SLOTS;

      const user = await this.app.prisma.user.findUnique({
        where: {
          id: input.actorId
        },
        select: {
          firstName: true,
          lastName: true
        }
      });

      workloadActiveTasksNow = activeTasksNow;
      workloadCapacitySlots = capacitySlots;
      workloadOverloadedCount = activeTasksNow >= capacitySlots ? 1 : 0;
      workloadByUser = [
        {
          userId: input.actorId,
          fullName: user ? asFullName(user.firstName, user.lastName) : "Usuario",
          teamId: null,
          teamName: null,
          activeTasksNow,
          capacitySlots,
          loadPct: percentage(activeTasksNow, capacitySlots),
          overloaded: activeTasksNow >= capacitySlots
        }
      ];
      workloadByTeam = [];
    } else {
      const scopedTeams =
        scope.teamIds.length === 0
          ? []
          : await this.app.prisma.team.findMany({
              where: {
                id: {
                  in: scope.teamIds
                }
              },
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        workSchedule: {
                          select: {
                            maxActiveTasks: true
                          }
                        }
                      }
                    }
                  }
                }
              },
              orderBy: {
                name: "asc"
              }
            });

      const userById = new Map<
        string,
        {
          fullName: string;
          capacitySlots: number;
          teamId: string | null;
          teamName: string | null;
        }
      >();

      for (const team of scopedTeams) {
        for (const member of team.members) {
          if (userById.has(member.userId)) {
            continue;
          }
          userById.set(member.userId, {
            fullName: asFullName(member.user.firstName, member.user.lastName),
            capacitySlots: member.user.workSchedule?.maxActiveTasks ?? DEFAULT_CAPACITY_SLOTS,
            teamId: team.id,
            teamName: team.name
          });
        }
      }

      const userIds = [...userById.keys()];
      const activeByUser = new Map<string, number>();

      for (const task of tasks) {
        if (!task.assigneeId || !ACTIVE_TASK_STATUSES.has(task.status)) {
          continue;
        }
        if (!userById.has(task.assigneeId)) {
          continue;
        }
        activeByUser.set(task.assigneeId, (activeByUser.get(task.assigneeId) ?? 0) + 1);
      }

      workloadByUser = userIds
        .map((userId) => {
          const base = userById.get(userId)!;
          const activeTasksNow = activeByUser.get(userId) ?? 0;
          const capacitySlots = base.capacitySlots;
          const overloaded = activeTasksNow >= capacitySlots;
          return {
            userId,
            fullName: base.fullName || "Usuario",
            teamId: base.teamId,
            teamName: base.teamName,
            activeTasksNow,
            capacitySlots,
            loadPct: percentage(activeTasksNow, capacitySlots),
            overloaded
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      workloadByTeam = scopedTeams.map((team) => {
        let activeTasksNow = 0;
        let capacitySlots = 0;
        let overloadedCount = 0;
        for (const member of team.members) {
          const user = workloadByUser.find((item) => item.userId === member.userId);
          if (!user) {
            continue;
          }
          activeTasksNow += user.activeTasksNow;
          capacitySlots += user.capacitySlots;
          if (user.overloaded) {
            overloadedCount += 1;
          }
        }
        return {
          teamId: team.id,
          teamName: team.name,
          activeTasksNow,
          capacitySlots,
          loadPct: percentage(activeTasksNow, capacitySlots),
          overloadedCount
        };
      });

      workloadActiveTasksNow = workloadByUser.reduce((acc, item) => acc + item.activeTasksNow, 0);
      workloadCapacitySlots = workloadByUser.reduce((acc, item) => acc + item.capacitySlots, 0);
      workloadOverloadedCount = workloadByUser.filter((item) => item.overloaded).length;
    }

    const budgetByProject = await Promise.all(
      scope.projects.map(async (project) => {
        const details = await this.app.prisma.projectDetail.findMany({
          where: { projectId: project.id },
          include: {
            expenses: {
              select: { amount: true, status: true }
            }
          }
        });

        let totalEstimated = 0;
        let totalApproved = 0;
        let totalPending = 0;

        for (const detail of details) {
          totalEstimated += detail.estimatedBudget;
          for (const expense of detail.expenses) {
            if (expense.status === "APROBADO") {
              totalApproved += expense.amount;
            } else if (expense.status === "PENDIENTE") {
              totalPending += expense.amount;
            }
          }
        }

        return {
          projectId: project.id,
          projectName: project.name,
          totalEstimated,
          totalApproved,
          totalPending,
          totalRemaining: totalEstimated - totalApproved,
          executionPct: totalEstimated > 0 ? round2((totalApproved / totalEstimated) * 100) : 0
        };
      })
    );

    const budgetBlock = {
      totalEstimated: budgetByProject.reduce((s, p) => s + p.totalEstimated, 0),
      totalApproved: budgetByProject.reduce((s, p) => s + p.totalApproved, 0),
      totalPending: budgetByProject.reduce((s, p) => s + p.totalPending, 0),
      totalRemaining: budgetByProject.reduce((s, p) => s + p.totalRemaining, 0),
      byProject: budgetByProject.filter((p) => p.totalEstimated > 0)
    };

    const response: ReportsExecutiveResponse = {
      generatedAt: now.toISOString(),
      role: scope.role,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString()
      },
      scope: {
        projectFilter: scope.projectFilter,
        teamFilter: scope.teamFilter,
        projectIds: scope.projectIds,
        teamIds: scope.teamIds,
        projects: scope.projects,
        teams: scope.teams
      },
      blocks: {
        productivity: {
          tasksCreated: tasksForCreated.length,
          tasksCompleted: tasksForCompleted.length,
          completionRate: percentage(tasksForCompleted.length, tasksForCreated.length),
          avgCycleHours: cycleHours.length > 0 ? round2(cycleHours.reduce((acc, item) => acc + item, 0) / cycleHours.length) : 0,
          totalLoggedMinutes
        },
        sla: {
          evaluated: slaUniverse.length,
          onTime: slaOnTime,
          breached: slaBreached,
          slaPct: percentage(slaOnTime, slaUniverse.length)
        },
        workload: {
          activeTasksNow: workloadActiveTasksNow,
          capacitySlots: workloadCapacitySlots,
          loadPct: percentage(workloadActiveTasksNow, workloadCapacitySlots),
          overloadedCount: workloadOverloadedCount,
          byUser: workloadByUser,
          byTeam: workloadByTeam
        },
        progressByClient: projectProgress.sort((a, b) => a.projectName.localeCompare(b.projectName)),
        budget: budgetBlock,
        series: {
          daily: this.buildDailySeries({
            from: range.from,
            to: range.to,
            tasksForCreated,
            tasksForCompleted,
            slaUniverse,
            timeEntries,
            now
          })
        }
      }
    };

    return response;
  }

  async exportExecutiveXlsx(input: ReportInput) {
    const report = await this.getExecutiveReport(input);

    const workbook = new ExcelJS.Workbook();

    const summaryRows = [
      { metrica: "Rol", valor: report.role },
      { metrica: "Rango desde", valor: report.range.from },
      { metrica: "Rango hasta", valor: report.range.to },
      { metrica: "Tareas creadas", valor: report.blocks.productivity.tasksCreated },
      { metrica: "Tareas completadas", valor: report.blocks.productivity.tasksCompleted },
      { metrica: "Tasa de cierre (%)", valor: report.blocks.productivity.completionRate },
      { metrica: "Promedio ciclo (horas)", valor: report.blocks.productivity.avgCycleHours },
      { metrica: "Tiempo registrado (min)", valor: report.blocks.productivity.totalLoggedMinutes },
      { metrica: "SLA evaluadas", valor: report.blocks.sla.evaluated },
      { metrica: "SLA a tiempo", valor: report.blocks.sla.onTime },
      { metrica: "SLA incumplidas", valor: report.blocks.sla.breached },
      { metrica: "SLA (%)", valor: report.blocks.sla.slaPct },
      { metrica: "Carga activa", valor: report.blocks.workload.activeTasksNow },
      { metrica: "Capacidad", valor: report.blocks.workload.capacitySlots },
      { metrica: "Carga (%)", valor: report.blocks.workload.loadPct },
      { metrica: "Sobrecargados", valor: report.blocks.workload.overloadedCount }
    ];

    appendWorksheet(workbook, "Resumen", summaryRows);
    appendWorksheet(
      workbook,
      "Avance_Proyecto",
      report.blocks.progressByClient.map((item) => ({
        projectId: item.projectId,
        projectName: item.projectName,
        totalTasks: item.totalTasks,
        completedTasks: item.completedTasks,
        completionPct: item.completionPct,
        overdueOpenTasks: item.overdueOpenTasks,
        slaPct: item.slaPct
      }))
    );
    appendWorksheet(
      workbook,
      "Carga_Usuarios",
      report.blocks.workload.byUser.map((item) => ({
        userId: item.userId,
        fullName: item.fullName,
        team: item.teamName ?? "",
        activeTasksNow: item.activeTasksNow,
        capacitySlots: item.capacitySlots,
        loadPct: item.loadPct,
        overloaded: item.overloaded ? "SI" : "NO"
      }))
    );
    appendWorksheet(
      workbook,
      "Serie_Diaria",
      report.blocks.series.daily.map((item) => ({
        date: item.date,
        created: item.created,
        completed: item.completed,
        due: item.due,
        slaOnTime: item.slaOnTime,
        slaBreached: item.slaBreached,
        loggedMinutes: item.loggedMinutes
      }))
    );

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

    return {
      filename: `executive-report-${formatShortDate(new Date(report.range.from))}-${formatShortDate(new Date(report.range.to))}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer
    };
  }

  async exportExecutivePdf(input: ReportInput) {
    const report = await this.getExecutiveReport(input);

    const doc = new PDFDocument({
      margin: 40,
      size: "A4"
    });

    const chunks: Buffer[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("Reporte Ejecutivo", { align: "left" });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Rol: ${report.role}`);
      doc.text(`Rango: ${formatShortDate(new Date(report.range.from))} a ${formatShortDate(new Date(report.range.to))}`);
      doc.text(`Generado: ${report.generatedAt}`);

      doc.moveDown(1);
      doc.fontSize(12).text("KPI Productividad");
      doc.fontSize(10).text(`Tareas creadas: ${report.blocks.productivity.tasksCreated}`);
      doc.text(`Tareas completadas: ${report.blocks.productivity.tasksCompleted}`);
      doc.text(`Tasa de cierre: ${report.blocks.productivity.completionRate}%`);
      doc.text(`Promedio ciclo: ${report.blocks.productivity.avgCycleHours} h`);
      doc.text(`Tiempo registrado: ${report.blocks.productivity.totalLoggedMinutes} min`);

      doc.moveDown(0.8);
      doc.fontSize(12).text("SLA");
      doc.fontSize(10).text(`Evaluadas: ${report.blocks.sla.evaluated}`);
      doc.text(`A tiempo: ${report.blocks.sla.onTime}`);
      doc.text(`Incumplidas: ${report.blocks.sla.breached}`);
      doc.text(`SLA: ${report.blocks.sla.slaPct}%`);

      doc.moveDown(0.8);
      doc.fontSize(12).text("Carga");
      doc.fontSize(10).text(`Tareas activas: ${report.blocks.workload.activeTasksNow}`);
      doc.text(`Capacidad: ${report.blocks.workload.capacitySlots}`);
      doc.text(`Carga: ${report.blocks.workload.loadPct}%`);
      doc.text(`Personas sobrecargadas: ${report.blocks.workload.overloadedCount}`);

      doc.moveDown(0.8);
      doc.fontSize(12).text("Avance por proyecto");
      doc.fontSize(9);
      for (const item of report.blocks.progressByClient.slice(0, 12)) {
        doc.text(
          `${item.projectName}: ${item.completionPct}% completado | SLA ${item.slaPct}% | Vencidas ${item.overdueOpenTasks}`
        );
      }

      doc.end();
    });

    return {
      filename: `executive-report-${formatShortDate(new Date(report.range.from))}-${formatShortDate(new Date(report.range.to))}.pdf`,
      contentType: "application/pdf",
      buffer
    };
  }
}
