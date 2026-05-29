import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as LiveActivity from "expo-live-activity";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DashboardData, DashboardOrder } from "types";

const ONGOING_CHANNEL_ID = "ongoing-orders";
const ONGOING_NOTIFICATION_ID = "partner-next-order-activity";
const IOS_ACTIVITY_ID_KEY = "@partner_next_order_live_activity_id";
const IOS_ACTIVITY_ORDER_KEY = "@partner_next_order_live_activity_order_id";

const SLOT_ORDER: Record<string, number> = {
  morning: 1,
  lunch: 2,
  evening: 3,
  dinner: 4,
};

const FINAL_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled",
  "skipped",
]);

const normalizeText = (value?: string) => {
  const normalized = String(value || "").trim();
  return normalized && normalized !== "-" ? normalized : "";
};

const getOrderTitle = (order: DashboardOrder) =>
  normalizeText(order.meal_name) ||
  normalizeText(order.package_name) ||
  "Order";

const getOrderId = (order: DashboardOrder) =>
  String(order.order_id || order._id || "").trim();

const getSlotRank = (slot?: string) =>
  SLOT_ORDER[String(slot || "").toLowerCase()] || 99;

const isActionable = (order: DashboardOrder) => {
  const status = String(order.status || "").toLowerCase();
  return !FINAL_STATUSES.has(status);
};

const isInstantActionable = (order: DashboardOrder) =>
  String(order.delivery_mode || "").toLowerCase() === "instant" &&
  isActionable(order);

const toDateTime = (order: DashboardOrder) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  const dateOnly = order.date ? new Date(order.date).getTime() : 0;
  return createdAt || dateOnly || 0;
};

const getInstantDeadline = (order: DashboardOrder) => {
  if (!isInstantActionable(order)) return 0;
  if (order.instant_deadline_at) {
    const deadline = new Date(order.instant_deadline_at).getTime();
    if (!Number.isNaN(deadline) && deadline > 0) return deadline;
  }
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return createdAt ? createdAt + 60 * 60 * 1000 : 0;
};

const formatInstantCountdown = (deadlineAt: number) => {
  if (!deadlineAt) return "Instant";
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  if (remainingMs <= 0) return "Instant order";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(1, minutes)}m left`;
};

const formatSlot = (slot?: string) => {
  const normalized = String(slot || "").toLowerCase();
  if (!normalized) return "Scheduled";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDueTime = (order: DashboardOrder) => {
  if (String(order.delivery_mode || "").toLowerCase() === "instant") return "Due now";
  const dateTime = toDateTime(order);
  if (!dateTime) return formatSlot(order.slot);
  return new Date(dateTime).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getDashboardProgress = (dashboard: DashboardData | null | undefined) => {
  const todayOrders = dashboard?.today_orders || [];
  const preparing = todayOrders.filter(
    (order) => String(order.status || "").toLowerCase() === "preparing",
  ).length;
  const outForDelivery = todayOrders.filter(
    (order) => String(order.status || "").toLowerCase() === "out_for_delivery",
  ).length;
  const delivered = todayOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "delivered" || status === "completed";
  }).length;

  return { preparing, outForDelivery, delivered };
};

const pickNextOrder = (
  dashboard: DashboardData | null | undefined,
): DashboardOrder | null => {
  if (!dashboard) return null;

  const allOrders = [
    ...(dashboard.today_orders || []),
    ...(dashboard.tomorrow_orders || []),
  ].filter(isActionable);

  if (!allOrders.length) return null;

  const instant = allOrders.filter(isInstantActionable).sort((a, b) => {
    const aDeadline = getInstantDeadline(a);
    const bDeadline = getInstantDeadline(b);
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return toDateTime(a) - toDateTime(b);
  })[0];

  if (instant) return instant;

  return allOrders.sort((a, b) => {
    const aDate = a.date ? new Date(a.date).getTime() : 0;
    const bDate = b.date ? new Date(b.date).getTime() : 0;
    if (aDate !== bDate) return aDate - bDate;

    const aSlot = getSlotRank(a.slot);
    const bSlot = getSlotRank(b.slot);
    if (aSlot !== bSlot) return aSlot - bSlot;

    return toDateTime(a) - toDateTime(b);
  })[0];
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
    name: "Ongoing Order Activity",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: null,
    vibrationPattern: [0],
  });
};

const getOrderStatusLabel = (order: DashboardOrder) => {
  const status = String(order.status || "").toLowerCase();
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "preparing":
      return "Preparing";
    case "out_for_delivery":
      return "Out for Delivery";
    case "pending":
      return "Pending";
    default:
      return status ? status.replaceAll("_", " ") : "";
  }
};

const buildAndroidBody = (
  order: DashboardOrder,
  dashboard: DashboardData | null | undefined,
) => {
  const mode =
    String(order.delivery_mode || "").toLowerCase() === "instant"
      ? "Instant"
      : String(order.slot || "Scheduled");
  const customer = normalizeText(order.user_name);
  const statusLabel = getOrderStatusLabel(order);
  const orderId = getOrderId(order);
  const due = formatDueTime(order);
  const progress = getDashboardProgress(dashboard);
  const progressLine = `Prep ${progress.preparing} | Out ${progress.outForDelivery} | Done ${progress.delivered}`;

  if (mode === "Instant") {
    const countdown = formatInstantCountdown(getInstantDeadline(order));
    return [
      mode,
      statusLabel,
      countdown,
      due,
      customer,
      progressLine,
      orderId ? `#${orderId.slice(-6).toUpperCase()}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return [
    mode,
    statusLabel,
    `Due ${due}`,
    customer,
    progressLine,
    orderId ? `#${orderId.slice(-6).toUpperCase()}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
};

const ensureNotificationPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

const toLiveActivityState = (
  order: DashboardOrder,
  dashboard: DashboardData | null | undefined,
): LiveActivity.LiveActivityState => {
  const title = `Next: ${getOrderTitle(order)}`;
  const statusLabel = getOrderStatusLabel(order);
  const mode =
    String(order.delivery_mode || "").toLowerCase() === "instant"
      ? "Instant"
      : formatSlot(order.slot);
  const customer = normalizeText(order.user_name);
  const due = formatDueTime(order);
  const progress = getDashboardProgress(dashboard);
  const subtitle = [
    mode,
    statusLabel,
    `Due ${due}`,
    customer,
    `Prep ${progress.preparing}`,
    `Out ${progress.outForDelivery}`,
    `Done ${progress.delivered}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const deadline = getInstantDeadline(order);
  if (deadline > Date.now()) {
    return {
      title,
      subtitle,
      progressBar: {
        date: deadline,
      },
    };
  }

  return {
    title,
    subtitle,
  };
};

