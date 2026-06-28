import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import {
  syncOngoingNextOrderActivity,
  syncOngoingNextOrderActivityFromOrder,
} from "services/ongoingOrderActivityService";
import {
  PARTNER_CATEGORY_PENDING,
} from "services/partnerNotificationActions";
import type { DashboardData, DashboardOrder } from "types";
import {
  buildPartnerOrderQueue,
  getOrderId,
  isPendingAcceptance,
  requiresBlockingIncomingAlert,
  formatCountdown,
  getInstantDeadline,
} from "utils/orderActivity";

const INCOMING_CHANNEL_ID = "incoming-orders";
export const INCOMING_NOTIFICATION_ID = "partner-incoming-order-alert";

export const incomingNotificationId = (orderId: string) =>
  `partner-incoming-${String(orderId || "alert").slice(-12)}`;

const BURST_DEDUPE_MS = 2500;
const SNOOZE_MS = 4 * 60 * 60 * 1000;

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
const overlayDismissedOrders = new Set<string>();
const snoozedUntil = new Map<string, number>();
const alertedOrderIds = new Set<string>();

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
  if (order.deliveryMode === "instant") {
    const deadline = order.instantDeadlineAt
      ? new Date(order.instantDeadlineAt).getTime()
      : 0;
    if (deadline > 0) {
      const countdown = formatCountdown(deadline, Date.now(), { withSeconds: true });
      return countdown ? `${countdown} left to accept` : "Accept now";
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
    identifier: incomingNotificationId(order.orderId),
    content: {
      title: buildNotificationTitle(order),
      body: buildNotificationBody(order),
      categoryIdentifier: PARTNER_CATEGORY_PENDING,
      ...(Platform.OS === "android"
        ? {
            channelId: INCOMING_CHANNEL_ID,
            priority: Notifications.AndroidNotificationPriority.HIGH,
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

export const getBlockingIncomingOrders = (
  dashboard: DashboardData | null | undefined,
): DashboardOrder[] => {
  return buildPartnerOrderQueue(dashboard).filter((order) =>
    requiresBlockingIncomingAlert(order),
  );
};

export const isIncomingAlertSnoozed = (orderId: string) => {
  const until = snoozedUntil.get(orderId) || 0;
  return Date.now() < until;
};

export const snoozeIncomingOrderAlert = async (orderId: string) => {
  const normalized = String(orderId || "").trim();
  if (!normalized) return;

  snoozedUntil.set(normalized, Date.now() + SNOOZE_MS);
  overlayDismissedOrders.add(normalized);
  pendingAcceptanceOrders.delete(normalized);
  recentBurstAt.delete(normalized);

  await Notifications.dismissNotificationAsync(incomingNotificationId(orderId)).catch(
    () => null,
  );
  await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
    () => null,
  );
};

export const isIncomingOverlayDismissed = (orderId: string) => {
  const normalized = String(orderId || "").trim();
  if (!normalized) return false;
  return overlayDismissedOrders.has(normalized);
};

export const dismissIncomingOverlay = (orderId: string) => {
  const normalized = String(orderId || "").trim();
  if (!normalized) return;
  overlayDismissedOrders.add(normalized);
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

  if (isIncomingAlertSnoozed(order.orderId)) {
    return;
  }

  const dashboardOrder = dashboard
    ? getBlockingIncomingOrders(dashboard).find(
        (entry) => getOrderId(entry) === order.orderId,
      ) ||
      getPendingAcceptanceOrders(dashboard).find(
        (entry) => getOrderId(entry) === order.orderId,
      )
    : null;

  const isBlocking =
    (dashboardOrder && requiresBlockingIncomingAlert(dashboardOrder)) ||
    order.deliveryMode === "instant" ||
    order.status === "pending";

  if (!isBlocking) {
    await syncOngoingNextOrderActivity(dashboard, {
      playSound: false,
      forceUpdate: true,
      isOnline: dashboard?.is_online,
    });
    return;
  }

  if (shouldSkipBurstDedupe(order.orderId)) {
    return;
  }

  const alreadyAlerted = alertedOrderIds.has(order.orderId);
  pendingAcceptanceOrders.add(order.orderId);
  alertedOrderIds.add(order.orderId);

  await postIncomingOrderAlert(order, { playSound: !alreadyAlerted });
}

export async function pulseIncomingOrderAlerts(
  dashboard: DashboardData | null | undefined,
) {
  if (!dashboard?.is_online) return;

  const blockingOrders = getBlockingIncomingOrders(dashboard);
  const blockingIds = new Set(blockingOrders.map((order) => getOrderId(order)));

  for (const orderId of [...pendingAcceptanceOrders]) {
    if (!blockingIds.has(orderId) || isIncomingAlertSnoozed(orderId)) {
      pendingAcceptanceOrders.delete(orderId);
      if (!blockingIds.has(orderId)) {
        overlayDismissedOrders.delete(orderId);
        recentBurstAt.delete(orderId);
        snoozedUntil.delete(orderId);
        alertedOrderIds.delete(orderId);
      }
    }
  }

  if (!blockingOrders.length) {
    await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
      () => null,
    );
    return;
  }

  for (const dashboardOrder of blockingOrders) {
    const orderId = getOrderId(dashboardOrder);
    if (!orderId || isIncomingAlertSnoozed(orderId)) continue;

    const order: IncomingOrderInfo = {
      orderId,
      packageName:
        normalizeText(dashboardOrder.package_name) ||
        normalizeText(dashboardOrder.meal_name) ||
        "Order",
      customerName: normalizeText(dashboardOrder.user_name) || "Customer",
      deliveryMode: String(dashboardOrder.delivery_mode || "scheduled").toLowerCase(),
      status: String(dashboardOrder.status || "pending").toLowerCase(),
      instantDeadlineAt:
        normalizeText(dashboardOrder.instant_deadline_at) ||
        (getInstantDeadline(dashboardOrder)
          ? new Date(getInstantDeadline(dashboardOrder)).toISOString()
          : undefined),
      totalAmount: Number(dashboardOrder.total_amount || 0),
    };

    pendingAcceptanceOrders.add(orderId);
    alertedOrderIds.add(orderId);
    await postIncomingOrderAlert(order, { playSound: false });
  }
}

export async function clearIncomingOrderAlert(orderId?: string) {
  if (orderId) {
    pendingAcceptanceOrders.delete(orderId);
    recentBurstAt.delete(orderId);
    overlayDismissedOrders.delete(orderId);
    snoozedUntil.delete(orderId);
    alertedOrderIds.delete(orderId);
    await Notifications.dismissNotificationAsync(incomingNotificationId(orderId)).catch(
      () => null,
    );
    await Notifications.dismissNotificationAsync(INCOMING_NOTIFICATION_ID).catch(
      () => null,
    );
    return;
  }

  for (const pendingId of [...pendingAcceptanceOrders]) {
    await Notifications.dismissNotificationAsync(incomingNotificationId(pendingId)).catch(
      () => null,
    );
  }
  pendingAcceptanceOrders.clear();
  recentBurstAt.clear();
  overlayDismissedOrders.clear();
  snoozedUntil.clear();
  alertedOrderIds.clear();

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
