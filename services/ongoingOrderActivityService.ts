import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as LiveActivity from "expo-live-activity";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DashboardData, DashboardOrder } from "types";
import {
  buildMultiOrderSummary,
  buildPartnerOrderQueue,
  formatCountdown,
  formatDeliveryDateLabel,
  formatDueTime,
  formatSlotLabel,
  formatStatusLabel,
  getInstantDeadline,
  getOrderCustomerName,
  getOrderId,
  getOrderTitle,
  isInstantOrder,
  isPendingAcceptance,
  isPreparingStatus,
  pickFocusOrder,
  resolveOrderApiIds,
  sortActiveOrdersForBoard,
  getActionableOrders,
} from "utils/orderActivity";
import {
  getPartnerCategoryForStatus,
  ensurePartnerNotificationSetup,
} from "services/partnerNotificationActions";
import {
  formatStoreProgressSubtitle,
  resolveStoreOrderProgress,
  formatProgressStepLine,
} from "utils/orderProgressSteps";

const ONGOING_CHANNEL_ID = "ongoing-orders";
export const ONGOING_NOTIFICATION_ID = "partner-next-order-activity";
const IOS_ACTIVITY_ID_KEY = "@partner_next_order_live_activity_id";

let lastOngoingBody = "";
let lastOngoingTitle = "";
let lastOngoingCategory = "";

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
    name: "Live Order Activity",
    description: "Always-on order status and quick actions",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: null,
    enableVibrate: false,
    bypassDnd: false,
  });
};

const ensureNotificationPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (
    existing.granted ||
    existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

const canUseIosLiveActivity = () => {
  if (Platform.OS !== "ios") return false;
  if ((Constants as any)?.appOwnership === "expo") return false;

  const start = (LiveActivity as any)?.startActivity;
  const stop = (LiveActivity as any)?.stopActivity;
  const update = (LiveActivity as any)?.updateActivity;
  return (
    typeof start === "function" &&
    typeof stop === "function" &&
    typeof update === "function"
  );
};

type DrawerPayload = {
  title: string;
  body: string;
  subtitle?: string;
  categoryIdentifier: string;
  focusOrder: DashboardOrder | null;
  activeCount: number;
};

const buildDrawerPayload = (
  dashboard: DashboardData | null | undefined,
  isOnline: boolean,
  now = Date.now(),
): DrawerPayload => {
  const summary = buildMultiOrderSummary(dashboard, now, 4);
  const queue = buildPartnerOrderQueue(dashboard, now);
  const focusOrder = queue[0] || summary.focusOrder;
  const stats = summary.stats;

  if (!isOnline) {
    return {
      title: "Swasth Bite Partner • Offline",
      body: "Go online to receive orders\nTap to open dashboard",
      subtitle: "Store offline",
      categoryIdentifier: getPartnerCategoryForStatus(),
      focusOrder: null,
      activeCount: 0,
    };
  }

  if (!focusOrder) {
    return {
      title: "Swasth Bite Partner • Online",
      body: "Waiting for orders\nTap to open dashboard",
      subtitle: "No active orders",
      categoryIdentifier: getPartnerCategoryForStatus(),
      focusOrder: null,
      activeCount: 0,
    };
  }

  const shortId = getOrderId(focusOrder).slice(-6).toUpperCase();
  const customer = getOrderCustomerName(focusOrder);
  const meal = getOrderTitle(focusOrder);
  const status = formatStatusLabel(focusOrder.status);
  const instant = isInstantOrder(focusOrder);
  const pending = isPendingAcceptance(focusOrder);
  const countdown = instant
    ? formatCountdown(getInstantDeadline(focusOrder), now, { withSeconds: true })
    : "";

  const whenLine = instant
    ? countdown
      ? `⏱ ${countdown} left`
      : "Instant order"
    : `${formatDeliveryDateLabel(focusOrder, now)} • ${formatSlotLabel(focusOrder.slot)}`;

  const statsLine = [
    stats.pending ? `${stats.pending} pending` : "",
    stats.preparing ? `${stats.preparing} preparing` : "",
    stats.outForDelivery ? `${stats.outForDelivery} out` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  const title = pending
    ? instant
      ? "⚡ Instant order • Accept now"
      : "🆕 New order • Accept now"
    : `NOW • ${status}`;

  const lead = pending
    ? `#${shortId} • ${customer}\n${meal}\n${whenLine}`
    : `#${shortId} • ${customer}\n${meal}\n${whenLine}\nDue ${formatDueTime(focusOrder)}`;

  const queueLines = queue
    .slice(1, 3)
    .map((order, index) => {
      const id = getOrderId(order).slice(-6).toUpperCase();
      return `Next ${index + 1}: #${id} • ${formatStatusLabel(order.status)} • ${getOrderTitle(order)}`;
    });

  const body = [
    lead,
    formatStoreProgressSubtitle(focusOrder.status),
    formatProgressStepLine(resolveStoreOrderProgress(focusOrder.status)),
    statsLine ? `Queue: ${statsLine}` : "",
    queue.length > 1 ? `${queue.length - 1} more in queue` : "",
    ...queueLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    body,
    subtitle:
      formatStoreProgressSubtitle(focusOrder.status, customer) ||
      `${status} • ${customer}`,
    categoryIdentifier: getPartnerCategoryForStatus(focusOrder.status),
    focusOrder,
    activeCount: queue.length || stats.active,
  };
};

const toLiveActivityState = (
  dashboard: DashboardData | null | undefined,
  isOnline: boolean,
  now = Date.now(),
): LiveActivity.LiveActivityState => {
  const drawer = buildDrawerPayload(dashboard, isOnline, now);
  const focusOrder = drawer.focusOrder;

  if (!isOnline) {
    return {
      title: "Store offline",
      subtitle: "Go online to receive orders",
    };
  }

  if (!focusOrder) {
    return {
      title: "Store online",
      subtitle: "Waiting for orders",
    };
  }

  const state: LiveActivity.LiveActivityState = {
    title: drawer.title.replace(/^NOW • /, ""),
    subtitle: drawer.subtitle || getOrderTitle(focusOrder),
  };

  if (isInstantOrder(focusOrder)) {
    const deadline = getInstantDeadline(focusOrder);
    if (deadline > now) {
      state.progressBar = { date: deadline };
    }
  }

  return state;
};

const syncIosLiveActivity = async (
  dashboard: DashboardData | null | undefined,
  isOnline: boolean,
) => {
  if (!canUseIosLiveActivity()) return;

  const existingActivityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
  const orders = sortActiveOrdersForBoard(getActionableOrders(dashboard));
  const state = toLiveActivityState(dashboard, isOnline);
  const focusOrder = pickFocusOrder(dashboard);
  const orderId = focusOrder ? getOrderId(focusOrder) : "";

  const config: LiveActivity.LiveActivityConfig = {
    deepLinkUrl: orderId ? `/order/${orderId}` : "/(tabs)/orders",
    backgroundColor: "#0B57D0",
    titleColor: "#FFFFFF",
    subtitleColor: "#DDE8FF",
    progressViewTint: "#FFD166",
    progressViewLabelColor: "#FFFFFF",
    timerType: "digital",
  };

  if (!isOnline || !orders.length) {
    if (existingActivityId) {
      await LiveActivity.stopActivity(existingActivityId, state);
    }
    await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
    return;
  }

  if (existingActivityId) {
    await LiveActivity.updateActivity(existingActivityId, state);
    return;
  }

  const startedId = LiveActivity.startActivity(state, config);
  if (startedId) {
    await AsyncStorage.setItem(IOS_ACTIVITY_ID_KEY, startedId);
  }
};

type IncomingOrderSnapshot = {
  orderId: string;
  packageName: string;
  customerName: string;
  deliveryMode: string;
  status: string;
  instantDeadlineAt?: string;
};

const toDashboardOrder = (order: IncomingOrderSnapshot): DashboardOrder =>
  ({
    _id: order.orderId,
    subscription_id: order.orderId,
    package_name: order.packageName,
    meal_name: order.packageName,
    user_name: order.customerName,
    delivery_mode: order.deliveryMode,
    status: order.status,
    instant_deadline_at: order.instantDeadlineAt,
    createdAt: new Date().toISOString(),
  }) as DashboardOrder;

type SyncActivityOptions = {
  playSound?: boolean;
  forceUpdate?: boolean;
  isOnline?: boolean;
};

export async function syncOngoingNextOrderActivityFromOrder(
  order: IncomingOrderSnapshot,
  dashboard?: DashboardData | null,
  options?: SyncActivityOptions,
) {
  const snapshotOrder = toDashboardOrder(order);
  const mergedDashboard: DashboardData = {
    ...(dashboard || ({} as DashboardData)),
    today_orders: [
      snapshotOrder,
      ...((dashboard?.today_orders || []).filter(
        (item) => getOrderId(item) !== order.orderId,
      ) || []),
    ],
  };

  await syncOngoingNextOrderActivity(mergedDashboard, options);
}

export async function tickOngoingOrderActivity(
  dashboard: DashboardData | null | undefined,
  options: Pick<SyncActivityOptions, "isOnline"> = {},
) {
  if (!dashboard) return;
  await syncOngoingNextOrderActivity(dashboard, {
    playSound: false,
    isOnline: options.isOnline,
  });
}

export async function syncOngoingNextOrderActivity(
  dashboard: DashboardData | null | undefined,
  options: SyncActivityOptions = {},
) {
  try {
    const hasNotificationPermission = await ensureNotificationPermission();
    if (!hasNotificationPermission) return;

    await ensurePartnerNotificationSetup();

    const isOnline =
      options.isOnline ?? Boolean(dashboard?.is_online ?? true);
    const now = Date.now();
    const drawer = buildDrawerPayload(dashboard, isOnline, now);

    if (Platform.OS === "ios") {
      await syncIosLiveActivity(dashboard, isOnline);
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") return;

    await ensureAndroidChannel();

    const { title, body, subtitle, categoryIdentifier, focusOrder, activeCount } =
      drawer;

    const unchanged =
      !options.forceUpdate &&
      title === lastOngoingTitle &&
      body === lastOngoingBody &&
      categoryIdentifier === lastOngoingCategory;
    if (unchanged) return;

    lastOngoingTitle = title;
    lastOngoingBody = body;
    lastOngoingCategory = categoryIdentifier;

    const orderId = focusOrder ? getOrderId(focusOrder) : "";
    const altOrderIds = focusOrder ? resolveOrderApiIds(focusOrder).join(",") : "";

    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_NOTIFICATION_ID,
      content: {
        title,
        body,
        subtitle,
        categoryIdentifier,
        ...(Platform.OS === "android"
          ? {
              channelId: ONGOING_CHANNEL_ID,
              priority: Notifications.AndroidNotificationPriority.MAX,
              autoDismiss: false,
              sticky: true,
            }
          : {
              interruptionLevel: "passive",
            }),
        data: {
          type: "ongoing_next_order",
          orderId,
          altOrderIds,
          activeCount,
          deliveryMode: focusOrder?.delivery_mode || "scheduled",
          nextStatus: focusOrder && isPendingAcceptance(focusOrder)
            ? "preparing"
            : focusOrder && isPreparingStatus(focusOrder.status)
              ? "out_for_delivery"
              : "",
          silent: true,
        },
        sound: options.playSound ? "default" : false,
      },
      trigger: null,
    });
  } catch (error) {
    console.log("Failed to sync ongoing order activity", error);
  }
}

export async function clearOngoingNextOrderActivity() {
  lastOngoingBody = "";
  lastOngoingTitle = "";
  lastOngoingCategory = "";

  if (Platform.OS === "ios") {
    if (canUseIosLiveActivity()) {
      const activityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
      if (activityId) {
        await LiveActivity.stopActivity(activityId, {
          title: "Signed out",
          subtitle: "Partner activity ended",
        });
      }
    }
    await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
  }

  await Notifications.dismissNotificationAsync(ONGOING_NOTIFICATION_ID).catch(
    () => null,
  );
}
