# App Spec: course-tracker

## 1) App Overview
- **App Name:** Course Tracker
- **Category:** Education / Progress Tracking
- **Version:** V1
- **App Type:** DB-backed
- **Purpose:** Help an authenticated user track courses, progress, completion state, and archive status in a personal workspace.
- **Primary User:** A signed-in user managing their own course records.

## 2) User Stories
- As a user, I want to create a course record, so that I can track study or learning progress.
- As a user, I want to update course progress and mark completion, so that my dashboard reflects current status.
- As a user, I want to archive and restore courses safely, so that I can keep history without deleting it.

## 3) Core Workflow
1. User signs in and opens `/app`.
2. User creates a course from the workspace form.
3. App stores the course in the user-scoped database and lists it in the workspace.
4. User opens the detail page to edit the course or change progress/completion state.
5. User archives or restores the course as needed and returns to the workspace.

## 4) Functional Behavior
- Course records are scoped to the authenticated user and persisted in the app database.
- The app supports create, update, progress tracking, completion state changes, archive, and restore; hard delete is not part of V1.
- `/app` is protected and redirects to the parent login flow when unauthenticated.
- Invalid or missing detail routes and cross-user course access resolve safely back to the workspace instead of returning `500`.

## 5) Data & Storage
- **Storage type:** Astro DB on the app’s isolated Turso database
- **Main entities:** Courses
- **Persistence expectations:** Per-user course records persist across refresh and new sessions.
- **User model:** Multi-user shared infrastructure with per-user isolation

## 6) Special Logic (Optional)
- Validation prevents invalid progress combinations such as completed modules exceeding total modules.
- The canonical ownership field in the runtime and schema is `userId`.

## 7) Edge Cases & Error Handling
- Invalid IDs/routes: Invalid course detail routes resolve safely back to `/app`.
- Empty input: Invalid create or update payloads are rejected by the action layer.
- Unauthorized access: `/app` redirects to the parent login flow.
- Missing records: Missing or non-owned course detail requests redirect safely back to the workspace.
- Invalid payload/state: Invalid progress combinations surface as safe validation errors instead of corrupting data.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create a course, open its detail page, update it, and confirm the changes persist.
- [ ] Mark progress or completion, archive the course, restore it, and confirm the state changes are reflected correctly.

### Safety tests
- [ ] Attempt an invalid progress combination and confirm the app blocks it cleanly.
- [ ] Visit an invalid or missing course detail route and confirm safe workspace fallback.
- [ ] Attempt cross-user detail access and confirm the user is not shown another user’s course.

### Negative tests
- [ ] Confirm there is no hard-delete flow in V1.
- [ ] Confirm the workspace and detail pages do not return `500` after invalid route input.

## 9) Out of Scope (V1)
- Collaborative or shared course tracking
- Permanent delete / recovery workflows
- AI recommendations or automated lesson generation

## 10) Freeze Notes
- V1 release freeze: this document reflects the verified authenticated course-tracking workflow.
- Freeze Level 1 verification confirmed create, detail open, update, progress/completion changes, archive/restore, invalid-route handling, and cross-user protection.
- During freeze, only verification fixes and cleanup are allowed; no undocumented feature expansion.
