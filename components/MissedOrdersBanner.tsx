import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardData, DashboardOrder } from "types";
import {
  formatSlotLabel,
  getOrderId,
  getOrderTitle,
  getSlotCardTheme,
} from "utils/orderActivity";

type Props = {
  dashboard: DashboardData | null | undefined;
  onOrderPress: (order: DashboardOrder) => void;
};

const formatDateLabel = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

export default function MissedOrdersBanner({ dashboard, onOrderPress }: Props) {
  const missedOrders = dashboard?.missed_orders || [];
  if (!missedOrders.length) return null;

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4"
      style={{
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FFF",
      }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: "#DC2626",
        }}
      >
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-2xl items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <Ionicons name="alert-circle" size={20} color="#fff" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-white text-xl font-extrabold">
              Missed Deliveries
            </Text>
            <Text className="text-red-100 text-base mt-0.5">
              {missedOrders.length} need action — mark delivered, reschedule, or mark rescheduled
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {missedOrders.map((order) => {
          const orderId = getOrderId(order);
          const theme = getSlotCardTheme(order.slot);
          return (
            <TouchableOpacity
              key={`${orderId}-${order.date}-${order.slot}`}
              onPress={() => onOrderPress(order)}
              activeOpacity={0.85}
              style={{
                width: 280,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: "#F87171",
                backgroundColor: theme.background,
                padding: 16,
                overflow: "hidden",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  opacity: theme.isDark ? 0.35 : 0.2,
                }}
              >
                <Ionicons name={theme.icon} size={48} color={theme.iconColor} />
              </View>

              <View className="flex-row items-center mb-1">
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                  style={{ backgroundColor: theme.iconBg }}
                >
                  <Ionicons name={theme.icon} size={16} color={theme.iconColor} />
                </View>
                <Text
                  className="text-sm font-bold uppercase"
                  style={{ color: theme.isDark ? "#FCA5A5" : "#B91C1C" }}
                >
                  Missed • {formatSlotLabel(order.slot)}
                </Text>
              </View>
              <Text
                className="text-lg font-extrabold mt-1"
                style={{ color: theme.title }}
                numberOfLines={2}
              >
                {getOrderTitle(order)}
              </Text>
              <Text
                className="text-base mt-1"
                style={{ color: theme.muted }}
                numberOfLines={1}
              >
                {order.user_name || "Customer"}
              </Text>
              <Text
                className="text-base font-semibold mt-2"
                style={{ color: theme.subtitle }}
              >
                {formatDateLabel(order.date)}
              </Text>
              <View className="flex-row items-center mt-3">
                <Text
                  className="text-base font-bold"
                  style={{ color: theme.isDark ? "#FCA5A5" : "#B91C1C" }}
                >
                  Tap to manage
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.isDark ? "#FCA5A5" : "#B91C1C"}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
