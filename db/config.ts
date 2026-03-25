import { defineDb } from "astro:db";
import { Courses } from "./tables";

export default defineDb({
  tables: {
    Courses,
  },
});
