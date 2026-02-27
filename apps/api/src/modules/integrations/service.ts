import type { FastifyInstance } from "fastify";
import nodemailer from "nodemailer";

export class IntegrationService {
  constructor(private readonly app: FastifyInstance) {}

  async saveWebhook(input: {
    url: string;
    event: "TAREA_COMPLETADA" | "SOLICITUD_APROBADA" | "SOLICITUD_RECHAZADA" | "TAREA_REASIGNADA" | "TAREA_VENCIDA";
    secret: string;
    enabled: boolean;
    createdById: string;
  }) {
    return this.app.prisma.webhookEndpoint.create({
      data: input
    });
  }

  async listWebhooks() {
    return this.app.prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  async testSmtp(config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  }, to: string) {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject: "Corelia SMTP test",
      text: "Prueba de configuración SMTP de Corelia"
    });

    return { sent: true };
  }

  async generateIcs(input: { userId: string; from: string; to: string }) {
    const fromDate = new Date(input.from);
    const toDate = new Date(input.to);

    const tasks = await this.app.prisma.task.findMany({
      where: {
        assigneeId: input.userId,
        dueDate: {
          gte: fromDate,
          lte: toDate
        }
      }
    });

    const events = tasks
      .filter((task) => task.dueDate)
      .map((task) => {
        const due = task.dueDate!.toISOString().replace(/[-:]/g, "").replace(".000", "");
        return [
          "BEGIN:VEVENT",
          `UID:${task.id}@corelia.local`,
          `DTSTAMP:${due}`,
          `DTSTART:${due}`,
          `SUMMARY:${task.title}`,
          `DESCRIPTION:${task.description ?? ""}`,
          "END:VEVENT"
        ].join("\n");
      })
      .join("\n");

    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Corelia//Intranet//ES", events, "END:VCALENDAR"].join("\n");
  }
}
