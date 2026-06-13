import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as LiveActivity from "expo-live-activity";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DashboardData, DashboardOrder } from "types";
import {
  buildMultiOrderSummary,
  formatCountdown,
  formatDueTime,
  formatStatusLabel,
  getInstantDeadline,
  getOrderId,
  getOrderTitle,
  isInstantOrder,
  isPendingAcceptance,
  pickFocusOrder,
  sortActiveOrdersForBoard,
  getActionableOrders,
} from "utils/orderActivity";

const ONGOING_CHANNEL_ID = "ongoing-orders";
export const ONGOING_NOTIFICATION_ID = "partner-next-order-activity";
const IOS_ACTIVITY_ID_KEY = "@partner_next_order_live_activity_id";

let lastOngoingBody = "";
let lastOngoingTitle = "";

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
    name: "Live Order Banner",
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

const buildAndroidBody = (
  dashboard: DashboardData | null | undefined,
  now = Date.now(),
) => {
  const summary = buildMultiOrderSummary(dashboard, now, 5);
  if (!summary.lines.length) {
    return "Waiting for next order";
  }

  return [
    `Pending ${summary.stats.pending} • Prep ${summary.stats.preparing} • Out ${summary.stats.outForDelivery}`,
    ...summary.lines,
    summary.stats.active > 5 ? `+${summary.stats.active - 5} more in app` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const toLiveActivityState = (
  dashboard: DashboardData | null | undefined,
  now = Date.now(),
): LiveActivity.LiveActivityState => {
  const summary = buildMultiOrderSummary(dashboard, now, 3);
  const focusOrder = summary.focusOrder;

  if (!focusOrder) {
    return {
      title: "No active orders",
      subtitle: "Waiting for next order",
    };
  }

  const state: LiveActivity.LiveActivityState = {
    title: summary.title,
    subtitle: summary.subtitle,
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
) => {
  const existingActivityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
  const orders = sortActiveOrdersForBoard(getActionableOrders(dashboard));
  const state = toLiveActivityState(dashboard);
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

  if (!orders.length) {
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
) {
  if (!dashboard) return;
  await syncOngoingNextOrderActivity(dashboard, { playSound: false });
}

export async function syncOngoingNextOrderActivity(
  dashboard: DashboardData | null | undefined,
  options: SyncActivityOptions = {},
) {
  try {
    const hasNotificationPermission = await ensureNotificationPermission();
    if (!hasNotificationPermission) return;

    const summary = buildMultiOrderSummary(dashboard);
    const focusOrder = summary.focusOrder;

    if (Platform.OS === "ios") {
      if (canUseIosLiveActivity()) {
        await syncIosLiveActivity(dashboard);
        return;
      }
      // Fallback: standard notification when Live Activity native module unavailable
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") return;

    if (!focusOrder) {
      lastOngoingBody = "";
      lastOngoingTitle = "";
      await Notifications.dismissNotificationAsync(
        ONGOING_NOTIFICATION_ID,
      ).catch(() => null);
      return;
    }

    await ensureAndroidChannel();

    const now = Date.now();
    const pendingAcceptance = isPendingAcceptance(focusOrder);
    const instant = isInstantOrder(focusOrder);
    const countdown = instant
      ? formatCountdown(getInstantDeadline(focusOrder))
      : "";

    const title =
      summary.stats.active > 1
        ? `${summary.stats.active} active orders`
        : pendingAcceptance
          ? instant
            ? `⚡ Accept instant order`
            : `New order waiting`
          : `${formatStatusLabel(focusOrder.status)}`;

    const lead =
      instant && countdown
        ? `⏱ ${countdown} left`
        : pendingAcceptance
          ? `${getOrderTitle(focusOrder)} • Tap to accept`
          : `${getOrderTitle(focusOrder)} • Due ${formatDueTime(focusOrder)}`;

    const body = [lead, buildAndroidBody(dashboard, now)]
      .filter(Boolean)
      .join("\n");

    const unchanged =
      !options.forceUpdate &&
      title === lastOngoingTitle &&
      body === lastOngoingBody;
    if (unchanged) return;

    lastOngoingTitle = title;
    lastOngoingBody = body;

    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_NOTIFICATION_ID,
      content: {
        title,
        body,
        ...(Platform.OS === "android"
          ? {
              channelId: ONGOING_CHANNEL_ID,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              autoDismiss: false,
              sticky: true,
            }
          : {
              interruptionLevel: "passive",
            }),
        data: {
          type: "ongoing_next_order",
          orderId: getOrderId(focusOrder),
          activeCount: summary.stats.active,
          deliveryMode: focusOrder.delivery_mode || "scheduled",
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
  if (Platform.OS === "ios") {
    if (!canUseIosLiveActivity()) {
      await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
      return;
    }

    const activityId = await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY);
    if (activityId) {
      await LiveActivity.stopActivity(activityId, {
        title: "Signed out",
        subtitle: "Partner activity ended",
      });
    }
    await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.dismissNotificationAsync(ONGOING_NOTIFICATION_ID).catch(
      () => null,
    );
  }
}
