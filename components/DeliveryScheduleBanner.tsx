import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardOrder } from "types";
import {
  formatDeliveryDateLabel,
  formatSlotLabel,
  getSlotCardTheme,
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
  const theme = getSlotCardTheme(order.slot, { instant });
  const dateLabel = formatDeliveryDateLabel(order, now);
  const slotLabel = instant ? "Instant" : formatSlotLabel(order.slot);

  if (compact) {
    return (
      <View
        className="rounded-2xl px-3 py-2 mb-2 flex-row items-center"
        style={{
          backgroundColor: theme.background,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Ionicons name={theme.icon} size={16} color={theme.iconColor} />
        <View className="ml-2 flex-1">
          <Text className="text-sm font-extrabold" style={{ color: theme.title }}>
            {dateLabel}
          </Text>
          <Text className="text-base font-bold mt-0.5" style={{ color: theme.subtitle }}>
            {slotLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl px-4 py-3 mb-3"
      style={{
        backgroundColor: theme.background,
        borderWidth: 1.5,
        borderColor: theme.border,
      }}
    >
      <View className="flex-row items-center mb-1">
        <Ionicons name="calendar-outline" size={18} color={theme.iconColor} />
        <Text
          className="text-xl font-extrabold ml-2 flex-1"
          style={{ color: theme.title }}
          numberOfLines={2}
        >
          {dateLabel}
        </Text>
      </View>
      <View className="flex-row items-center">
        <View
          className="w-8 h-8 rounded-xl items-center justify-center mr-2"
          style={{ backgroundColor: theme.iconBg }}
        >
          <Ionicons name={theme.icon} size={17} color={theme.iconColor} />
        </View>
        <Text className="text-lg font-bold" style={{ color: theme.subtitle }}>
          {slotLabel}
        </Text>
        {theme.accentIcon ? (
          <Ionicons
            name={theme.accentIcon}
            size={14}
            color={theme.iconColor}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>
    </View>
  );
}
