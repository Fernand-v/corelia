import { describe, expect, it, vi } from "vitest";
import { CalendarService } from "../modules/calendar/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    GOOGLE_CALENDAR_CLIENT_ID: "",
    GOOGLE_CALENDAR_REDIRECT_URI: "",
    MICROSOFT_CALENDAR_CLIENT_ID: "",
    MICROSOFT_CALENDAR_REDIRECT_URI: ""
  }
}));

const createMockApp = () =>
  ({
    prisma: {
      task: {
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn()
      },
      availabilityBlock: {
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      workSchedule: {
        findUnique: vi.fn()
      },
      meetingParticipant: {
        findFirst: vi.fn()
      },
      meeting: {
        findMany: vi.fn()
      },
      externalCalendarEvent: {
        findMany: vi.fn(),
        upsert: vi.fn()
      },
      externalCalendarConnection: {
        upsert: vi.fn(),
        findFirst: vi.fn()
      },
      timeEntry: {
        aggregate: vi.fn()
      },
      teamMember: {
        findMany: vi.fn()
      },
      objective: {
        findMany: vi.fn()
      }
    }
  }) as unknown as ConstructorParameters<typeof CalendarService>[0];

describe("Calendar integration flows", () => {
  it("blocks task reschedule when assignee is on vacations", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: "t-1",
      assigneeId: "u-1",
      dependencies: []
    });
    app.prisma.availabilityBlock.findFirst = vi.fn().mockResolvedValue({
      id: "ab-1",
      type: "VACACIONES"
    });

    const service = new CalendarService(app);

    await expect(
      service.rescheduleTask({
        taskId: "t-1",
        dueDate: "2026-03-03T10:00:00.000Z",
        requesterId: "u-2",
        confirmOutOfSchedule: false,
        allowDependencyConflict: true
      })
    ).rejects.toThrow("vacaciones o ausencia");
  });
});
