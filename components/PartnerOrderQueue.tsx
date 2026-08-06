import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "constants/theme";
import DeliveryScheduleBanner from "components/DeliveryScheduleBanner";
import type { DashboardOrder } from "types";
import {
  buildPartnerOrderQueue,
  formatCountdown,
  formatSlotLabel,
  formatStatusLabel,
  getInstantDeadline,
  getOrderCardKey,
  getOrderTitle,
  getSlotCardTheme,
  isInstantOrder,
  isPendingAcceptance,
  isPreparingStatus,
  isOutForDeliveryStatus,
} from "utils/orderActivity";

type QuickAction = { label: string; value: string };

type Props = {
  dashboard: Parameters<typeof buildPartnerOrderQueue>[0];
  now: number;
  onOrderPress: (order: DashboardOrder) => void;
  onQuickAction?: (order: DashboardOrder, status: string) => void;
  updatingOrder?: string | null;
  statusOverrides?: Record<string, string>;
  getOrderTitle?: (order: DashboardOrder) => string;
  getOrderImage?: (order: DashboardOrder) => string;
  getOrderAddress?: (order: DashboardOrder) => string;
  nextActions?: (status: string) => QuickAction[];
};

const resolveStatus = (
  order: DashboardOrder,
  statusOverrides?: Record<string, string>,
) => {
  const key = getOrderCardKey(order);
  return String(statusOverrides?.[key] || order.status || "").toLowerCase();
};

