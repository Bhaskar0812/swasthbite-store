import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import {
  syncOngoingNextOrderActivity,
  syncOngoingNextOrderActivityFromOrder,
  ONGOING_NOTIFICATION_ID,
} from "services/ongoingOrderActivityService";
import {
  PARTNER_CATEGORY_PENDING,
} from "services/partnerNotificationActions";
import type { DashboardData, DashboardOrder } from "types";
import {
  buildPartnerOrderQueue,
  getOrderId,
  isPendingAcceptance,
} from "utils/orderActivity";

const INCOMING_CHANNEL_ID = "incoming-orders";
export const INCOMING_NOTIFICATION_ID = "partner-incoming-order-alert";

const BURST_DEDUPE_MS = 2500;
const RERING_MS = 45000;

export type IncomingOrderInfo = {
  orderId: string;
  packageName: string;
  customerName: string;
  deliveryMode: string;
  status: string;
  instantDeadlineAt?: string;
  totalAmount?: number;
};

const pendingAcceptanceOrders = new Set<string>();
const recentBurstAt = new Map<string, number>();
const lastRingAt = new Map<string, number>();
const overlayDismissedUntil = new Map<string, number>();
const OVERLAY_DISMISS_MS = 30000;

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

  const deliveryDates = Array.isArray(subscription?.delivery_dates)
    ? subscription.delivery_dates
    : [];
  const pendingDelivery = deliveryDates.find((delivery) =>
    ["scheduled", "pending", "preparing"].includes(
      String(delivery?.status || "").toLowerCase(),
    ),
  );
  const deliveryStatus = String(
    payload.delivery_status ||
      pendingDelivery?.status ||
      deliveryDates[0]?.status ||
      "",
  ).toLowerCase();

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
      payload.status ||
        deliveryStatus ||
        subscription?.status ||
        "pending",
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

const ensureNotificationPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (
    existing.granted ||
    existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  if (existing.status === "denied") {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

export const prepareIncomingOrderNotifications = async () => {
  await ensureNotificationPermission();
  await ensureIncomingOrdersChannel();
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
    lightColor: "#E23744",
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
  return "Tap Accept to start preparing";
};

const buildNotificationTitle = (order: IncomingOrderInfo) => {
  const shortId = order.orderId.slice(-6).toUpperCase();
  if (order.deliveryMode === "instant") {
    return `⚡ NEW INSTANT ORDER #${shortId}`;
  }
  return `🔔 NEW ORDER #${shortId} — Accept Now`;
};

const buildNotificationBody = (order: IncomingOrderInfo) => {
  const shortId = order.orderId.slice(-6).toUpperCase();
  const modeLabel =
    order.deliveryMode === "instant" ? "Instant order" : "New order";
  return `${modeLabel} • ${order.packageName} • ${order.customerName}\n${formatTimerText(order)}`;
};

const shouldSkipBurstDedupe = (orderId: string) => {
  const now = Date.now();
  const last = recentBurstAt.get(orderId) || 0;
  if (now - last < BURST_DEDUPE_MS) return true;
  recentBurstAt.set(orderId, now);
  return false;
};

const orderNeedsAcceptance = (order: IncomingOrderInfo) => {
  const awaitingStatuses = new Set(["pending", "scheduled", "active", ""]);
  const inProgressStatuses = new Set([
    "preparing",
    "accepted",
    "assigned",
    "out_for_delivery",
    "picked_up",
    "delivered",
    "completed",
    "cancelled",
    "skipped",
  ]);

  return (
    awaitingStatuses.has(order.status) ||
    (order.deliveryMode === "instant" && !inProgressStatuses.has(order.status))
  );
};

const triggerAlertHaptics = async () => {
  try {
    if (Platform.OS === "android") {
      Vibration.vibrate([0, 500, 200, 500]);
    } else {
      Vibration.vibrate();
    }
  } catch {
    // Non-fatal
  }
};

export async function postIncomingOrderAlert(
  order: IncomingOrderInfo,
  options: { playSound?: boolean } = {},
) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return;

  await ensureIncomingOrdersChannel();

  const playSound = options.playSound !== false;

  await Notifications.scheduleNotificationAsync({
    identifier: INCOMING_NOTIFICATION_ID,
    content: {
      title: buildNotificationTitle(order),
      body: buildNotificationBody(order),
      categoryIdentifier: PARTNER_CATEGORY_PENDING,
      ...(Platform.OS === "android"
        ? {
            channelId: INCOMING_CHANNEL_ID,
            priority: Notifications.AndroidNotificationPriority.MAX,
            autoDismiss: false,
            sticky: true,
          }
        : {
            interruptionLevel: "timeSensitive",
          }),
      data: {
        type: "order_new",
        event: "order:new",
        orderId: order.orderId,
        order_id: order.orderId,
        subscription_id: order.orderId,
        delivery_mode: order.deliveryMode,
        requires_acceptance: true,
      },
      sound: playSound ? "default" : false,
    },
    trigger: null,
  });

  if (playSound) {
    await triggerAlertHaptics();
  }
};

export const getPendingAcceptanceOrders = (
  dashboard: DashboardData | null | undefined,
): DashboardOrder[] => {
  return buildPartnerOrderQueue(dashboard).filter((order) =>
    isPendingAcceptance(order),
  );
};

export const isIncomingOverlayDismissed = (orderId: string) => {
  const until = overlayDismissedUntil.get(orderId) || 0;
  return Date.now() < until;
};

export const dismissIncomingOverlayTemporarily = (orderId: string) => {
  overlayDismissedUntil.set(orderId, Date.now() + OVERLAY_DISMISS_MS);
};

export async function alertIncomingOrder(
  payload: Record<string, any> | null | undefined,
  dashboard?: DashboardData | null,
) {
  const order = normalizeIncomingOrderPayload(payload);
  if (!order) return;

  const requiresAcceptance =
    payload?.requires_acceptance === true ||
    payload?.data?.requires_acceptance === true;

  const needsAcceptance =
    requiresAcceptance || orderNeedsAcceptance(order);

  if (!needsAcceptance) {
    await clearIncomingOrderAlert(order.orderId);
    return;
  }

  if (shouldSkipBurstDedupe(order.orderId)) {
    return;
  }

  pendingAcceptanceOrders.add(order.orderId);
  lastRingAt.set(order.orderId, Date.now());

  await postIncomingOrderAlert(order, { playSound: true });
  await syncOngoingNextOrderActivityFromOrder(order, dashboard, {
    playSound: true,
    forceUpdate: true,
  });
}

export async function pulseIncomingOrderAlerts(
  dashboard: DashboardData | null | undefined,
) {
  if (!dashboard?.is_online) return;

  const pendingOrders = getPendingAcceptanceOrders(dashboard);
  const pendingIds = new Set(pendingOrders.map((order) => getOrderId(order)));

  for (const orderId of [...pendingAcceptanceOrders]) {
    if (!pendingIds.has(orderId)) {
      pendingAcceptanceOrders.delete(orderId);
      overlayDismissedUntil.delete(orderId);
      recentBurstAt.delete(orderId);
      lastRingAt.delete(orderId);
    }
  }

  if (!pendingOrders.length) {
    await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
      () => null,
    );
    return;
  }

  let presented: Notifications.Notification[] = [];
  try {
    presented = await Notifications.getPresentedNotificationsAsync();
  } catch {
    presented = [];
  }

  const hasIncomingAlert = presented.some(
    (entry) => entry.request.identifier === INCOMING_NOTIFICATION_ID,
  );
  const hasOngoingAlert = presented.some(
    (entry) => entry.request.identifier === ONGOING_NOTIFICATION_ID,
  );

  const focusOrder = pendingOrders[0];
  const focusId = getOrderId(focusOrder);
  const focusInfo = normalizeIncomingOrderPayload({
    subscription_id: focusId,
    orderId: focusId,
    package_name: focusOrder.package_name || focusOrder.meal_name,
    customer_name: focusOrder.user_name,
    delivery_mode: focusOrder.delivery_mode,
    status: focusOrder.status,
    instant_deadline_at: focusOrder.instant_deadline_at,
    requires_acceptance: true,
  });

  if (!focusInfo) return;

  pendingAcceptanceOrders.add(focusId);

  const lastRing = lastRingAt.get(focusId) || 0;
  const shouldReRing = Date.now() - lastRing >= RERING_MS;
  const needsIncomingPost = !hasIncomingAlert || shouldReRing;
  const needsOngoingPost = !hasOngoingAlert || shouldReRing;

  if (needsIncomingPost) {
    await postIncomingOrderAlert(focusInfo, { playSound: shouldReRing || !hasIncomingAlert });
    lastRingAt.set(focusId, Date.now());
  }

  if (needsOngoingPost) {
    await syncOngoingNextOrderActivity(dashboard, {
      playSound: shouldReRing || !hasOngoingAlert,
      forceUpdate: true,
      isOnline: dashboard.is_online,
    });
  }
}

