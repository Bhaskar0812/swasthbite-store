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

export const formatSlotLabel = (slot?: string) => {
  const normalized = String(slot || "").trim().toLowerCase();
  if (!normalized) return "Scheduled";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

const toDateTime = (order: DashboardOrder) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  const dateOnly = order.date ? new Date(order.date).getTime() : 0;
  return createdAt || dateOnly || 0;
};

export const getActionableOrders = (
  dashboard: DashboardData | null | undefined,
) => {
  if (!dashboard) return [];

  return [
    ...(dashboard.today_orders || []),
    ...(dashboard.tomorrow_orders || []),
  ].filter(isActionableOrder);
};

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

    return toDateTime(a) - toDateTime(b);
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
