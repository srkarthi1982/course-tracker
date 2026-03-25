import { column, defineTable, NOW } from "astro:db";

export const Courses = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    title: column.text(),
    provider: column.text({ optional: true }),
    subject: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    status: column.text({
      enum: ["active", "completed", "paused", "archived"],
      default: "active",
    }),
    progressPercent: column.number({ default: 0 }),
    totalModules: column.number({ optional: true }),
    completedModules: column.number({ optional: true }),
    startedAt: column.date({ optional: true }),
    completedAt: column.date({ optional: true }),
    archivedAt: column.date({ optional: true }),
    difficulty: column.text({ optional: true }),
    url: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [
    { on: ["userId", "status"] },
    { on: ["userId", "provider"] },
    { on: ["userId", "subject"] },
    { on: ["userId", "updatedAt"] },
  ],
});

export const courseTrackerTables = { Courses } as const;
