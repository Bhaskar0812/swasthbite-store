import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";
import { storeService } from "services/storeService";
import type { DashboardData, DashboardOrder } from "types";
import {
  formatStatusLabel,
  getActionableOrders,
  getOrderId,
  resolveDeliveryIndexes,
  resolveOrderApiIds,
} from "utils/orderActivity";

export const PARTNER_CATEGORY_PENDING = "PARTNER_ORDER_PENDING";
export const PARTNER_CATEGORY_PREPARING = "PARTNER_ORDER_PREPARING";
export const PARTNER_CATEGORY_ACTIVE = "PARTNER_ORDER_ACTIVE";
export const PARTNER_CATEGORY_IDLE = "PARTNER_IDLE";

export const ACTION_START_PREPARING = "start_preparing";
export const ACTION_MARK_DISPATCH = "mark_out_for_delivery";
export const ACTION_OPEN_ORDER = "open_order";
export const ACTION_OPEN_APP = "open_app";

let categoriesRegistered = false;

export async function registerPartnerNotificationCategories() {
  if (categoriesRegistered) return;

  const openOrderAction = {
    identifier: ACTION_OPEN_ORDER,
    buttonTitle: "Open Order",
    options: { opensAppToForeground: true },
  };

  const openAppAction = {
    identifier: ACTION_OPEN_APP,
    buttonTitle: "Open App",
    options: { opensAppToForeground: true },
  };

  await Notifications.setNotificationCategoryAsync(PARTNER_CATEGORY_PENDING, [
    {
      identifier: ACTION_START_PREPARING,
      buttonTitle: "Start Preparing",
      options: { opensAppToForeground: true },
    },
    openOrderAction,
  ]);

  await Notifications.setNotificationCategoryAsync(PARTNER_CATEGORY_PREPARING, [
    {
      identifier: ACTION_MARK_DISPATCH,
      buttonTitle: "Out for Delivery",
      options: { opensAppToForeground: true },
    },
    openOrderAction,
  ]);

  await Notifications.setNotificationCategoryAsync(PARTNER_CATEGORY_ACTIVE, [
    openOrderAction,
  ]);

  await Notifications.setNotificationCategoryAsync(PARTNER_CATEGORY_IDLE, [
    openAppAction,
  ]);

  categoriesRegistered = true;
}

const findDashboardOrder = (
  dashboard: DashboardData | null | undefined,
  orderId: string,
): DashboardOrder | null => {
  const normalized = String(orderId || "").trim();
  if (!normalized) return null;

  return (
    getActionableOrders(dashboard).find(
      (order) =>
        getOrderId(order) === normalized ||
        resolveOrderApiIds(order).includes(normalized),
    ) || null
  );
};

export async function updateOrderStatusFromNotification(
  orderId: string,
  status: string,
  dashboard?: DashboardData | null,
) {
  const order = findDashboardOrder(dashboard, orderId);
  const orderIds = order ? resolveOrderApiIds(order) : [orderId];
  const deliveryIndexes = order ? resolveDeliveryIndexes(order) : [0];

  let updated = false;
  let lastError: any = null;

  for (const apiOrderId of orderIds) {
    for (const deliveryIndex of deliveryIndexes) {
      try {
        await storeService.updateOrderDeliveryStatus(apiOrderId, {
          delivery_index: deliveryIndex,
          status,
        });
        updated = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (updated) break;
  }

  if (!updated) {
    throw lastError || new Error("Unable to update order status");
  }
}

type HandlePartnerNotificationOptions = {
  dashboard: DashboardData | null | undefined;
  onRefresh: () => Promise<void>;
  navigateToOrder: (orderId: string, altIds?: string[]) => void;
  navigateToOrdersTab: () => void;
};

export async function handlePartnerNotificationResponse(
  response: Notifications.NotificationResponse,
  options: HandlePartnerNotificationOptions,
): Promise<boolean> {
  const actionId = String(response.actionIdentifier || "");
  const data = response.notification.request.content.data as
    | Record<string, any>
    | undefined;
  const type = String(data?.type || "").toLowerCase();
  const orderId = String(data?.orderId || data?.order_id || "").trim();
  const altIds = String(data?.altOrderIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    type === "ongoing_next_order" &&
    (actionId === ACTION_START_PREPARING || actionId === ACTION_MARK_DISPATCH)
  ) {
    if (!orderId) return false;

    const nextStatus =
      actionId === ACTION_START_PREPARING ? "preparing" : "out_for_delivery";

    try {
      await updateOrderStatusFromNotification(
        orderId,
        nextStatus,
        options.dashboard,
      );
      await options.onRefresh();

      Toast.show({
        type: "success",
        text1: "Order updated",
        text2: `Status changed to ${formatStatusLabel(nextStatus)}`,
        position: "top",
      });
      return true;
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Status update failed",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try from the app",
        position: "top",
      });
      return true;
    }
  }

  if (
    actionId === ACTION_OPEN_ORDER ||
    (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER &&
      type === "ongoing_next_order" &&
      orderId)
  ) {
    options.navigateToOrder(orderId, altIds.length ? altIds : undefined);
    return true;
  }

  if (
    actionId === ACTION_OPEN_APP ||
    (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER &&
      type === "ongoing_next_order" &&
      !orderId)
  ) {
    options.navigateToOrdersTab();
    return true;
  }

  return false;
}

export const getPartnerCategoryForStatus = (status?: string) => {
  const value = String(status || "").toLowerCase();
  if (value === "pending" || value === "scheduled") {
    return PARTNER_CATEGORY_PENDING;
  }
  if (["preparing", "assigned", "accepted", "ready"].includes(value)) {
    return PARTNER_CATEGORY_PREPARING;
  }
  if (value) return PARTNER_CATEGORY_ACTIVE;
  return PARTNER_CATEGORY_IDLE;
};

export async function ensurePartnerNotificationSetup() {
  if (Platform.OS === "web") return;
  await registerPartnerNotificationCategories();
}
