import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as LiveActivity from "expo-live-activity";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DashboardData, DashboardOrder } from "types";
import {
  buildMultiOrderSummary,
  buildPartnerOrderQueue,
  buildLiveOrderPresentation,
  getOrderId,
  isPendingAcceptance,
  isPreparingStatus,
  requiresBlockingIncomingAlert,
  resolveOrderApiIds,
  sortActiveOrdersForBoard,
  getActionableOrders,
} from "utils/orderActivity";
import {
  getPartnerCategoryForStatus,
  ensurePartnerNotificationSetup,
} from "services/partnerNotificationActions";

const ONGOING_CHANNEL_ID = "ongoing-orders";
export const ONGOING_NOTIFICATION_ID = "partner-next-order-activity";
const IOS_ACTIVITY_ID_KEY = "@partner_next_order_live_activity_id";

let lastOngoingBody = "";
let lastOngoingTitle = "";
let lastOngoingCategory = "";
let cachedIosActivityId: string | null = null;

const LIVE_ACTIVITY_COLORS = {
  instant: {
    backgroundColor: "#B45309",
    progressViewTint: "#FDE68A",
  },
  scheduled: {
    backgroundColor: "#1D4ED8",
    progressViewTint: "#93C5FD",
  },
  neutral: {
    backgroundColor: "#334155",
    progressViewTint: "#CBD5E1",
  },
} as const;

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
    name: "Live Order Activity",
    description: "Always-on order status and quick actions",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
    enableVibrate: true,
    bypassDnd: true,
    vibrationPattern: [0, 250, 150, 250],
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
  presentation?: ReturnType<typeof buildLiveOrderPresentation>;
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
      title: "Swasth Bite Partner · Online",
      body: "Waiting for orders\nTap kitchen board to view schedule",
      subtitle: "No active orders right now",
      categoryIdentifier: getPartnerCategoryForStatus(),
      focusOrder: null,
      activeCount: 0,
    };
  }

  const presentation = buildLiveOrderPresentation(focusOrder, now, {
    queueCount: queue.length,
  });

  const queueLines = queue
    .slice(1, 3)
    .map((order, index) => {
      const preview = buildLiveOrderPresentation(order, now);
      const id = getOrderId(order).slice(-6).toUpperCase();
      return `Next ${index + 1}: #${id} · ${preview.subtitle}`;
    });

  const statsLine = [
    stats.pending ? `${stats.pending} to accept` : "",
    stats.preparing ? `${stats.preparing} preparing` : "",
    stats.outForDelivery ? `${stats.outForDelivery} out` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const body = [
    presentation.bodyLead,
    presentation.bodyDetail,
    statsLine ? `Kitchen queue: ${statsLine}` : "",
    queue.length > 1 ? `${queue.length - 1} more waiting` : "",
    ...queueLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: isPendingAcceptance(focusOrder)
      ? `🔔 NEW ORDER · ${presentation.title}`
      : presentation.title,
    body,
    subtitle: presentation.subtitle,
    categoryIdentifier: getPartnerCategoryForStatus(focusOrder.status),
    focusOrder,
    activeCount: queue.length || stats.active,
    presentation,
  };
};

const toLiveActivityState = (
  dashboard: DashboardData | null | undefined,
  isOnline: boolean,
  now = Date.now(),
): LiveActivity.LiveActivityState => {
  const drawer = buildDrawerPayload(dashboard, isOnline, now);
  const focusOrder = drawer.focusOrder;
  const presentation = drawer.presentation;

  if (!isOnline) {
    return {
      title: "Store offline",
      subtitle: "Go online to receive orders",
    };
  }

  if (!focusOrder || !presentation) {
    return {
      title: "Store online",
      subtitle: "Waiting for scheduled & instant orders",
    };
  }

  const state: LiveActivity.LiveActivityState = {
    title: presentation.title,
    subtitle: presentation.subtitle,
  };

  if (presentation.progressDate && presentation.progressDate > now) {
    state.progressBar = { date: presentation.progressDate };
  } else if (
    typeof presentation.progressValue === "number" &&
    presentation.progressValue > 0
  ) {
    state.progressBar = { progress: presentation.progressValue };
  }

  return state;
};

