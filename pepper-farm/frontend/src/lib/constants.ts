export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const ROLE_ROUTES: Record<string, string> = {
  FarmManager: "/manager",
  Worker:      "/worker",
  Visitor:     "/visitor",
};