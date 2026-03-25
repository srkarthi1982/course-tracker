import type { Alpine } from "alpinejs";
import { actions } from "astro:actions";

type Course = {
  id: number;
  title: string;
  provider?: string | null;
  subject?: string | null;
  notes?: string | null;
  status: "active" | "completed" | "paused" | "archived";
  progressPercent: number;
  totalModules?: number | null;
  completedModules?: number | null;
  updatedAt: string;
};

export default function initAlpine(Alpine: Alpine) {
  Alpine.store("courseTracker", {
    courses: [] as Course[],
    search: "",
    activeTab: "overview" as "overview" | "courses" | "completed" | "archived",
    activeCourse: null as Course | null,
    isCreateOpen: false,
    isEditOpen: false,
    loading: false,
    submitting: false,
    flash: { type: "", message: "" },

    init(courses: Course[]) {
      this.courses = courses;
    },

    setTab(tab: "overview" | "courses" | "completed" | "archived") {
      this.activeTab = tab;
    },

    get filteredCourses() {
      const term = this.search.trim().toLowerCase();
      return this.courses.filter((course) => {
        const matchesTab =
          this.activeTab === "overview" ||
          (this.activeTab === "courses" && ["active", "paused"].includes(course.status)) ||
          (this.activeTab === "completed" && course.status === "completed") ||
          (this.activeTab === "archived" && course.status === "archived");

        if (!matchesTab) return false;
        if (!term) return true;

        return [course.title, course.provider, course.subject]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    },

    get summary() {
      return this.courses.reduce(
        (acc, course) => {
          acc.total += 1;
          acc[course.status] += 1;
          return acc;
        },
        { total: 0, active: 0, completed: 0, paused: 0, archived: 0 },
      );
    },

    async refresh() {
      this.loading = true;
      const result = await actions.listCourses({});
      this.loading = false;

      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }

      this.courses = result.data.courses as Course[];
    },

    async createCourse(formData: Record<string, unknown>) {
      this.submitting = true;
      const result = await actions.createCourse(formData);
      this.submitting = false;

      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }

      this.flash = { type: "success", message: "Course created." };
      this.isCreateOpen = false;
      await this.refresh();
    },

    async updateCourse(formData: Record<string, unknown>) {
      this.submitting = true;
      const result = await actions.updateCourse(formData);
      this.submitting = false;

      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }

      this.flash = { type: "success", message: "Course updated." };
      this.isEditOpen = false;
      this.activeCourse = null;
      await this.refresh();
    },

    async markCompleted(id: number) {
      const result = await actions.markCourseCompleted({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course marked completed." };
      await this.refresh();
    },

    async archive(id: number) {
      const result = await actions.archiveCourse({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course archived." };
      await this.refresh();
    },

    async restore(id: number) {
      const result = await actions.restoreCourse({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course restored." };
      await this.refresh();
    },

    openEdit(course: Course) {
      this.activeCourse = course;
      this.isEditOpen = true;
    },
  });
}
