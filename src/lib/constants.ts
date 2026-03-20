export const REWARD_THRESHOLD = 10;

export const CATEGORIES = ["coffee", "lemonade"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  coffee: "Coffee",
  lemonade: "Drinks",
};

export const ORDER_STATUS_FLOW = [
  "pending",
  "preparing",
  "ready",
  "completed",
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
