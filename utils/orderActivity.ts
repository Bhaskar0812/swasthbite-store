import type { DashboardData, DashboardOrder } from "types";
import {
  formatProgressStepLine,
  resolveStoreOrderProgress,
} from "./orderProgressSteps";

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

export const getOrderCustomerName = (order: DashboardOrder) =>
  normalizeText(order.user_name) || "Customer";

export const resolveOrderApiIds = (order: DashboardOrder) => {
  const candidates = [
    (order as any)?.order_id,
    (order as any)?.subscription_id,
    order?._id,
    (order as any)?.id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

export const resolveDeliveryIndexes = (order: DashboardOrder) => {
  const raw = [
    (order as any)?.delivery_index,
    (order as any)?.current_delivery_index,
    (order as any)?.next_delivery_index,
    0,
  ];

  const normalized = raw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0);

  return Array.from(new Set(normalized));
};

export const getStoreQuickAction = (
  status?: string,
): { label: string; value: string } | null => {
  const value = String(status || "").toLowerCase();
  if (isPendingStatus(value)) {
    return { label: "Start Preparing", value: "preparing" };
  }
  if (isPreparingStatus(value)) {
    return { label: "Mark Out for Delivery", value: "out_for_delivery" };
  }
  return null;
};

export const isFinalStatus = (status?: string) =>
  FINAL_STATUSES.has(String(status || "").toLowerCase());

/** Deliveries hidden from store lists (customer skipped / missed / cancelled). */
export const isHiddenStoreDelivery = (
  status?: string,
  skippedBy?: string | null,
) => {
  const value = String(status || "").toLowerCase();
  if (value === "skipped" || value === "missed" || value === "cancelled") {
    return true;
  }
  return String(skippedBy || "").toLowerCase() === "wallet";
};

export const filterVisibleStoreOrders = (orders: DashboardOrder[] = []) =>
  orders.filter(
    (order) =>
      !isHiddenStoreDelivery(order.status, (order as any)?.skipped_by),
  );

export const isInstantOrder = (order: DashboardOrder) =>
  String(order.delivery_mode || "").toLowerCase() === "instant";

export const isPendingStatus = (status?: string) =>
  PENDING_STATUSES.has(String(status || "").toLowerCase());

export const isPendingAcceptance = (orderOrStatus: DashboardOrder | string) => {
  const status =
    typeof orderOrStatus === "string"
      ? orderOrStatus
      : String(orderOrStatus?.status || "");
  return isPendingStatus(status);
};

/** Full-screen alert + loud ring — instant orders and explicit pending only (not routine scheduled). */
export const requiresBlockingIncomingAlert = (order: DashboardOrder) => {
  const status = String(order.status || "").toLowerCase();
  if (isInstantOrder(order)) return isPendingAcceptance(status);
  return status === "pending";
};

export const isPreparingStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return ["preparing", "assigned", "accepted", "ready"].includes(value);
};

export const isOutForDeliveryStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  return ["out_for_delivery", "picked_up"].includes(value);
};

export type PrepBucket = "to_prepare" | "preparing" | "out";

export const PREP_BUCKETS: {
  key: PrepBucket;
  label: string;
  short: string;
}[] = [
  { key: "to_prepare", label: "To prepare", short: "Prep" },
  { key: "preparing", label: "Preparing", short: "Kitchen" },
  { key: "out", label: "Out", short: "Out" },
];

/** Map a delivery into the store prep queue bucket. */
export const getPrepBucket = (order: DashboardOrder): PrepBucket | null => {
  const status = String(order?.status || "").toLowerCase();
  if (isHiddenStoreDelivery(status, (order as any)?.skipped_by)) return null;
  if (["delivered", "completed", "failed"].includes(status)) return null;
  if (isOutForDeliveryStatus(status)) return "out";
  if (isPreparingStatus(status)) return "preparing";
  if (
    ["scheduled", "pending", "accepted"].includes(status) ||
    isPendingAcceptance(order)
  ) {
    return "to_prepare";
  }
  return null;
};

