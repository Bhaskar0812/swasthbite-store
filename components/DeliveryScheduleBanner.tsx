import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardOrder } from "types";
import {
  formatDeliveryDateLabel,
  formatSlotLabel,
  isInstantOrder,
} from "utils/orderActivity";

type Props = {
  order: DashboardOrder;
  now?: number;
  compact?: boolean;
};

export default function DeliveryScheduleBanner({
  order,
  now = Date.now(),
  compact = false,
}: Props) {
  const instant = isInstantOrder(order);
  const dateLabel = formatDeliveryDateLabel(order, now);
  const slotLabel = instant ? "Instant" : formatSlotLabel(order.slot);

  if (compact) {
    return (
      <View
        className="rounded-2xl px-3 py-2 mb-2"
        style={{ backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }}
      >
        <Text className="text-sm font-extrabold" style={{ color: "#312E81" }}>
          {dateLabel}
        </Text>
        <Text className="text-base font-bold mt-0.5" style={{ color: "#1D4ED8" }}>
          {slotLabel}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl px-4 py-3 mb-3"
      style={{ backgroundColor: "#EEF2FF", borderWidth: 1.5, borderColor: "#A5B4FC" }}
    >
      <View className="flex-row items-center mb-1">
        <Ionicons name="calendar-outline" size={18} color="#4338CA" />
        <Text
          className="text-xl font-extrabold ml-2 flex-1"
          style={{ color: "#312E81" }}
          numberOfLines={2}
        >
          {dateLabel}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Ionicons
          name={instant ? "flash" : "time-outline"}
          size={17}
          color="#1D4ED8"
        />
        <Text className="text-lg font-bold ml-2" style={{ color: "#1D4ED8" }}>
          {slotLabel}
        </Text>
      </View>
    </View>
  );
}
