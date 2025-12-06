import { column, defineTable, NOW } from "astro:db";

/**
 * A course the user wants to track.
 * Example: "React for Beginners", "Class 11 Physics – Term 1", etc.
 */
export const Courses = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // Creator/owner (parent app Users.id)
    ownerId: column.text(),

    title: column.text(),
    description: column.text({ optional: true }),

    // Optional metadata about where the course lives
    provider: column.text({ optional: true }), // "Udemy", "Coursera", "School", etc.
    platform: column.text({ optional: true }), // specific platform name
    url: column.text({ optional: true }),

    level: column.text({
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    }),

    tags: column.text({ optional: true }),

    status: column.text({
      enum: ["planned", "in_progress", "completed", "dropped"],
      default: "planned",
    }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Items inside a course.
 * One table for lessons, modules, assignments, quizzes, etc.
 */
export const CourseItems = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    courseId: column.number({ references: () => Courses.columns.id }),

    // Type of item
    type: column.text({
      enum: ["lesson", "module", "assignment", "quiz", "exam", "other"],
      default: "lesson",
    }),

    title: column.text(),
    description: column.text({ optional: true }),

    // Order inside course
    position: column.number({ default: 0 }),

    // Optional due date (for assignments / exams)
    dueDate: column.date({ optional: true }),

    // Estimated effort in minutes
    estimatedMinutes: column.number({ optional: true }),

    isRequired: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * High-level progress for a specific user on a course.
 */
export const CourseProgress = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    courseId: column.number({ references: () => Courses.columns.id }),

    // Learner (can be different from ownerId)
    userId: column.text(),

    status: column.text({
      enum: ["not_started", "in_progress", "completed", "dropped"],
      default: "not_started",
    }),

    startedAt: column.date({ optional: true }),
    completedAt: column.date({ optional: true }),

    // Aggregated stats
    completionPercent: column.number({ default: 0 }), // 0–100
    totalItems: column.number({ default: 0 }),
    completedItems: column.number({ default: 0 }),

    // For quick resume
    lastVisitedItemId: column.number({
      references: () => CourseItems.columns.id,
      optional: true,
    }),

    meta: column.json({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Per-item progress for a user inside a course.
 */
export const CourseItemProgress = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    itemId: column.number({ references: () => CourseItems.columns.id }),
    userId: column.text(),

    status: column.text({
      enum: ["not_started", "in_progress", "completed", "skipped"],
      default: "not_started",
    }),

    startedAt: column.date({ optional: true }),
    completedAt: column.date({ optional: true }),

    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const courseTrackerTables = {
  Courses,
  CourseItems,
  CourseProgress,
  CourseItemProgress,
} as const;
