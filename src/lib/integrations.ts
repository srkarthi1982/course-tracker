type DashboardPayload = {
  userId: string;
  appId: "course-tracker";
  activeCourses: number;
  completedCourses: number;
  pausedCourses: number;
  archivedCourses: number;
  completionRate: number;
  updatedAt: string;
};

type NotificationPayload = {
  userId: string;
  appId: "course-tracker";
  title: string;
  body: string;
  level?: "info" | "success";
};

async function postJson(url: string | undefined, payload: unknown) {
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Intentionally no throw; integrations are best-effort.
  }
}

export async function pushDashboardSummary(summary: DashboardPayload) {
  await postJson(import.meta.env.ANSIVERSA_DASHBOARD_HOOK_URL, summary);
}

export async function pushNotification(notification: NotificationPayload) {
  await postJson(import.meta.env.ANSIVERSA_NOTIFICATIONS_HOOK_URL, notification);
}
