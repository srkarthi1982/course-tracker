import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, db, desc, eq, ilike, or, Courses, sql } from "astro:db";
import { pushDashboardSummary, pushNotification } from "../lib/integrations";

const statusSchema = z.enum(["active", "completed", "paused", "archived"]);

function requireUser(context: ActionAPIContext) {
  const user = (context.locals as App.Locals | undefined)?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "Sign in required.",
    });
  }

  return user;
}

function cleanInput(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateModules(totalModules?: number, completedModules?: number) {
  if (
    typeof totalModules === "number" &&
    typeof completedModules === "number" &&
    completedModules > totalModules
  ) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "Completed modules cannot exceed total modules.",
    });
  }
}

async function getOwnedCourse(userId: string, courseId: number) {
  const [course] = await db
    .select()
    .from(Courses)
    .where(and(eq(Courses.id, courseId), eq(Courses.userId, userId)))
    .limit(1);

  if (!course) {
    throw new ActionError({ code: "NOT_FOUND", message: "Course not found." });
  }

  return course;
}

async function emitDashboardSummary(userId: string) {
  const rows = await db
    .select({ status: Courses.status, count: sql<number>`count(*)` })
    .from(Courses)
    .where(eq(Courses.userId, userId))
    .groupBy(Courses.status);

  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status as keyof typeof acc] = Number(row.count);
      return acc;
    },
    { active: 0, completed: 0, paused: 0, archived: 0 },
  );

  const total = counts.active + counts.completed + counts.paused + counts.archived;
  const completionRate = total === 0 ? 0 : Math.round((counts.completed / total) * 100);

  await pushDashboardSummary({
    userId,
    appId: "course-tracker",
    activeCourses: counts.active,
    completedCourses: counts.completed,
    pausedCourses: counts.paused,
    archivedCourses: counts.archived,
    completionRate,
    updatedAt: new Date().toISOString(),
  });
}

export const server = {
  createCourse: defineAction({
    input: z.object({
      title: z.string().min(1, "Course title is required."),
      provider: z.string().optional(),
      subject: z.string().optional(),
      notes: z.string().optional(),
      progressPercent: z.number().min(0).max(100).optional(),
      totalModules: z.number().int().min(0).optional(),
      completedModules: z.number().int().min(0).optional(),
      startedAt: z.coerce.date().optional(),
      difficulty: z.string().optional(),
      url: z.string().url().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      validateModules(input.totalModules, input.completedModules);

      const now = new Date();
      const [course] = await db
        .insert(Courses)
        .values({
          userId: user.id,
          title: input.title.trim(),
          provider: cleanInput(input.provider),
          subject: cleanInput(input.subject),
          notes: cleanInput(input.notes),
          progressPercent: input.progressPercent ?? 0,
          totalModules: input.totalModules,
          completedModules: input.completedModules,
          startedAt: input.startedAt,
          difficulty: cleanInput(input.difficulty),
          url: cleanInput(input.url),
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await emitDashboardSummary(user.id);
      await pushNotification({
        userId: user.id,
        appId: "course-tracker",
        title: "Course added",
        body: `${course.title} is now in your tracker.`,
        level: "success",
      });

      return { course };
    },
  }),

  updateCourse: defineAction({
    input: z.object({
      id: z.number().int(),
      title: z.string().min(1).optional(),
      provider: z.string().optional(),
      subject: z.string().optional(),
      notes: z.string().optional(),
      status: statusSchema.optional(),
      progressPercent: z.number().min(0).max(100).optional(),
      totalModules: z.number().int().min(0).nullable().optional(),
      completedModules: z.number().int().min(0).nullable().optional(),
      startedAt: z.coerce.date().nullable().optional(),
      completedAt: z.coerce.date().nullable().optional(),
      difficulty: z.string().optional(),
      url: z.string().url().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnedCourse(user.id, input.id);

      validateModules(
        input.totalModules ?? existing.totalModules ?? undefined,
        input.completedModules ?? existing.completedModules ?? undefined,
      );

      const nextStatus = input.status ?? existing.status;

      const [course] = await db
        .update(Courses)
        .set({
          title: input.title ? input.title.trim() : existing.title,
          provider: input.provider !== undefined ? cleanInput(input.provider) : existing.provider,
          subject: input.subject !== undefined ? cleanInput(input.subject) : existing.subject,
          notes: input.notes !== undefined ? cleanInput(input.notes) : existing.notes,
          status: nextStatus,
          progressPercent: input.progressPercent ?? existing.progressPercent,
          totalModules: input.totalModules === undefined ? existing.totalModules : input.totalModules ?? undefined,
          completedModules:
            input.completedModules === undefined
              ? existing.completedModules
              : input.completedModules ?? undefined,
          startedAt: input.startedAt === undefined ? existing.startedAt : input.startedAt ?? undefined,
          completedAt:
            input.completedAt === undefined
              ? nextStatus === "completed"
                ? existing.completedAt ?? new Date()
                : existing.completedAt
              : input.completedAt ?? undefined,
          archivedAt:
            nextStatus === "archived"
              ? existing.archivedAt ?? new Date()
              : input.status === "active" || input.status === "paused" || input.status === "completed"
                ? undefined
                : existing.archivedAt,
          difficulty: input.difficulty !== undefined ? cleanInput(input.difficulty) : existing.difficulty,
          url: input.url !== undefined ? cleanInput(input.url) : existing.url,
          updatedAt: new Date(),
        })
        .where(and(eq(Courses.id, input.id), eq(Courses.userId, user.id)))
        .returning();

      await emitDashboardSummary(user.id);
      return { course };
    },
  }),

  archiveCourse: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnedCourse(user.id, input.id);

      const [course] = await db
        .update(Courses)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(Courses.id, input.id), eq(Courses.userId, user.id)))
        .returning();

      await emitDashboardSummary(user.id);
      await pushNotification({
        userId: user.id,
        appId: "course-tracker",
        title: "Course archived",
        body: `${existing.title} moved to archived.`,
      });

      return { course };
    },
  }),

  restoreCourse: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCourse(user.id, input.id);

      const [course] = await db
        .update(Courses)
        .set({ status: "active", archivedAt: undefined, updatedAt: new Date() })
        .where(and(eq(Courses.id, input.id), eq(Courses.userId, user.id)))
        .returning();

      await emitDashboardSummary(user.id);
      return { course };
    },
  }),

  markCourseCompleted: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnedCourse(user.id, input.id);

      const [course] = await db
        .update(Courses)
        .set({
          status: "completed",
          progressPercent: 100,
          completedAt: new Date(),
          archivedAt: undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(Courses.id, input.id), eq(Courses.userId, user.id)))
        .returning();

      await emitDashboardSummary(user.id);
      await pushNotification({
        userId: user.id,
        appId: "course-tracker",
        title: "Course completed",
        body: `Nice work! You completed ${existing.title}.`,
        level: "success",
      });

      return { course };
    },
  }),

  listCourses: defineAction({
    input: z
      .object({
        status: statusSchema.optional(),
        search: z.string().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [eq(Courses.userId, user.id)];

      if (input?.status) filters.push(eq(Courses.status, input.status));
      if (input?.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        filters.push(
          or(
            ilike(Courses.title, term),
            ilike(Courses.provider, term),
            ilike(Courses.subject, term),
          )!,
        );
      }

      const courses = await db
        .select()
        .from(Courses)
        .where(and(...filters))
        .orderBy(desc(Courses.updatedAt));

      return { courses };
    },
  }),

  getCourseDetail: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const course = await getOwnedCourse(user.id, input.id);
      return { course };
    },
  }),
};
