import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardData, DashboardOrder } from "types";
import {
  formatCountdown,
  formatDueTime,
  formatSlotLabel,
  formatStatusLabel,
  getActionableOrders,
  getInstantDeadline,
  getOrderActivityStats,
  getOrderId,
  getOrderTitle,
  isInstantOrder,
  isPendingAcceptance,
  isPreparingStatus,
  sortActiveOrdersForBoard,
} from "utils/orderActivity";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 56;
const CARD_GAP = 12;

type Props = {
  dashboard: DashboardData | null;
  onOrderPress?: (order: DashboardOrder) => void;
};

const StatPill = ({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) => (
  <View
    className="flex-1 rounded-2xl px-2.5 py-2.5 mx-0.5"
    style={{ backgroundColor: bg }}
  >
    <Text className="text-[10px] font-semibold" style={{ color }}>
      {label}
    </Text>
    <Text className="text-xl font-extrabold mt-0.5" style={{ color }}>
      {value}
    </Text>
  </View>
);

const OrderActivityCard = ({
  order,
  now,
  index,
  total,
  onPress,
}: {
  order: DashboardOrder;
  now: number;
  index: number;
  total: number;
  onPress?: () => void;
}) => {
  const instant = isInstantOrder(order);
  const pending = isPendingAcceptance(order);
  const preparing = isPreparingStatus(order.status);
  const deadline = getInstantDeadline(order);
  const countdown = instant
    ? formatCountdown(deadline, now, { withSeconds: true })
    : "";
  const shortId = getOrderId(order).slice(-6).toUpperCase();

  const accent = instant ? "#2563EB" : pending ? "#D97706" : preparing ? "#059669" : "#475569";
  const cardBg = instant ? "#EFF6FF" : pending ? "#FFFBEB" : preparing ? "#ECFDF5" : "#F8FAFC";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        width: CARD_WIDTH,
        marginRight: CARD_GAP,
        borderRadius: 22,
        backgroundColor: cardBg,
        borderWidth: 1.5,
        borderColor: accent + "33",
        padding: 16,
        minHeight: 188,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: accent + "18" }}
        >
          <Text className="text-[10px] font-extrabold" style={{ color: accent }}>
            {index}/{total}
          </Text>
        </View>
        {instant ? (
          <View
            className="px-2.5 py-1 rounded-full flex-row items-center"
            style={{ backgroundColor: "#2563EB" }}
          >
            <Ionicons name="flash" size={11} color="#fff" />
            <Text className="text-[10px] font-bold text-white ml-1">INSTANT</Text>
          </View>
        ) : null}
      </View>

      <Text className="text-base font-extrabold text-slate-900" numberOfLines={2}>
        {getOrderTitle(order)}
      </Text>
      <Text className="text-xs text-slate-500 mt-1" numberOfLines={1}>
        #{shortId} • {order.user_name || "Customer"}
      </Text>

      <View className="flex-row flex-wrap mt-3">
        <View className="px-2 py-1 rounded-full mr-1.5 mb-1" style={{ backgroundColor: "#fff" }}>
          <Text className="text-[10px] font-bold text-slate-700">
            {formatStatusLabel(order.status)}
          </Text>
        </View>
        <View className="px-2 py-1 rounded-full mb-1" style={{ backgroundColor: "#fff" }}>
          <Text className="text-[10px] font-bold text-slate-700">
            {instant ? "Instant" : `Slot ${formatSlotLabel(order.slot)}`}
          </Text>
        </View>
      </View>

      {instant ? (
        <View
          className="mt-3 rounded-2xl px-3 py-3 items-center"
          style={{ backgroundColor: "#1D4ED8" }}
        >
          <Text className="text-[10px] font-semibold text-blue-100 uppercase tracking-widest">
            {preparing ? "Prepare & deliver in" : pending ? "Accept within" : "Time left"}
          </Text>
          <Text className="text-3xl font-black text-white mt-1 tracking-wider">
            {countdown || "—"}
          </Text>
        </View>
      ) : (
        <View className="mt-3 rounded-2xl px-3 py-3" style={{ backgroundColor: "#fff" }}>
          <Text className="text-[10px] font-semibold text-slate-500 uppercase">
            {pending ? "Action needed" : "Due time"}
          </Text>
          <Text className="text-lg font-extrabold text-slate-800 mt-0.5">
            {pending ? "Tap to accept" : formatDueTime(order)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function LiveOrderActivityBoard({ dashboard, onOrderPress }: Props) {
  const [now, setNow] = useState(Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const orders = useMemo(
    () => sortActiveOrdersForBoard(getActionableOrders(dashboard)),
    [dashboard],
  );
  const stats = useMemo(
    () => getOrderActivityStats(dashboard, now),
    [dashboard, now],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeIndex >= orders.length) {
      setActiveIndex(0);
    }
  }, [orders.length, activeIndex]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(nextIndex, Math.max(orders.length - 1, 0))));
  };

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4"
      style={{
        borderWidth: 1,
        borderColor: "#BFDBFE",
        backgroundColor: "#fff",
      }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 14,
          backgroundColor: "#1D4ED8",
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-2xl items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Ionicons name="pulse" size={20} color="#fff" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-semibold text-blue-100">Live Activity</Text>
              <Text className="text-lg font-extrabold text-white">
                {stats.active > 0 ? `${stats.active} Active Orders` : "Waiting for orders"}
              </Text>
            </View>
          </View>
          {stats.urgentInstant > 0 ? (
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: "#FEE2E2" }}>
              <Text className="text-[11px] font-bold" style={{ color: "#B91C1C" }}>
                {stats.urgentInstant} urgent
              </Text>
            </View>
          ) : stats.active > 0 ? (
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Text className="text-[11px] font-bold text-white">
                Swipe →
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row mt-3">
          <StatPill label="Pending" value={stats.pending} color="#92400E" bg="rgba(255,255,255,0.92)" />
          <StatPill label="Preparing" value={stats.preparing} color="#1D4ED8" bg="rgba(255,255,255,0.92)" />
          <StatPill label="Out" value={stats.outForDelivery} color="#047857" bg="rgba(255,255,255,0.92)" />
          <StatPill label="Done" value={stats.delivered} color="#C2410C" bg="rgba(255,255,255,0.92)" />
        </View>
      </View>

      <View className="py-4">
        {orders.length > 0 ? (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16 }}
              onMomentumScrollEnd={onScrollEnd}
            >
              {orders.map((order, index) => (
                <OrderActivityCard
                  key={getOrderId(order) || `${index}`}
                  order={order}
                  now={now}
                  index={index + 1}
                  total={orders.length}
                  onPress={() => onOrderPress?.(order)}
                />
              ))}
            </ScrollView>

            <View className="flex-row items-center justify-center mt-3">
              {orders.map((order, index) => (
                <View
                  key={getOrderId(order) || `dot-${index}`}
                  style={{
                    width: index === activeIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 999,
                    marginHorizontal: 3,
                    backgroundColor: index === activeIndex ? "#1D4ED8" : "#CBD5E1",
                  }}
                />
              ))}
            </View>

            <Text className="text-center text-[11px] text-slate-500 mt-2 px-4">
              Swipe to see time left on each order • Tap card for details
            </Text>
          </>
        ) : (
          <View className="px-4 py-6 items-center">
            <Ionicons name="checkmark-done-circle-outline" size={36} color="#94A3B8" />
            <Text className="text-sm text-slate-500 mt-2 text-center">
              No active orders right now. New orders will appear here with live timers.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