const syncIosLiveActivity = async (
  order: DashboardOrder | null,
  dashboard: DashboardData | null | undefined,
) => {
  const existingActivityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
  const existingOrderId = await AsyncStorage.getItem(IOS_ACTIVITY_ORDER_KEY);

  if (!order) {
    if (existingActivityId) {
      await LiveActivity.stopActivity(existingActivityId, {
        title: "No active orders",
        subtitle: "Waiting for next order",
      });
    }
    await AsyncStorage.multiRemove([
      IOS_ACTIVITY_ID_KEY,
      IOS_ACTIVITY_ORDER_KEY,
    ]);
    return;
  }

  const orderId = getOrderId(order);
  const state = toLiveActivityState(order, dashboard);
  const config: LiveActivity.LiveActivityConfig = {
    deepLinkUrl: orderId ? `/order/${orderId}` : "/(tabs)/orders",
    backgroundColor: "#0B57D0",
    titleColor: "#FFFFFF",
    subtitleColor: "#DDE8FF",
    progressViewTint: "#FFD166",
    progressViewLabelColor: "#FFFFFF",
    timerType: "digital",
  };

  if (existingActivityId && existingOrderId === orderId) {
    await LiveActivity.updateActivity(existingActivityId, state);
    return;
  }

  if (existingActivityId) {
    await LiveActivity.stopActivity(existingActivityId, state);
  }

  const startedId = LiveActivity.startActivity(state, config);
  if (startedId) {
    await AsyncStorage.multiSet([
      [IOS_ACTIVITY_ID_KEY, startedId],
      [IOS_ACTIVITY_ORDER_KEY, orderId],
    ]);
  }
};

export async function syncOngoingNextOrderActivity(
  dashboard: DashboardData | null | undefined,
) {
  try {
    const hasNotificationPermission = await ensureNotificationPermission();
    if (!hasNotificationPermission) return;

    const order = pickNextOrder(dashboard);

    if (Platform.OS === "ios") {
      await syncIosLiveActivity(order, dashboard);
      return;
    }

    if (Platform.OS !== "android") return;

    if (!order) {
      await Notifications.dismissNotificationAsync(
        ONGOING_NOTIFICATION_ID,
      ).catch(() => null);
      return;
    }

    await ensureAndroidChannel();

    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_NOTIFICATION_ID,
      content: {
        title: `Next order: ${getOrderTitle(order)}`,
        body: buildAndroidBody(order, dashboard),
        channelId: ONGOING_CHANNEL_ID,
        data: {
          type: "ongoing_next_order",
          orderId: getOrderId(order),
          deliveryMode: order.delivery_mode || "scheduled",
        },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
        autoDismiss: false,
        sticky: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.log("Failed to sync ongoing order activity", error);
  }
}

export async function clearOngoingNextOrderActivity() {
  if (Platform.OS === "ios") {
    const activityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
    if (activityId) {
      await LiveActivity.stopActivity(activityId, {
        title: "Signed out",
        subtitle: "Partner activity ended",
      });
    }
    await AsyncStorage.multiRemove([
      IOS_ACTIVITY_ID_KEY,
      IOS_ACTIVITY_ORDER_KEY,
    ]);
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.dismissNotificationAsync(ONGOING_NOTIFICATION_ID).catch(
      () => null,
    );
  }
}