const QueueChip = ({
  order,
  index,
  selected,
  isNow,
  isNext,
  onPress,
}: {
  order: DashboardOrder;
  index: number;
  selected: boolean;
  isNow: boolean;
  isNext: boolean;
  onPress: () => void;
}) => {
  const pending = isPendingAcceptance(order);
  const instant = isInstantOrder(order);
  const theme = getSlotCardTheme(order.slot, { instant });
  const slot = instant ? "Instant" : formatSlotLabel(order.slot);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="mr-2 rounded-2xl px-3 py-2.5"
      style={{
        minWidth: 108,
        borderWidth: 2,
        borderColor: selected ? theme.border : theme.border,
        backgroundColor: selected ? theme.background : theme.background,
        opacity: selected ? 1 : 0.85,
      }}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text
          className="text-[10px] font-extrabold"
          style={{ color: theme.muted }}
        >
          #{index + 1}
        </Text>
        {isNow ? (
          <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#DC2626" }}>
            <Text className="text-[9px] font-extrabold text-white">NOW</Text>
          </View>
        ) : isNext ? (
          <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F59E0B" }}>
            <Text className="text-[9px] font-extrabold text-white">NEXT</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center">
        <Ionicons name={theme.icon} size={14} color={theme.iconColor} />
        <Text
          className="text-xs font-bold ml-1"
          style={{ color: theme.title }}
          numberOfLines={1}
        >
          {slot}
        </Text>
      </View>
      <Text className="text-[10px] mt-0.5" style={{ color: theme.muted }} numberOfLines={1}>
        {order.user_name || "Customer"}
      </Text>
      {pending ? (
        <View className="mt-1 self-start px-1.5 py-0.5 rounded-full bg-amber-100">
          <Text className="text-[9px] font-bold text-amber-800">NEW</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const UpNextRow = ({
  order,
  index,
  onPress,
}: {
  order: DashboardOrder;
  index: number;
  onPress: () => void;
}) => {
  const instant = isInstantOrder(order);
  const theme = getSlotCardTheme(order.slot, { instant });
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center rounded-2xl px-3 py-3 mb-2"
      style={{
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: theme.iconBg }}
      >
        <Ionicons name={theme.icon} size={16} color={theme.iconColor} />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-sm font-bold"
          style={{ color: theme.title }}
          numberOfLines={1}
        >
          {instant ? "Instant" : formatSlotLabel(order.slot)} •{" "}
          {order.user_name || "Customer"}
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: theme.muted }}>
          {formatStatusLabel(order.status)} · #{index + 1}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.muted} />
    </TouchableOpacity>
  );
};

export default function PartnerOrderQueue({
  dashboard,
  now,
  onOrderPress,
  onQuickAction,
  updatingOrder,
  statusOverrides,
  getOrderTitle: getTitleOverride,
  getOrderImage,
  getOrderAddress,
  nextActions,
}: Props) {
  const queue = useMemo(
    () => buildPartnerOrderQueue(dashboard, now),
    [dashboard, now],
  );
  const queueKey = queue.map(getOrderCardKey).join("|");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const prevQueueHeadRef = useRef("");

  useEffect(() => {
    if (!queue.length) {
      setSelectedIndex(0);
      prevQueueHeadRef.current = "";
      return;
    }

    const headKey = getOrderCardKey(queue[0]);
    const headNeedsAttention =
      isPendingAcceptance(queue[0]) ||
      (isInstantOrder(queue[0]) &&
        !["delivered", "completed", "cancelled"].includes(
          String(queue[0].status || "").toLowerCase(),
        ));

    if (headKey !== prevQueueHeadRef.current && headNeedsAttention) {
      setSelectedIndex(0);
      prevQueueHeadRef.current = headKey;
      return;
    }

    prevQueueHeadRef.current = headKey;
    setSelectedIndex((prev) =>
      Math.min(Math.max(prev, 0), queue.length - 1),
    );
  }, [queueKey]);

  const safeIndex = queue.length
    ? Math.min(selectedIndex, queue.length - 1)
    : 0;
  const currentOrder = queue[safeIndex] || null;
  const upNextOrders = queue.slice(safeIndex + 1, safeIndex + 4);

  const resolveTitle = (order: DashboardOrder) =>
    getTitleOverride?.(order) || getOrderTitle(order);

  if (!queue.length) {
    return (
      <View
        className="rounded-3xl p-6 mb-4 items-center"
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" }}
      >
        <Ionicons name="checkmark-done-circle-outline" size={40} color="#94A3B8" />
        <Text className="text-base font-bold text-slate-700 mt-3">No active orders</Text>
        <Text className="text-sm text-slate-500 mt-1 text-center">
          New orders will appear here instantly — you won&apos;t miss any.
        </Text>
      </View>
    );
  }

  const currentStatus = currentOrder
    ? resolveStatus(currentOrder, statusOverrides)
    : "";
  const quickAction = currentOrder
    ? (nextActions?.(currentStatus) || [])[0]
    : null;
  const isUpdating = Boolean(updatingOrder);
  const currentTheme = currentOrder
    ? getSlotCardTheme(currentOrder.slot, {
        instant: isInstantOrder(currentOrder),
      })
    : null;

  return (
    <View className="mb-4">
      <View
        className="rounded-3xl overflow-hidden mb-3"
        style={{ borderWidth: 1.5, borderColor: "#BFDBFE", backgroundColor: "#fff" }}
      >
        <View
          className="px-4 py-3 flex-row items-center justify-between"
          style={{ backgroundColor: "#1D4ED8" }}
        >
          <View className="flex-row items-center flex-1">
            <View
              className="w-9 h-9 rounded-xl items-center justify-center mr-2.5"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Ionicons name="list" size={18} color="#fff" />
            </View>
            <View>
              <Text className="text-xs font-semibold text-blue-100">Order Queue</Text>
              <Text className="text-lg font-extrabold text-white">
                {queue.length} Active {queue.length === 1 ? "Order" : "Orders"}
              </Text>
            </View>
          </View>
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
            <Text className="text-xs font-bold text-white">
              {safeIndex + 1} / {queue.length}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
        >
          {queue.map((order, index) => (
            <QueueChip
              key={getOrderCardKey(order) || `q-${index}`}
              order={order}
              index={index}
              selected={index === safeIndex}
              isNow={index === safeIndex}
              isNext={index === safeIndex + 1}
              onPress={() => setSelectedIndex(index)}
            />
          ))}
        </ScrollView>
      </View>

      {currentOrder && currentTheme ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOrderPress(currentOrder)}
          className="rounded-3xl overflow-hidden mb-3"
          style={{
            borderWidth: 2,
            borderColor: isPendingAcceptance(currentStatus)
              ? "#F59E0B"
              : currentTheme.border,
            backgroundColor: currentTheme.background,
            elevation: 4,
            shadowColor: "#1D4ED8",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
          }}
        >
          <View
            className="px-4 py-2 flex-row items-center justify-between"
            style={{
              backgroundColor: isPendingAcceptance(currentStatus)
                ? "#FEF3C7"
                : currentTheme.iconBg,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="px-2.5 py-1 rounded-full mr-2"
                style={{ backgroundColor: isPendingAcceptance(currentStatus) ? "#DC2626" : currentTheme.badgeBg }}
              >
                <Text
                  className="text-[11px] font-extrabold"
                  style={{
                    color: isPendingAcceptance(currentStatus)
                      ? "#fff"
                      : currentTheme.badgeText,
                  }}
                >
                  {isPendingAcceptance(currentStatus) ? "ACTION NEEDED" : "NOW"}
                </Text>
              </View>
              <Ionicons
                name={currentTheme.icon}
                size={16}
                color={currentTheme.iconColor}
                style={{ marginRight: 6 }}
              />
              <Text className="text-sm font-bold" style={{ color: currentTheme.title }}>
                Order {safeIndex + 1} of {queue.length}
              </Text>
            </View>
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: currentTheme.muted }}
            >
              {formatStatusLabel(currentStatus)}
            </Text>
          </View>

          {getOrderImage?.(currentOrder) ? (
            <Image
              source={{ uri: getOrderImage(currentOrder) }}
              style={{ width: "100%", height: 140 }}
              resizeMode="cover"
            />
          ) : null}

          <View className="p-4">
            <DeliveryScheduleBanner order={currentOrder} now={now} />

            <Text
              className="text-xl font-extrabold"
              style={{ color: currentTheme.title }}
              numberOfLines={2}
            >
              {resolveTitle(currentOrder)}
            </Text>
            <Text
              className="text-sm mt-1"
              style={{ color: currentTheme.muted }}
              numberOfLines={1}
            >
              {currentOrder.user_name || "Customer"}
              {currentOrder.user_phone ? ` • ${currentOrder.user_phone}` : ""}
            </Text>

            {isInstantOrder(currentOrder) ? (
              <View className="mt-3 rounded-2xl px-4 py-3 items-center" style={{ backgroundColor: "#1D4ED8" }}>
                <Text className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">
                  Accept within
                </Text>
                <Text className="text-3xl font-black text-white mt-1">
                  {formatCountdown(getInstantDeadline(currentOrder), now, {
                    withSeconds: true,
                  }) || "—"}
                </Text>
              </View>
            ) : isOutForDeliveryStatus(currentStatus) ? (
              <View className="mt-3 rounded-2xl px-4 py-3" style={{ backgroundColor: '#EFF6FF' }}>
                <Text className="text-xs font-semibold text-blue-700">With delivery partner</Text>
                <Text className="text-base font-bold text-blue-900 mt-0.5">
                  Partner will mark delivered
                </Text>
              </View>
            ) : isPreparingStatus(currentStatus) ? (
              <View className="mt-3 rounded-2xl px-4 py-3" style={{ backgroundColor: "#ECFDF5" }}>
                <Text className="text-xs font-semibold text-emerald-700">Preparing now</Text>
                <Text className="text-base font-bold text-emerald-900 mt-0.5">
                  Mark ready when packed
                </Text>
              </View>
            ) : null}

            {getOrderAddress?.(currentOrder) ? (
              <View
                className="flex-row items-start mt-3 rounded-xl px-3 py-2"
                style={{ backgroundColor: currentTheme.isDark ? "#1E293B" : "#F8FAFC" }}
              >
                <Ionicons name="location-outline" size={14} color={Colors.info} style={{ marginTop: 2 }} />
                <Text
                  className="text-xs ml-2 flex-1"
                  style={{ color: currentTheme.subtitle }}
                  numberOfLines={2}
                >
                  {getOrderAddress(currentOrder)}
                </Text>
              </View>
            ) : null}

            <View className="flex-row mt-4">
              <TouchableOpacity
                onPress={() => onOrderPress(currentOrder)}
                className="flex-1 h-12 rounded-2xl flex-row items-center justify-center mr-2"
                style={{
                  backgroundColor: currentTheme.iconBg,
                  borderWidth: 1,
                  borderColor: currentTheme.border,
                }}
              >
                <Ionicons name="open-outline" size={16} color={currentTheme.iconColor} />
                <Text
                  className="text-sm font-bold ml-1.5"
                  style={{ color: currentTheme.iconColor }}
                >
                  Details
                </Text>
              </TouchableOpacity>
              {quickAction && onQuickAction ? (
                <TouchableOpacity
                  onPress={() => onQuickAction(currentOrder, quickAction.value)}
                  disabled={isUpdating}
                  className="flex-1 h-12 rounded-2xl flex-row items-center justify-center"
                  style={{
                    backgroundColor:
                      quickAction.value === "out_for_delivery"
                        ? "#059669"
                        : currentTheme.ctaBg,
                    opacity: isUpdating ? 0.6 : 1,
                  }}
                >
                  <Ionicons
                    name={
                      quickAction.value === "out_for_delivery"
                        ? "bicycle-outline"
                        : "checkmark-circle-outline"
                    }
                    size={16}
                    color="#fff"
                  />
                  <Text className="text-sm font-bold text-white ml-1.5" numberOfLines={1}>
                    {isUpdating ? "Updating..." : quickAction.label.replace("Accept and ", "")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {upNextOrders.length > 0 ? (
        <View
          className="rounded-2xl p-3"
          style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" }}
        >
          <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">
            Up Next
          </Text>
          {upNextOrders.map((order, idx) => (
            <UpNextRow
              key={getOrderCardKey(order) || `next-${idx}`}
              order={order}
              index={safeIndex + idx + 1}
              onPress={() => {
                setSelectedIndex(safeIndex + idx + 1);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
