// Shared constants for premium plans (safe for client + server)
export type Plan = "free" | "premium";

export const PLAN_LIMITS: Record<Plan, { dailySearches: number; historyKept: number | "unlimited"; exportsPerDay: number | "unlimited" }> = {
  free: { dailySearches: 20, historyKept: 10, exportsPerDay: 3 },
  premium: { dailySearches: 500, historyKept: "unlimited", exportsPerDay: "unlimited" },
};

export const PREMIUM_PRICE_EUR = 9.99;
