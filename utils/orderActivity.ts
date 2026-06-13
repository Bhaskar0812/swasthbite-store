import type { DashboardData, DashboardOrder } from "types";

export const FINAL_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled",
  "skipped",
  "missed",
  "failed",
]);

export const PENDING_STATUSES = new Set(["pending", "scheduled"]);

export type OrderActivityStats = {
  active: number;
  pending: number;
  preparing: number;
  outForDelivery: number;
  delivered: number;
  urgentInstant: number;
};

export const normalizeText = (value?: string | null) => {
  const normalized = String(value || "").trim();
  return normalized && normalized !== "-" ? normalized : "";
};

export const getOrderId = (order: DashboardOrder) =>
  String(
    (order as any)?.subscription_id ||
      order._id ||
      (order as any)?.order_id ||
      (order as any)?.id ||
      "",
  ).trim();

export const getOrderTitle = (order: DashboardOrder) =>
  normalizeText(order.meal_name) ||
  normalizeText(order.package_name) ||
  "Order";

export const isFinalStatus = (status?: string) =>
  FINAL_STATUSES.has(String(status || "").toLowerCase());

/** Deliveries hidden from store lists (customer skipped / missed / cancelled). */
export const isHiddenStoreDelivery = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return value === "skipped" || value === "missed" || value === "cancelled";
};

export const filterVisibleStoreOrders = (orders: DashboardOrder[] = []) =>
  orders.filter((order) => !isHiddenStoreDelivery(order.status));

export const isInstantOrder = (order: DashboardOrder) =>
  String(order.delivery_mode || "").toLowerCase() === "instant";

export const isPendingAcceptance = (order: DashboardOrder) =>
  PENDING_STATUSES.has(String(order.status || "").toLowerCase());

export const isPreparingStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return ["preparing", "assigned", "accepted", "ready"].includes(value);
};

export const isOutForDeliveryStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return ["out_for_delivery", "picked_up"].includes(value);
};

export const isDeliveredStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return ["delivered", "completed"].includes(value);
};

export const isActionableOrder = (order: DashboardOrder) =>
  !isFinalStatus(order.status);

export const getInstantDeadline = (order: DashboardOrder) => {
  if (!isInstantOrder(order)) return 0;
  if (order.instant_deadline_at) {
    const deadline = new Date(order.instant_deadline_at).getTime();
    if (!Number.isNaN(deadline) && deadline > 0) return deadline;
  }
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return createdAt ? createdAt + 2 * 60 * 1000 : 0;
};

