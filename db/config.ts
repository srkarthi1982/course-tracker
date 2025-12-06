import { defineDb } from "astro:db";
import {
  Courses,
  CourseItems,
  CourseProgress,
  CourseItemProgress,
} from "./tables";

export default defineDb({
  tables: {
    Courses,
    CourseItems,
    CourseProgress,
    CourseItemProgress,
  },
});