const getLiveActivityConfig = (
  order: DashboardOrder | null,
  orderId: string,
  accent: "instant" | "scheduled" | "neutral" = "scheduled",
): LiveActivity.LiveActivityConfig => {
  const palette = LIVE_ACTIVITY_COLORS[accent] || LIVE_ACTIVITY_COLORS.scheduled;
  return {
    deepLinkUrl: orderId ? `/order/${orderId}` : "/(tabs)/orders",
    backgroundColor: palette.backgroundColor,
    titleColor: "#FFFFFF",
    subtitleColor: "#F8FAFC",
    progressViewTint: palette.progressViewTint,
    progressViewLabelColor: "#FFFFFF",
    timerType: "digital",
  };
};

const syncIosLiveActivity = async (
  dashboard: DashboardData | null | undefined,
  isOnline: boolean,
) => {
  if (!canUseIosLiveActivity()) return;

  const storedId = cachedIosActivityId || (await AsyncStorage.getItem(IOS_ACTIVITY_ID_KEY));
  const orders = sortActiveOrdersForBoard(getActionableOrders(dashboard));
  const drawer = buildDrawerPayload(dashboard, isOnline);
  const state = toLiveActivityState(dashboard, isOnline);
  const focusOrder = drawer.focusOrder;
  const orderId = focusOrder ? getOrderId(focusOrder) : "";
  const accent = drawer.presentation?.accent || "neutral";
  const config = getLiveActivityConfig(focusOrder, orderId, accent);

  if (!isOnline || !orders.length) {
    if (storedId) {
      await LiveActivity.stopActivity(storedId, state).catch(() => null);
    }
    cachedIosActivityId = null;
    await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
    return;
  }

  if (storedId) {
    try {
      await LiveActivity.updateActivity(storedId, state);
      cachedIosActivityId = storedId;
      return;
    } catch {
      await LiveActivity.stopActivity(storedId, state).catch(() => null);
      cachedIosActivityId = null;
      await AsyncStorage.removeItem(IOS_ACTIVITY_ID_KEY);
    }
  }

  const startedId = LiveActivity.startActivity(state, config);
  if (startedId) {
    cachedIosActivityId = startedId;
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

    const skipDuplicateIosBanner =
      Platform.OS === "ios" &&
      canUseIosLiveActivity() &&
      Boolean(drawer.focusOrder) &&
      !(drawer.focusOrder && isPendingAcceptance(drawer.focusOrder));

    if (Platform.OS !== "android" && skipDuplicateIosBanner) {
      return;
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") return;

    await ensureAndroidChannel();

    const { title, body, subtitle, categoryIdentifier, focusOrder, activeCount } =
      drawer;

    const focusIsPending =
      Boolean(focusOrder) && isPendingAcceptance(focusOrder as DashboardOrder);
    const focusNeedsUrgentAlert =
      Boolean(focusOrder) &&
      requiresBlockingIncomingAlert(focusOrder as DashboardOrder);

    const unchanged =
      !options.forceUpdate &&
      !focusNeedsUrgentAlert &&
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
              priority: focusNeedsUrgentAlert
                ? Notifications.AndroidNotificationPriority.HIGH
                : Notifications.AndroidNotificationPriority.DEFAULT,
              autoDismiss: !focusNeedsUrgentAlert,
              sticky: focusNeedsUrgentAlert,
            }
          : {
              interruptionLevel: focusNeedsUrgentAlert
                ? "timeSensitive"
                : "passive",
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
          silent: !focusNeedsUrgentAlert,
        },
        sound: options.playSound && focusNeedsUrgentAlert ? "default" : false,
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
  cachedIosActivityId = null;

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