export async function clearIncomingOrderAlert(orderId?: string) {
  if (orderId) {
    pendingAcceptanceOrders.delete(orderId);
    recentBurstAt.delete(orderId);
    lastRingAt.delete(orderId);
    overlayDismissedUntil.delete(orderId);
  } else {
    pendingAcceptanceOrders.clear();
    recentBurstAt.clear();
    lastRingAt.clear();
    overlayDismissedUntil.clear();
  }

  await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
    () => null,
  );
}

export async function transitionAcceptedOrder(
  payload: Record<string, any>,
  dashboard?: DashboardData | null,
) {
  const order = normalizeIncomingOrderPayload(payload);
  if (!order) return;

  const nextStatus = String(
    payload.status || payload.delivery_status || "preparing",
  ).toLowerCase();

  await clearIncomingOrderAlert(order.orderId);

  await syncOngoingNextOrderActivityFromOrder(
    { ...order, status: nextStatus },
    dashboard,
    { forceUpdate: true, playSound: false },
  );

  if (dashboard) {
    await syncOngoingNextOrderActivity(dashboard, { forceUpdate: true });
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
      await syncOngoingNextOrderActivity(dashboard, { forceUpdate: true });
    }
  }
}

export async function refreshIncomingOrderActivity(
  dashboard: DashboardData | null | undefined,
) {
  await pulseIncomingOrderAlerts(dashboard);
}

const dashboardOrderToPayload = (order: any) => {
  const subscriptionId = String(order?.order_id || order?.subscription_id || "");
  return {
    subscription_id: subscriptionId,
    orderId: subscriptionId,
    package_name: order?.package_name || order?.meal_name,
    customer_name: order?.user_name,
    delivery_mode: order?.delivery_mode || "scheduled",
    delivery_status: order?.status || "scheduled",
    status: order?.status || "scheduled",
    requires_acceptance: true,
    instant_deadline_at: order?.instant_deadline_at,
    total_amount: order?.total_amount ?? order?.total_price,
  };
};

export async function syncPendingIncomingOrdersFromDashboard(
  dashboard: DashboardData | null | undefined,
) {
  const candidates = [
    ...(dashboard?.today_orders || []),
    ...(dashboard?.tomorrow_orders || []),
  ];

  const pendingOrders = candidates.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    const mode = String((order as any)?.delivery_mode || "").toLowerCase();
    if (["pending", "scheduled"].includes(status)) return true;
    return (
      mode === "instant" &&
      !["delivered", "cancelled", "preparing", "out_for_delivery"].includes(
        status,
      )
    );
  });

  for (const order of pendingOrders) {
    await alertIncomingOrder(dashboardOrderToPayload(order), dashboard);
  }

  await pulseIncomingOrderAlerts(dashboard);
}
