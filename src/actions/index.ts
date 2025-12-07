import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  eq,
  and,
  Courses,
  CourseItems,
  CourseProgress,
  CourseItemProgress,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createCourse: defineAction({
    input: z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      provider: z.string().optional(),
      platform: z.string().optional(),
      url: z.string().url().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      tags: z.string().optional(),
      status: z.enum(["planned", "in_progress", "completed", "dropped"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [course] = await db
        .insert(Courses)
        .values({
          ownerId: user.id,
          title: input.title,
          description: input.description,
          provider: input.provider,
          platform: input.platform,
          url: input.url,
          level: input.level ?? "beginner",
          tags: input.tags,
          status: input.status ?? "planned",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { course };
    },
  }),

  updateCourse: defineAction({
    input: z.object({
      id: z.number().int(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      provider: z.string().optional(),
      platform: z.string().optional(),
      url: z.string().url().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      tags: z.string().optional(),
      status: z.enum(["planned", "in_progress", "completed", "dropped"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, id), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { course: existing };
      }

      const [course] = await db
        .update(Courses)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(Courses.id, id), eq(Courses.ownerId, user.id)))
        .returning();

      return { course };
    },
  }),

  listMyCourses: defineAction({
    input: z
      .object({
        status: z.enum(["planned", "in_progress", "completed", "dropped"]).optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const courses = await db.select().from(Courses).where(eq(Courses.ownerId, user.id));

      const filtered = input?.status
        ? courses.filter((course) => course.status === input.status)
        : courses;

      return { courses: filtered };
    },
  }),

  getCourseWithItems: defineAction({
    input: z.object({
      id: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [course] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, input.id), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!course) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const items = await db.select().from(CourseItems).where(eq(CourseItems.courseId, input.id));

      return { course, items };
    },
  }),

  saveCourseItem: defineAction({
    input: z.object({
      id: z.number().int().optional(),
      courseId: z.number().int(),
      type: z.enum(["lesson", "module", "assignment", "quiz", "exam", "other"]).optional(),
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      position: z.number().int().nonnegative().optional(),
      dueDate: z.coerce.date().optional(),
      estimatedMinutes: z.number().int().positive().optional(),
      isRequired: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [course] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, input.courseId), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!course) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const baseValues = {
        courseId: input.courseId,
        type: input.type ?? "lesson",
        title: input.title,
        description: input.description,
        position: input.position ?? 0,
        dueDate: input.dueDate,
        estimatedMinutes: input.estimatedMinutes,
        isRequired: input.isRequired ?? true,
        createdAt: new Date(),
      };

      if (input.id) {
        const [existing] = await db
          .select()
          .from(CourseItems)
          .where(eq(CourseItems.id, input.id))
          .limit(1);

        if (!existing || existing.courseId !== input.courseId) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Course item not found.",
          });
        }

        const [item] = await db
          .update(CourseItems)
          .set(baseValues)
          .where(eq(CourseItems.id, input.id))
          .returning();

        return { item };
      }

      const [item] = await db.insert(CourseItems).values(baseValues).returning();
      return { item };
    },
  }),

  deleteCourseItem: defineAction({
    input: z.object({
      id: z.number().int(),
      courseId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [course] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, input.courseId), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!course) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const [deleted] = await db
        .delete(CourseItems)
        .where(and(eq(CourseItems.id, input.id), eq(CourseItems.courseId, input.courseId)))
        .returning();

      if (!deleted) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course item not found.",
        });
      }

      return { item: deleted };
    },
  }),

  upsertCourseProgress: defineAction({
    input: z.object({
      courseId: z.number().int(),
      status: z.enum(["not_started", "in_progress", "completed", "dropped"]).optional(),
      completionPercent: z.number().int().min(0).max(100).optional(),
      totalItems: z.number().int().nonnegative().optional(),
      completedItems: z.number().int().nonnegative().optional(),
      lastVisitedItemId: z.number().int().optional(),
      meta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [course] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, input.courseId), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!course) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const [existing] = await db
        .select()
        .from(CourseProgress)
        .where(and(eq(CourseProgress.courseId, input.courseId), eq(CourseProgress.userId, user.id)))
        .limit(1);

      const baseValues = {
        courseId: input.courseId,
        userId: user.id,
        status: input.status ?? existing?.status ?? "not_started",
        completionPercent: input.completionPercent ?? existing?.completionPercent ?? 0,
        totalItems: input.totalItems ?? existing?.totalItems ?? 0,
        completedItems: input.completedItems ?? existing?.completedItems ?? 0,
        lastVisitedItemId: input.lastVisitedItemId ?? existing?.lastVisitedItemId,
        meta: input.meta ?? existing?.meta,
        startedAt: existing?.startedAt ?? new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        const [progress] = await db
          .update(CourseProgress)
          .set(baseValues)
          .where(eq(CourseProgress.id, existing.id))
          .returning();

        return { progress };
      }

      const [progress] = await db.insert(CourseProgress).values(baseValues).returning();
      return { progress };
    },
  }),

  updateCourseItemProgress: defineAction({
    input: z.object({
      itemId: z.number().int(),
      status: z.enum(["not_started", "in_progress", "completed", "skipped"]).optional(),
      startedAt: z.coerce.date().optional(),
      completedAt: z.coerce.date().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [item] = await db
        .select()
        .from(CourseItems)
        .where(eq(CourseItems.id, input.itemId))
        .limit(1);

      if (!item) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course item not found.",
        });
      }

      const [course] = await db
        .select()
        .from(Courses)
        .where(and(eq(Courses.id, item.courseId), eq(Courses.ownerId, user.id)))
        .limit(1);

      if (!course) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Course not found.",
        });
      }

      const [existing] = await db
        .select()
        .from(CourseItemProgress)
        .where(and(eq(CourseItemProgress.itemId, input.itemId), eq(CourseItemProgress.userId, user.id)))
        .limit(1);

      const baseValues = {
        itemId: input.itemId,
        userId: user.id,
        status: input.status ?? existing?.status ?? "not_started",
        startedAt: input.startedAt ?? existing?.startedAt,
        completedAt: input.completedAt ?? existing?.completedAt,
        notes: input.notes ?? existing?.notes,
      };

      if (existing) {
        const [progress] = await db
          .update(CourseItemProgress)
          .set(baseValues)
          .where(eq(CourseItemProgress.id, existing.id))
          .returning();

        return { progress };
      }

      const [progress] = await db.insert(CourseItemProgress).values(baseValues).returning();
      return { progress };
    },
  }),
};
