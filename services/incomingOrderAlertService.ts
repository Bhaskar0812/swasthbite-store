import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  syncOngoingNextOrderActivity,
  syncOngoingNextOrderActivityFromOrder,
} from "services/ongoingOrderActivityService";
import type { DashboardData } from "types";

const INCOMING_CHANNEL_ID = "incoming-orders";
const INCOMING_NOTIFICATION_ID = "partner-incoming-order-alert";

export type IncomingOrderInfo = {
  orderId: string;
  packageName: string;
  customerName: string;
  deliveryMode: string;
  status: string;
  instantDeadlineAt?: string;
  totalAmount?: number;
};

const reminderTimers = new Map<string, Array<ReturnType<typeof setTimeout>>>();
const alertedOrders = new Set<string>();

const normalizeText = (value?: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized && normalized !== "-" ? normalized : "";
};

export const normalizeIncomingOrderPayload = (
  payload: Record<string, any> | null | undefined,
): IncomingOrderInfo | null => {
  if (!payload || typeof payload !== "object") return null;

  const subscription =
    payload.subscription && typeof payload.subscription === "object"
      ? payload.subscription
      : null;
  const user =
    payload.user && typeof payload.user === "object" ? payload.user : null;

  const orderId = normalizeText(
    payload.subscription_id ||
      payload.subscriptionId ||
      payload.orderId ||
      payload.order_id ||
      subscription?._id ||
      subscription?.id,
  );
  if (!orderId) return null;

  return {
    orderId,
    packageName:
      normalizeText(payload.package_name) ||
      normalizeText(subscription?.package_name) ||
      "Order",
    customerName:
      normalizeText(payload.customer_name) ||
      normalizeText(user?.name) ||
      normalizeText(subscription?.user?.name) ||
      "Customer",
    deliveryMode: String(
      payload.delivery_mode || subscription?.delivery_mode || "scheduled",
    ).toLowerCase(),
    status: String(
      payload.status || subscription?.status || "pending",
    ).toLowerCase(),
    instantDeadlineAt:
      normalizeText(payload.instant_deadline_at) ||
      normalizeText(subscription?.instant_deadline_at) ||
      undefined,
    totalAmount: Number(
      payload.total_amount ??
        payload.total_price ??
        subscription?.total_amount ??
        subscription?.total_price ??
        0,
    ),
  };
};

const ensureIncomingOrdersChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(INCOMING_CHANNEL_ID, {
    name: "Incoming Orders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
    bypassDnd: true,
    enableVibrate: true,
  });
};

const formatTimerText = (order: IncomingOrderInfo) => {
  if (order.instantDeadlineAt) {
    const deadline = new Date(order.instantDeadlineAt);
    if (!Number.isNaN(deadline.getTime())) {
      return `Accept before ${deadline.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
  }
  return "Tap to accept and start preparing";
};

const buildNotificationBody = (order: IncomingOrderInfo) => {
  const shortId = order.orderId.slice(-6).toUpperCase();
  const modeLabel =
    order.deliveryMode === "instant" ? "Instant order" : "New order";
  return `${modeLabel} #${shortId} • ${order.packageName} • ${order.customerName} • ${formatTimerText(order)}`;
};

const presentIncomingNotification = async (
  order: IncomingOrderInfo,
  title: string,
) => {
  await ensureIncomingOrdersChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: INCOMING_NOTIFICATION_ID,
    content: {
      title,
      body: buildNotificationBody(order),
      sound: "default",
      badge: 1,
      data: {
        type: "order_new",
        event: "order:new",
        subscription_id: order.orderId,
        orderId: order.orderId,
        delivery_mode: order.deliveryMode,
        status: order.status,
        requires_acceptance: true,
      },
      ...(Platform.OS === "android"
        ? {
            channelId: INCOMING_CHANNEL_ID,
            priority: Notifications.AndroidNotificationPriority.MAX,
            sticky: true,
            autoDismiss: false,
          }
        : {
            interruptionLevel: "timeSensitive",
          }),
    },
    trigger: null,
  });
};