export const filterOrdersByPrepBucket = (
  orders: DashboardOrder[] = [],
  bucket: PrepBucket | "all",
) => {
  if (bucket === "all") {
    return orders.filter((o) => getPrepBucket(o) != null);
  }
  return orders.filter((o) => getPrepBucket(o) === bucket);
};

export const countOrdersByPrepBucket = (orders: DashboardOrder[] = []) => {
  const counts: Record<PrepBucket, number> = {
    to_prepare: 0,
    preparing: 0,
    out: 0,
  };
  for (const order of orders) {
    const bucket = getPrepBucket(order);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
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

export const SLOT_META: Record<
  string,
  { label: string; time: string; deliverBy: string; icon: string }
> = {
  morning: {
    label: "Morning",
    time: "9:30 – 10:30 AM",
    deliverBy: "10:30 AM",
    icon: "☀️",
  },
  lunch: {
    label: "Lunch",
    time: "12:30 – 1:30 PM",
    deliverBy: "1:30 PM",
    icon: "🍱",
  },
  evening: {
    label: "Evening",
    time: "5:00 – 6:00 PM",
    deliverBy: "6:00 PM",
    icon: "🌅",
  },
  dinner: {
    label: "Dinner",
    time: "8:00 – 9:00 PM",
    deliverBy: "9:00 PM",
    icon: "🌙",
  },
};

export type DayTab = "today" | "tomorrow";
export type SlotFilter =
  | "all"
  | "morning"
  | "lunch"
  | "evening"
  | "dinner"
  | "instant";

export const SLOT_FILTERS: Array<{
  key: SlotFilter;
  label: string;
  icon?: string;
}> = [
  { key: "all", label: "All" },
  { key: "instant", label: "Instant", icon: "⚡" },
  { key: "morning", label: "Morning", icon: "☀️" },
  { key: "lunch", label: "Lunch", icon: "🍱" },
  { key: "evening", label: "Evening", icon: "🌅" },
  { key: "dinner", label: "Dinner", icon: "🌙" },
];

export const formatSlotWindow = (slot?: string) => {
  const normalized = String(slot || "").trim().toLowerCase();
  return SLOT_META[normalized]?.time || formatSlotLabel(slot);
};

export const formatDeliverByTime = (order: DashboardOrder) => {
  if (isInstantOrder(order)) return "Due now";

  const slot = String(order.slot || "").trim().toLowerCase();
  const slotDeliverBy = SLOT_META[slot]?.deliverBy;
  if (slotDeliverBy) return slotDeliverBy;

  const dateTime = order.date
    ? new Date(order.date).getTime()
    : order.createdAt
      ? new Date(order.createdAt).getTime()
      : 0;
  if (!dateTime) return formatSlotLabel(order.slot);

  return new Date(dateTime).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
};

const parseTrailingQuantity = (value?: string) => {
  const label = String(value || "").trim();
  const match = label.match(/\bx\s*(\d+)\s*$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

export const getOrderQuantity = (order: DashboardOrder) => {
  const candidates: number[] = [];

  const directQty = Number((order as any)?.quantity);
  if (Number.isFinite(directQty) && directQty > 0) {
    candidates.push(Math.floor(directQty));
  }

  const bundleItems = Array.isArray((order as any)?.bundle_items)
    ? (order as any).bundle_items
    : [];
  if (bundleItems.length) {
    candidates.push(
      bundleItems.reduce(
        (sum: number, item: any) =>
          sum +
          Math.max(
            1,
            Number(item?.qty || item?.quantity) || 1,
            parseTrailingQuantity(item?.name) || 0,
          ),
        0,
      ),
    );
    bundleItems.forEach((item: any) => {
      const itemQty = Number(item?.qty || item?.quantity);
      if (Number.isFinite(itemQty) && itemQty > 0) candidates.push(Math.floor(itemQty));
      const nameQty = parseTrailingQuantity(item?.name);
      if (nameQty) candidates.push(nameQty);
    });
  }

  const apiLineItems = Array.isArray((order as any)?.line_items)
    ? (order as any).line_items
    : [];
  if (apiLineItems.length) {
    candidates.push(
      apiLineItems.reduce(
        (sum: number, item: any) =>
          sum + Math.max(1, Number(item?.qty ?? item?.quantity) || 1),
        0,
      ),
    );
  }

  const mealName = String(order.meal_name || order.package_name || "").trim();
  const mealQty = parseTrailingQuantity(mealName);
  if (mealQty) candidates.push(mealQty);
  const packageQty = parseTrailingQuantity(order.package_name);
  if (packageQty) candidates.push(packageQty);

  if (!candidates.length) return 1;
  return Math.max(...candidates);
};

export const getDayOrders = (
  dashboard: DashboardData | null | undefined,
  day: DayTab,
  options: { actionableOnly?: boolean } = {},
) => {
  const source =
    day === "today"
      ? dashboard?.today_orders || []
      : dashboard?.tomorrow_orders || [];
  const visible = filterVisibleStoreOrders(source);
  if (!options.actionableOnly) return visible;
  return visible.filter(isActionableOrder);
};

export const filterOrdersBySlot = (
  orders: DashboardOrder[],
  slot: SlotFilter,
) => {
  if (slot === "all") return orders;
  if (slot === "instant") return orders.filter(isInstantOrder);
  return orders.filter(
    (order) =>
      !isInstantOrder(order) &&
      String(order.slot || "").trim().toLowerCase() === slot,
  );
};

export const countOrdersBySlot = (
  orders: DashboardOrder[],
): Record<SlotFilter, number> => ({
  all: orders.length,
  instant: orders.filter(isInstantOrder).length,
  morning: orders.filter(
    (o) => !isInstantOrder(o) && String(o.slot).toLowerCase() === "morning",
  ).length,
  lunch: orders.filter(
    (o) => !isInstantOrder(o) && String(o.slot).toLowerCase() === "lunch",
  ).length,
  evening: orders.filter(
    (o) => !isInstantOrder(o) && String(o.slot).toLowerCase() === "evening",
  ).length,
  dinner: orders.filter(
    (o) => !isInstantOrder(o) && String(o.slot).toLowerCase() === "dinner",
  ).length,
});

const splitItemText = (value?: string) =>
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export type OrderLineItem = { name: string; qty: number };

export const getOrderLineItems = (order: DashboardOrder): OrderLineItem[] => {
  const apiLineItems = Array.isArray((order as any)?.line_items)
    ? (order as any).line_items
    : [];
  if (apiLineItems.length) {
    return apiLineItems.map((item: any) => ({
      name: String(item?.name || "Item").trim(),
      qty: Math.max(1, Number(item?.qty ?? item?.quantity) || 1),
    }));
  }

  const orderQty = getOrderQuantity(order);
  const bundleItems = Array.isArray((order as any)?.bundle_items)
    ? (order as any).bundle_items
    : [];

  if (bundleItems.length === 1) {
    const item = bundleItems[0];
    const name = String(item?.name || item?.menu_item?.name || "Item").trim();
    const lineQty = Math.max(
      orderQty,
      Math.max(1, Number(item?.qty || item?.quantity) || 1),
    );
    return [{ name, qty: lineQty }];
  }

  if (bundleItems.length > 1) {
    return bundleItems.map((item: any) => ({
      name: String(item?.name || item?.menu_item?.name || "Item").trim(),
      qty: Math.max(1, Number(item?.qty || item?.quantity) || 1),
    }));
  }

  const mealName =
    String(order.meal_name || order.package_name || "").trim() ||
    "Meal details";
  const cleanName = mealName.replace(/\s*x\s*\d+\s*$/i, "").trim() || mealName;
  const tokens = splitItemText(cleanName);
  if (tokens.length > 1) {
    return tokens.map((name) => ({ name, qty: 1 }));
  }

  return [{ name: cleanName, qty: orderQty }];
};

export const getSlotSortRank = (slot?: string) =>
  SLOT_ORDER[String(slot || "").trim().toLowerCase()] ?? 99;

export const getOrderDeliveryTimestamp = (order: DashboardOrder) => {
  const raw = order.date || order.createdAt;
  if (!raw) return 0;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const toISTDateKey = (value?: string | Date | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

export const getOrderDeliveryDateKey = (order: DashboardOrder, now = Date.now()) => {
  const ts = getOrderDeliveryTimestamp(order);
  if (!ts) return "";
  return toISTDateKey(ts);
};

export const getTodayDateKey = (now = Date.now()) => toISTDateKey(now);

export const getTomorrowDateKey = (now = Date.now()) =>
  toISTDateKey(now + 86400000);

export const formatSlotLabel = (slot?: string) => {
  const normalized = String(slot || "").trim().toLowerCase();
  if (!normalized) return "Scheduled";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/** Prominent delivery date for store cards — Today/Tomorrow + weekday. */
export const formatDeliveryDateLabel = (
  order: DashboardOrder,
  now = Date.now(),
  options: { dayHint?: DayTab } = {},
) => {
  const ts = getOrderDeliveryTimestamp(order);
  if (!ts) return "Date unavailable";

  const dateKey =
    String((order as any)?.delivery_date_str || "").trim() ||
    getOrderDeliveryDateKey(order, now);
  const todayKey = getTodayDateKey(now);
  const tomorrowKey = getTomorrowDateKey(now);

  const formatted = new Date(ts).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  if (options.dayHint === "today") return `Today • ${formatted}`;
  if (options.dayHint === "tomorrow") return `Tomorrow • ${formatted}`;

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

export const formatDueTime = (order: DashboardOrder) => formatDeliverByTime(order);

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
) => {
  const actionable = getActionableOrders(dashboard);
  const todayKey = getTodayDateKey(now);
  const todayQueue = actionable.filter((order) => {
    if (isInstantOrder(order)) return true;
    return getOrderDeliveryDateKey(order, now) === todayKey;
  });
  return sortPartnerOrderQueue(
    todayQueue.length ? todayQueue : actionable,
    now,
  );
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

const parseIstTimeOnDateKey = (dateKey: string, timeLabel: string) => {
  const normalized = String(timeLabel || "").trim();
  if (!dateKey || !normalized) return 0;

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = String(match[3] || "AM").toUpperCase();

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const iso = `${dateKey}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+05:30`;
  const parsed = new Date(iso).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getSlotWindowTimestamps = (
  order: DashboardOrder,
  now = Date.now(),
) => {
  const slot = String(order.slot || "").trim().toLowerCase();
  const meta = SLOT_META[slot];
  const dateKey = getOrderDeliveryDateKey(order, now) || getTodayDateKey(now);

  if (!meta) {
    const fallback = getOrderDeliveryTimestamp(order) || now;
    return {
      start: fallback,
      end: fallback,
      deliverByLabel: formatDeliverByTime(order),
    };
  }

  const [startRaw, endRaw] = String(meta.time || "")
    .split("–")
    .map((part) => part.trim());
  const endLabel = endRaw || meta.deliverBy;
  const startLabel =
    startRaw && /(AM|PM)/i.test(startRaw)
      ? startRaw
      : endLabel.replace(/(AM|PM)/i, "").trim()
        ? `${startRaw} ${String(endLabel.match(/(AM|PM)/i)?.[0] || "AM")}`
        : startRaw;

  return {
    start: parseIstTimeOnDateKey(dateKey, startLabel),
    end: parseIstTimeOnDateKey(dateKey, endLabel),
    deliverByLabel: meta.deliverBy,
  };
};

export const getScheduledDeliverByTimestamp = (
  order: DashboardOrder,
  now = Date.now(),
) => {
  const { end } = getSlotWindowTimestamps(order, now);
  if (end > 0) return end;

  const ts = getOrderDeliveryTimestamp(order);
  return ts > 0 ? ts : 0;
};

export const getSlotProgressValue = (
  order: DashboardOrder,
  now = Date.now(),
) => {
  const { start, end } = getSlotWindowTimestamps(order, now);
  if (!start || !end || end <= start) return 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
};

export const formatCompactItemLine = (order: DashboardOrder) => {
  const lines = resolveOrderLineItems(order);
  if (!lines.length) return getOrderTitle(order);
  if (lines.length === 1) {
    const line = lines[0];
    return line.qty > 1 ? `${line.name} ×${line.qty}` : line.name;
  }
  const preview = lines
    .slice(0, 2)
    .map((line) => (line.qty > 1 ? `${line.name} ×${line.qty}` : line.name))
    .join(", ");
  return lines.length > 2 ? `${preview} +${lines.length - 2}` : preview;
};

export type LiveOrderPresentation = {
  title: string;
  subtitle: string;
  bodyLead: string;
  bodyDetail: string;
  progressDate?: number;
  progressValue?: number;
  accent: "instant" | "scheduled" | "neutral";
};

export const buildLiveOrderPresentation = (
  order: DashboardOrder,
  now = Date.now(),
  options: { queueCount?: number } = {},
): LiveOrderPresentation => {
  const customer = getOrderCustomerName(order);
  const itemLine = formatCompactItemLine(order);
  const progress = resolveStoreOrderProgress(order.status);
  const stepLine = formatProgressStepLine(progress);
  const pending = isPendingAcceptance(order);
  const instant = isInstantOrder(order);
  const queueCount = Number(options.queueCount || 0);

  if (instant) {
    const deadline = getInstantDeadline(order);
    const countdown = formatCountdown(deadline, now, { withSeconds: true });
    const statusLabel = pending
      ? "Accept now"
      : isPreparingStatus(order.status)
        ? "Preparing"
        : isOutForDeliveryStatus(order.status)
          ? "Out for delivery"
          : formatStatusLabel(order.status);

    return {
      title: `⚡ INSTANT · ${statusLabel}`,
      subtitle: `${itemLine} · ${customer}`,
      bodyLead: `#${getOrderId(order).slice(-6).toUpperCase()} · ${itemLine}`,
      bodyDetail: [
        countdown ? `⏱ ${countdown} remaining` : "Deliver immediately",
        stepLine,
        queueCount > 1 ? `${queueCount} orders in kitchen queue` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      progressDate: deadline > now ? deadline : undefined,
      accent: "instant",
    };
  }

  const slotMeta = SLOT_META[String(order.slot || "").trim().toLowerCase()];
  const slotIcon = slotMeta?.icon || "📅";
  const slotLabel = slotMeta?.label || formatSlotLabel(order.slot);
  const deliverBy = formatDeliverByTime(order);
  const deliverByTs = getScheduledDeliverByTimestamp(order, now);
  const countdown = deliverByTs
    ? formatCountdown(deliverByTs, now, { withSeconds: false })
    : "";
  const slotProgress = getSlotProgressValue(order, now);

  const statusLabel = pending
    ? "Accept order"
    : isPreparingStatus(order.status)
      ? "Preparing"
      : isOutForDeliveryStatus(order.status)
        ? "Ready · hand over"
        : formatStatusLabel(order.status);

  const title = `${slotIcon} ${slotLabel} ${deliverBy} · ${statusLabel}`;
  const subtitle = `${itemLine} · ${customer}`;

  return {
    title,
    subtitle,
    bodyLead: `#${getOrderId(order).slice(-6).toUpperCase()} · ${itemLine}`,
    bodyDetail: [
      `${formatDeliveryDateLabel(order, now)} · ${slotLabel} slot`,
      countdown ? `⏱ ${countdown} until ${deliverBy}` : `Deliver by ${deliverBy}`,
      `Slot progress ${Math.round(slotProgress * 100)}%`,
      stepLine,
      queueCount > 1 ? `${queueCount} orders in this slot window` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    progressDate: deliverByTs > now ? deliverByTs : undefined,
    progressValue:
      !pending && slotProgress > 0 && slotProgress < 1 ? slotProgress : undefined,
    accent: "scheduled",
  };
};
