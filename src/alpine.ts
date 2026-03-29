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
  updatedAt: string | Date;
};

type CourseStatus = Course["status"];
type CourseTab = "overview" | "courses" | "completed" | "archived";
type FlashState = {
  type: "" | "error" | "success";
  message: string;
};
type CourseSummary = {
  total: number;
  active: number;
  completed: number;
  paused: number;
  archived: number;
};
type CreateCourseInput = {
  title: string;
  provider?: string;
  subject?: string;
  notes?: string;
  progressPercent?: number;
  totalModules?: number;
  completedModules?: number;
};
type UpdateCourseInput = {
  id: number;
  title?: string;
  provider?: string;
  subject?: string;
  notes?: string;
  status?: CourseStatus;
  progressPercent?: number;
  totalModules?: number | null;
  completedModules?: number | null;
};
type CourseTrackerStore = {
  courses: Course[];
  search: string;
  activeTab: CourseTab;
  activeCourse: Course | null;
  isCreateOpen: boolean;
  isEditOpen: boolean;
  loading: boolean;
  submitting: boolean;
  flash: FlashState;
  init(this: CourseTrackerStore, courses: Course[]): void;
  setTab(this: CourseTrackerStore, tab: CourseTab): void;
  readonly filteredCourses: Course[];
  readonly summary: CourseSummary;
  refresh(this: CourseTrackerStore): Promise<void>;
  createCourse(this: CourseTrackerStore, formData: CreateCourseInput): Promise<void>;
  updateCourse(this: CourseTrackerStore, formData: UpdateCourseInput): Promise<void>;
  markCompleted(this: CourseTrackerStore, id: number): Promise<void>;
  archive(this: CourseTrackerStore, id: number): Promise<void>;
  restore(this: CourseTrackerStore, id: number): Promise<void>;
  openEdit(this: CourseTrackerStore, course: Course): void;
};

function createCourseTrackerStore(): CourseTrackerStore {
  return {
    courses: [],
    search: "",
    activeTab: "overview",
    activeCourse: null,
    isCreateOpen: false,
    isEditOpen: false,
    loading: false,
    submitting: false,
    flash: { type: "", message: "" },

    init(this: CourseTrackerStore, courses: Course[]) {
      this.courses = courses;
    },

    setTab(this: CourseTrackerStore, tab: CourseTab) {
      this.activeTab = tab;
    },

    get filteredCourses() {
      const term = this.search.trim().toLowerCase();
      return this.courses.filter((course: Course) => {
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
      return this.courses.reduce<CourseSummary>(
        (acc, course) => {
          acc.total += 1;
          acc[course.status] += 1;
          return acc;
        },
        { total: 0, active: 0, completed: 0, paused: 0, archived: 0 },
      );
    },

    async refresh(this: CourseTrackerStore) {
      this.loading = true;
      const result = await actions.listCourses({});
      this.loading = false;

      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }

      this.courses = result.data.courses as unknown as Course[];
    },

    async createCourse(this: CourseTrackerStore, formData: CreateCourseInput) {
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

    async updateCourse(this: CourseTrackerStore, formData: UpdateCourseInput) {
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

    async markCompleted(this: CourseTrackerStore, id: number) {
      const result = await actions.markCourseCompleted({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course marked completed." };
      await this.refresh();
    },

    async archive(this: CourseTrackerStore, id: number) {
      const result = await actions.archiveCourse({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course archived." };
      await this.refresh();
    },

    async restore(this: CourseTrackerStore, id: number) {
      const result = await actions.restoreCourse({ id });
      if (result.error) {
        this.flash = { type: "error", message: result.error.message };
        return;
      }
      this.flash = { type: "success", message: "Course restored." };
      await this.refresh();
    },

    openEdit(this: CourseTrackerStore, course: Course) {
      this.activeCourse = course;
      this.isEditOpen = true;
    },
  };
}

export default function initAlpine(Alpine: Alpine) {
  Alpine.store("courseTracker", createCourseTrackerStore());
}