const clearReminderTimers = (orderId: string) => {
  const timers = reminderTimers.get(orderId) || [];
  timers.forEach((timerId) => clearTimeout(timerId));
  reminderTimers.delete(orderId);
};

const scheduleIncomingReminders = (order: IncomingOrderInfo) => {
  clearReminderTimers(order.orderId);

  const delays = [10000, 25000, 60000];
  const timers = delays.map((delayMs) =>
    setTimeout(() => {
      if (!alertedOrders.has(order.orderId)) return;
      presentIncomingNotification(
        order,
        order.deliveryMode === "instant"
          ? "⚡ Reminder: Instant order waiting"
          : "Reminder: New order waiting",
      ).catch(() => null);
    }, delayMs),
  );

  reminderTimers.set(order.orderId, timers);
};

export async function alertIncomingOrder(
  payload: Record<string, any> | null | undefined,
  dashboard?: DashboardData | null,
) {
  const order = normalizeIncomingOrderPayload(payload);
  if (!order) return;

  const needsAcceptance = ["pending", "scheduled", ""].includes(order.status);
  if (!needsAcceptance) {
    await clearIncomingOrderAlert(order.orderId);
    return;
  }

  if (alertedOrders.has(order.orderId)) {
    await presentIncomingNotification(order, "New order received");
    return;
  }

  alertedOrders.add(order.orderId);

  await presentIncomingNotification(
    order,
    order.deliveryMode === "instant"
      ? "⚡ Instant order received!"
      : "New order received!",
  );

  scheduleIncomingReminders(order);
  await syncOngoingNextOrderActivityFromOrder(order, dashboard);
}

export async function clearIncomingOrderAlert(orderId?: string) {
  if (orderId) {
    alertedOrders.delete(orderId);
    clearReminderTimers(orderId);
  } else {
    alertedOrders.clear();
    reminderTimers.forEach((timers) => timers.forEach((timerId) => clearTimeout(timerId)));
    reminderTimers.clear();
  }

  await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
    () => null,
  );
}

/** Dismiss loud incoming alert only — keep ongoing live activity with updated status/timer */
export async function transitionAcceptedOrder(
  payload: Record<string, any>,
  dashboard?: DashboardData | null,
) {
  const order = normalizeIncomingOrderPayload(payload);
  if (!order) return;

  const nextStatus = String(
    payload.status || payload.delivery_status || "preparing",
  ).toLowerCase();

  alertedOrders.delete(order.orderId);
  clearReminderTimers(order.orderId);
  await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
    () => null,
  );

  await syncOngoingNextOrderActivityFromOrder(
    { ...order, status: nextStatus },
    dashboard,
  );

  if (dashboard) {
    await syncOngoingNextOrderActivity(dashboard);
  }
}

export async function handleIncomingOrderStatusChange(
  payload: Record<string, any>,
  dashboard?: DashboardData | null,
) {
  const order = normalizeIncomingOrderPayload(payload);
  if (!order) return;

  const status = String(
    payload.status || payload.delivery_status || order.status,
  ).toLowerCase();

  const preparingStatuses = new Set([
    "preparing",
    "accepted",
    "assigned",
    "out_for_delivery",
    "picked_up",
  ]);

  const finalStatuses = new Set([
    "delivered",
    "completed",
    "cancelled",
    "skipped",
  ]);

  if (preparingStatuses.has(status)) {
    await transitionAcceptedOrder({ ...payload, status }, dashboard);
    return;
  }

  if (finalStatuses.has(status)) {
    await clearIncomingOrderAlert(order.orderId);
    if (dashboard) {
      await syncOngoingNextOrderActivity(dashboard);
    }
  }
}

export async function refreshIncomingOrderActivity(
  dashboard: DashboardData | null | undefined,
) {
  await syncOngoingNextOrderActivity(dashboard);
}
