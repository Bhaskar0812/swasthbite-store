import { useState } from "react";
import { Alert } from "react-native";
import IncomingOrderOverlay from "components/IncomingOrderOverlay";
import { useStoreStore } from "store/storeStore";
import { storeService } from "services/storeService";
import { transitionAcceptedOrder } from "services/incomingOrderAlertService";
import {
  getOrderId,
  resolveDeliveryIndexes,
  resolveOrderApiIds,
} from "utils/orderActivity";
import type { DashboardOrder } from "types";

export default function PartnerOrderAlertHost() {
  const dashboard = useStoreStore((s) => s.dashboard);
  const fetchDashboard = useStoreStore((s) => s.fetchDashboard);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  const acceptOrder = async (order: DashboardOrder) => {
    const orderIds = resolveOrderApiIds(order);
    const deliveryIndexes = resolveDeliveryIndexes(order);
    const localOrderId = getOrderId(order);

    if (!orderIds.length) {
      Alert.alert("Unable to accept", "Order id missing. Please refresh.");
      return;
    }

    try {
      setAcceptingOrderId(localOrderId);

      let updated = false;
      let lastError: any = null;

      for (const orderId of orderIds) {
        for (const deliveryIndex of deliveryIndexes) {
          try {
            await storeService.updateOrderDeliveryStatus(orderId, {
              delivery_index: deliveryIndex,
              status: "preparing",
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
        throw lastError || new Error("Unable to accept order");
      }

      await transitionAcceptedOrder(
        {
          subscription: order,
          subscription_id: orderIds[0],
          status: "preparing",
        },
        dashboard,
      );
      await fetchDashboard();
    } catch (error: any) {
      Alert.alert(
        "Accept failed",
        error?.response?.data?.message || error?.message || "Please try again",
      );
    } finally {
      setAcceptingOrderId(null);
    }
  };

  return (
    <IncomingOrderOverlay
      onAccept={acceptOrder}
      acceptingOrderId={acceptingOrderId}
    />
  );
}
