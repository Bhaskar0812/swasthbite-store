import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useStoreStore } from "store/storeStore";
import {
  dismissIncomingOverlay,
  getBlockingIncomingOrders,
  isIncomingOverlayDismissed,
  snoozeIncomingOrderAlert,
} from "services/incomingOrderAlertService";
import {
  formatSlotLabel,
  getOrderId,
  getOrderLineItems,
  getOrderTitle,
  getSlotCardTheme,
  isInstantOrder,
  formatCountdown,
  getInstantDeadline,
  formatDeliveryDateLabel,
} from "utils/orderActivity";
import { Colors } from "constants/theme";

type Props = {
  onAccept?: (order: ReturnType<typeof getBlockingIncomingOrders>[number]) => void;
  acceptingOrderId?: string | null;
};

export default function IncomingOrderOverlay({
  onAccept,
  acceptingOrderId,
}: Props) {
  const dashboard = useStoreStore((s) => s.dashboard);
  const isOnline = useStoreStore((s) => s.isOnline);
  const pulse = useRef(new Animated.Value(1)).current;

  const pendingOrder = useMemo(() => {
    const queue = getBlockingIncomingOrders(dashboard);
    return (
      queue.find((order) => !isIncomingOverlayDismissed(getOrderId(order))) ||
      null
    );
  }, [dashboard]);

  useEffect(() => {
    if (!pendingOrder) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    if (Platform.OS === "android") {
      Vibration.vibrate([0, 400, 200, 400]);
    }

    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [pendingOrder?.status, getOrderId(pendingOrder || ({} as any))]);

  if (!isOnline || !pendingOrder) return null;

  const orderId = getOrderId(pendingOrder);
  const shortId = orderId.slice(-6).toUpperCase();
  const instant = isInstantOrder(pendingOrder);
  const lineItems = getOrderLineItems(pendingOrder);
  const itemPreview = lineItems
    .map((item) => (item.qty > 1 ? `${item.name} ×${item.qty}` : item.name))
    .join(" • ");
  const address =
    pendingOrder.delivery_address?.full_address ||
    pendingOrder.delivery_address?.address ||
    pendingOrder.address_snapshot?.full_address ||
    "";
  const countdown = instant
    ? formatCountdown(getInstantDeadline(pendingOrder), Date.now(), {
        withSeconds: true,
      })
    : "";
  const isAccepting = acceptingOrderId === orderId;
  const theme = getSlotCardTheme(pendingOrder.slot, { instant });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => dismissIncomingOverlay(orderId)}
          style={{
            position: "absolute",
            top: 52,
            right: 24,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <View
            style={{
              backgroundColor: instant ? "#EA580C" : "#DC2626",
              borderRadius: 24,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                color: "#FFF",
                fontSize: 13,
                fontWeight: "800",
                letterSpacing: 1,
                textAlign: "center",
              }}
            >
              {instant ? "⚡ INSTANT ORDER RECEIVED" : "🔔 NEW ORDER RECEIVED"}
            </Text>
            <Text
              style={{
                color: "#FFF",
                fontSize: 28,
                fontWeight: "900",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Accept & Start Preparing
            </Text>
            {countdown ? (
              <Text
                style={{
                  color: "#FFEDD5",
                  fontSize: 16,
                  fontWeight: "700",
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {countdown} left
              </Text>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: theme.background,
              borderRadius: 24,
              padding: 20,
              borderWidth: 2,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: theme.badgeBg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginBottom: 10,
              }}
            >
              <Ionicons name={theme.icon} size={14} color={theme.badgeText} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  fontWeight: "800",
                  color: theme.badgeText,
                }}
              >
                {instant ? "INSTANT" : formatSlotLabel(pendingOrder.slot).toUpperCase()}
              </Text>
              {theme.accentIcon ? (
                <Ionicons
                  name={theme.accentIcon}
                  size={12}
                  color={theme.badgeText}
                  style={{ marginLeft: 4 }}
                />
              ) : null}
            </View>

            <Text style={{ fontSize: 12, color: theme.muted, fontWeight: "700" }}>
              ORDER #{shortId}
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: theme.title,
                marginTop: 4,
              }}
              numberOfLines={2}
            >
              {getOrderTitle(pendingOrder)}
            </Text>
            <Text style={{ fontSize: 15, color: theme.subtitle, marginTop: 6 }}>
              {pendingOrder.user_name || "Customer"}
              {pendingOrder.user_phone ? ` • ${pendingOrder.user_phone}` : ""}
            </Text>

            <View
              style={{
                marginTop: 14,
                backgroundColor: theme.isDark ? "#1E293B" : "#F8FAFC",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: theme.muted }}>
                ITEMS
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.title,
                  marginTop: 4,
                }}
              >
                {itemPreview || getOrderTitle(pendingOrder)}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Ionicons name={theme.icon} size={14} color={theme.iconColor} />
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.subtitle,
                    marginLeft: 6,
                  }}
                >
                  {formatDeliveryDateLabel(pendingOrder, Date.now())}
                  {pendingOrder.slot
                    ? ` • ${formatSlotLabel(pendingOrder.slot)}`
                    : ""}
                </Text>
              </View>
              {address ? (
                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <Ionicons name="location-outline" size={14} color={theme.muted} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 6,
                      fontSize: 13,
                      color: theme.subtitle,
                    }}
                    numberOfLines={2}
                  >
                    {address}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => onAccept?.(pendingOrder)}
              disabled={isAccepting}
              style={{
                marginTop: 18,
                backgroundColor: theme.ctaBg,
                borderRadius: 18,
                paddingVertical: 16,
                alignItems: "center",
                opacity: isAccepting ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 17, fontWeight: "800" }}>
                {isAccepting ? "Accepting..." : "✓ START PREPARING"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                dismissIncomingOverlay(orderId);
                router.push({
                  pathname: "/order/[id]" as any,
                  params: { id: orderId, openAt: String(Date.now()) },
                });
              }}
              style={{
                marginTop: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#64748B", fontSize: 14, fontWeight: "600" }}>
                View full order details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => snoozeIncomingOrderAlert(orderId)}
              style={{
                marginTop: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#94A3B8", fontSize: 14, fontWeight: "600" }}>
                Dismiss for now
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