export const formatCountdown = (
  deadlineAt: number,
  now = Date.now(),
  options: { withSeconds?: boolean } = {},
) => {
  if (!deadlineAt) return "";
  const remainingMs = Math.max(0, deadlineAt - now);
  if (remainingMs <= 0) return "Time up";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (options.withSeconds) {
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return options.withSeconds ? `${seconds}s left` : "Under 1m left";
};

export const formatStatusLabel = (status?: string) => {
  const value = String(status || "").toLowerCase();
  switch (value) {
    case "pending":
      return "Pending";
    case "scheduled":
      return "Scheduled";
    case "preparing":
      return "Preparing";
    case "accepted":
      return "Accepted";
    case "assigned":
      return "Assigned";
    case "out_for_delivery":
      return "Out for Delivery";
    case "picked_up":
      return "Picked Up";
    default:
      return value ? value.replaceAll("_", " ") : "Active";
  }
};

export const SLOT_ORDER: Record<string, number> = {
  morning: 1,
  lunch: 2,
  evening: 3,
  dinner: 4,
};

export const getSlotSortRank = (slot?: string) =>
  SLOT_ORDER[String(slot || "").trim().toLowerCase()] ?? 99;

export const getOrderDeliveryTimestamp = (order: DashboardOrder) => {
  const raw = order.date || order.createdAt;
  if (!raw) return 0;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const getOrderDeliveryDateKey = (order: DashboardOrder, now = Date.now()) => {
  const ts = getOrderDeliveryTimestamp(order);
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

export const getTodayDateKey = (now = Date.now()) =>
  new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const getTomorrowDateKey = (now = Date.now()) =>
  new Date(now + 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

export const formatSlotLabel = (slot?: string) => {
  const normalized = String(slot || "").trim().toLowerCase();
  if (!normalized) return "Scheduled";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/** Prominent delivery date for store cards — Today/Tomorrow + weekday. */
export const formatDeliveryDateLabel = (
  order: DashboardOrder,
  now = Date.now(),
) => {
  const ts = getOrderDeliveryTimestamp(order);
  if (!ts) return "Date unavailable";

  const dateKey = getOrderDeliveryDateKey(order, now);
  const todayKey = getTodayDateKey(now);
  const tomorrowKey = getTomorrowDateKey(now);

  const formatted = new Date(ts).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  if (dateKey === todayKey) return `Today • ${formatted}`;
  if (dateKey === tomorrowKey) return `Tomorrow • ${formatted}`;
  return formatted;
};

export const compareStoreOrdersByDateAndSlot = (
  a: DashboardOrder,
  b: DashboardOrder,
  options: {
    dateDirection?: "asc" | "desc";
    instantFirst?: boolean;
  } = {},
) => {
  const { dateDirection = "asc", instantFirst = true } = options;

  if (instantFirst) {
    const aInstant = isInstantOrder(a);
    const bInstant = isInstantOrder(b);
    if (aInstant !== bInstant) return aInstant ? -1 : 1;
  }

  const aDate = getOrderDeliveryTimestamp(a);
  const bDate = getOrderDeliveryTimestamp(b);
  if (aDate !== bDate) {
    return dateDirection === "asc" ? aDate - bDate : bDate - aDate;
  }

  return getSlotSortRank(a.slot) - getSlotSortRank(b.slot);
};

export const sortStoreOrdersByDateAndSlot = (
  orders: DashboardOrder[],
  options?: {
    dateDirection?: "asc" | "desc";
    instantFirst?: boolean;
  },
) =>
  [...orders].sort((a, b) => compareStoreOrdersByDateAndSlot(a, b, options));

/** Today orders first, then tomorrow; lunch before dinner within each day. */
export const sortUpcomingStoreOrders = (orders: DashboardOrder[], now = Date.now()) => {
  const todayKey = getTodayDateKey(now);
  const tomorrowKey = getTomorrowDateKey(now);

  return [...orders].sort((a, b) => {
    const aInstant = isInstantOrder(a);
    const bInstant = isInstantOrder(b);
    if (aInstant !== bInstant) return aInstant ? -1 : 1;

    const aKey = getOrderDeliveryDateKey(a, now) || todayKey;
    const bKey = getOrderDeliveryDateKey(b, now) || todayKey;

    const dayRank = (key: string) => {
      if (key === todayKey) return 0;
      if (key === tomorrowKey) return 1;
      return 2;
    };

    const aDay = dayRank(aKey);
    const bDay = dayRank(bKey);
    if (aDay !== bDay) return aDay - bDay;

    if (aKey !== bKey) return aKey.localeCompare(bKey);

    return getSlotSortRank(a.slot) - getSlotSortRank(b.slot);
  });
};

export const formatDueTime = (order: DashboardOrder) => {
  if (isInstantOrder(order)) return "Due now";
  const dateTime = order.date
    ? new Date(order.date).getTime()
    : order.createdAt
      ? new Date(order.createdAt).getTime()
      : 0;
  if (!dateTime) return formatSlotLabel(order.slot);
  return new Date(dateTime).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getActionableOrders = (
  dashboard: DashboardData | null | undefined,
) => {
  if (!dashboard) return [];

  return filterVisibleStoreOrders([
    ...(dashboard.today_orders || []),
    ...(dashboard.tomorrow_orders || []),
  ]).filter(isActionableOrder);
};

export const getOrderCardKey = (order: DashboardOrder) =>
  String(
    (order as any)?._id ||
      (order as any)?.order_id ||
      (order as any)?.subscription_id ||
      (order as any)?.id ||
      "",
  ).trim();

const getPartnerStatusRank = (order: DashboardOrder) => {
  const status = String(order.status || "").toLowerCase();
  if (isInstantOrder(order) && isPendingAcceptance(status)) return 0;
  if (isPendingAcceptance(status)) return 1;
  if (isPreparingStatus(status)) return 2;
  if (isOutForDeliveryStatus(status)) return 3;
  return 99;
};

/** Zomato-style queue: urgent instant → new pending → preparing → out for delivery. */
export const sortPartnerOrderQueue = (
  orders: DashboardOrder[],
  now = Date.now(),
) =>
  [...orders].sort((a, b) => {
    const aRank = getPartnerStatusRank(a);
    const bRank = getPartnerStatusRank(b);
    if (aRank !== bRank) return aRank - bRank;

    if (aRank === 0) {
      return getInstantDeadline(a) - getInstantDeadline(b);
    }

    if (aRank === 1) {
      const aCreated = new Date(a.createdAt || 0).getTime();
      const bCreated = new Date(b.createdAt || 0).getTime();
      if (aCreated !== bCreated) return bCreated - aCreated;
    }

    return compareStoreOrdersByDateAndSlot(a, b, {
      instantFirst: false,
      dateDirection: "asc",
    });
  });

export const buildPartnerOrderQueue = (
  dashboard: DashboardData | null | undefined,
  now = Date.now(),
) => sortPartnerOrderQueue(getActionableOrders(dashboard), now);

export const sortActiveOrdersForBoard = (orders: DashboardOrder[]) => {
  return [...orders].sort((a, b) => {
    const aInstant = isInstantOrder(a);
    const bInstant = isInstantOrder(b);

    if (aInstant && bInstant) {
      const aDeadline = getInstantDeadline(a);
      const bDeadline = getInstantDeadline(b);
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    } else if (aInstant !== bInstant) {
      return aInstant ? -1 : 1;
    }

    const aPending = isPendingAcceptance(a) ? 0 : 1;
    const bPending = isPendingAcceptance(b) ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;

    const aPreparing = isPreparingStatus(a.status) ? 0 : 1;
    const bPreparing = isPreparingStatus(b.status) ? 0 : 1;
    if (aPreparing !== bPreparing) return aPreparing - bPreparing;

    return compareStoreOrdersByDateAndSlot(a, b, { instantFirst: false });
  });
};

export const getOrderActivityStats = (
  dashboard: DashboardData | null | undefined,
  now = Date.now(),
): OrderActivityStats => {
  const todayOrders = dashboard?.today_orders || [];

  const pending = todayOrders.filter((order) =>
    isPendingAcceptance(order),
  ).length;
  const preparing = todayOrders.filter((order) =>
    isPreparingStatus(order.status),
  ).length;
  const outForDelivery = todayOrders.filter((order) =>
    isOutForDeliveryStatus(order.status),
  ).length;
  const delivered = todayOrders.filter((order) =>
    isDeliveredStatus(order.status),
  ).length;
  const active = getActionableOrders(dashboard).length;
  const urgentInstant = todayOrders.filter((order) => {
    if (!isInstantOrder(order) || isFinalStatus(order.status)) return false;
    const deadline = getInstantDeadline(order);
    return deadline > 0 && deadline <= now;
  }).length;

  return {
    active,
    pending,
    preparing,
    outForDelivery,
    delivered,
    urgentInstant,
  };
};

export const pickFocusOrder = (
  dashboard: DashboardData | null | undefined,
): DashboardOrder | null => {
  const sorted = sortActiveOrdersForBoard(getActionableOrders(dashboard));
  return sorted[0] || null;
};

export const formatOrderActivityLine = (
  order: DashboardOrder,
  index: number,
  now = Date.now(),
) => {
  const shortId = getOrderId(order).slice(-6).toUpperCase();
  const status = formatStatusLabel(order.status);
  const title = getOrderTitle(order);

  if (isInstantOrder(order)) {
    const countdown = formatCountdown(getInstantDeadline(order), now);
    return `${index}. ⚡ #${shortId} • ${status} • ${countdown} • ${title}`;
  }

  if (isPendingAcceptance(order)) {
    return `${index}. #${shortId} • ${status} • Accept now • ${title}`;
  }

  return `${index}. #${shortId} • ${status} • Due ${formatDueTime(order)} • ${title}`;
};

export const buildMultiOrderSummary = (
  dashboard: DashboardData | null | undefined,
  now = Date.now(),
  limit = 4,
) => {
  const orders = sortActiveOrdersForBoard(getActionableOrders(dashboard));
  const stats = getOrderActivityStats(dashboard, now);

  if (!orders.length) {
    return {
      title: "No active orders",
      subtitle: "Waiting for next order",
      lines: [] as string[],
      focusOrder: null as DashboardOrder | null,
      stats,
    };
  }

  const focusOrder = orders[0];
  const lines = orders
    .slice(0, limit)
    .map((order, index) => formatOrderActivityLine(order, index + 1, now));

  const title =
    orders.length === 1
      ? `${formatStatusLabel(focusOrder.status)}: ${getOrderTitle(focusOrder)}`
      : `${orders.length} Active Orders`;

  const headline = [
    `Pending ${stats.pending}`,
    `Prep ${stats.preparing}`,
    `Out ${stats.outForDelivery}`,
    `Done ${stats.delivered}`,
  ].join(" • ");

  const focusLine = isInstantOrder(focusOrder)
    ? `⚡ ${formatCountdown(getInstantDeadline(focusOrder), now, { withSeconds: false })} on #${getOrderId(focusOrder).slice(-6).toUpperCase()}`
    : `${formatStatusLabel(focusOrder.status)} • #${getOrderId(focusOrder).slice(-6).toUpperCase()}`;

  return {
    title,
    subtitle: [headline, focusLine].filter(Boolean).join("\n"),
    lines,
    focusOrder,
    stats,
  };
};
