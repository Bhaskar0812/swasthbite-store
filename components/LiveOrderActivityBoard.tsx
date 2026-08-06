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
  countOrdersBySlot,
  countOrdersByPrepBucket,
  DayTab,
  filterOrdersBySlot,
  filterOrdersByPrepBucket,
  formatCountdown,
  formatDeliveryDateLabel,
  formatDueTime,
  formatDeliverByTime,
  formatSlotLabel,
  formatSlotWindow,
  formatStatusLabel,
  getDayOrders,
  getInstantDeadline,
  getOrderId,
  getOrderLineItems,
  getPrepBucket,
  isInstantOrder,
  isPendingAcceptance,
  isPreparingStatus,
  PREP_BUCKETS,
  PrepBucket,
  sortActiveOrdersForBoard,
  SLOT_FILTERS,
  SlotFilter,
} from "utils/orderActivity";
import OrderProgressStepper from "components/OrderProgressStepper";
import { resolveStoreOrderProgress } from "utils/orderProgressSteps";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_GAP = 12;

type QuickAction = { label: string; value: string };

type Props = {
  dashboard: DashboardData | null;
  onOrderPress?: (order: DashboardOrder) => void;
  onQuickAction?: (order: DashboardOrder, status: string) => void;
  updatingOrder?: string | null;
  nextActions?: (status: string) => QuickAction[];
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
    className="flex-1 rounded-2xl px-2 py-2.5 mx-0.5"
    style={{ backgroundColor: bg }}
  >
    <Text className="text-xs font-semibold" style={{ color }}>
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
  dayHint,
  onPress,
  onQuickAction,
  updatingOrder,
  nextActions,
}: {
  order: DashboardOrder;
  now: number;
  index: number;
  total: number;
  dayHint?: DayTab;
  onPress?: () => void;
  onQuickAction?: (order: DashboardOrder, status: string) => void;
  updatingOrder?: string | null;
  nextActions?: (status: string) => QuickAction[];
}) => {
  const instant = isInstantOrder(order);
  const pending = isPendingAcceptance(order);
  const preparing = isPreparingStatus(order.status);
  const deadline = getInstantDeadline(order);
  const countdown = instant
    ? formatCountdown(deadline, now, { withSeconds: true })
    : "";
  const shortId = getOrderId(order).slice(-6).toUpperCase();
  const lineItems = getOrderLineItems(order);
  const progress = resolveStoreOrderProgress(order.status);
  const orderKey = getOrderId(order);
  const isUpdating = updatingOrder === orderKey;

  const accent = instant
    ? "#2563EB"
    : pending
      ? "#D97706"
      : preparing
        ? "#059669"
        : "#475569";
  const cardBg = instant
    ? "#EFF6FF"
    : pending
      ? "#FFFBEB"
      : preparing
        ? "#ECFDF5"
        : "#F8FAFC";

  const actions = nextActions?.(String(order.status || "").toLowerCase()) || [];

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
        padding: 18,
        minHeight: 360,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: accent + "18" }}
        >
          <Text className="text-xs font-extrabold" style={{ color: accent }}>
            Order {index}/{total}
          </Text>
        </View>
        {instant ? (
          <View
            className="px-3 py-1.5 rounded-full flex-row items-center"
            style={{ backgroundColor: "#2563EB" }}
          >
            <Ionicons name="flash" size={14} color="#fff" />
            <Text className="text-xs font-bold text-white ml-1">INSTANT</Text>
          </View>
        ) : (
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: "#fff" }}>
            <Text className="text-xs font-bold text-slate-700">
              {formatSlotLabel(order.slot)}
            </Text>
          </View>
        )}
      </View>

      <View className="rounded-xl px-3.5 py-2.5 mb-2" style={{ backgroundColor: "#fff" }}>
        <Text className="text-xs font-bold text-slate-500 uppercase">
          {formatDeliveryDateLabel(order, now, { dayHint })}
        </Text>
        <Text className="text-lg font-extrabold text-slate-900 mt-0.5">
          {instant ? "Deliver ASAP" : `Deliver by ${formatDeliverByTime(order)}`}
        </Text>
        {!instant ? (
          <Text className="text-sm text-slate-500 mt-0.5">
            Window: {formatSlotWindow(order.slot)}
          </Text>
        ) : null}
      </View>

      <Text className="text-base font-semibold text-slate-800">
        #{shortId} • {order.user_name || "Customer"}
      </Text>
      {order.user_phone ? (
        <Text className="text-sm text-slate-500 mt-0.5">{order.user_phone}</Text>
      ) : null}
      {(order.delivery_address?.full_address ||
        order.delivery_address?.address ||
        order.address_snapshot?.full_address) ? (
        <View className="flex-row items-start mt-2">
          <Ionicons name="location-outline" size={16} color="#64748B" style={{ marginTop: 2 }} />
          <Text className="text-sm text-slate-600 ml-1.5 flex-1" numberOfLines={3}>
            {order.delivery_address?.full_address ||
              order.delivery_address?.address ||
              order.address_snapshot?.full_address}
          </Text>
        </View>
      ) : null}

      <View
        className="mt-3 rounded-2xl px-3.5 py-3.5"
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: accent + "22" }}
      >
        <Text className="text-xs font-bold text-slate-500 uppercase mb-2">
          Prepare
        </Text>
        {lineItems.map((item, itemIndex) => (
          <View
            key={`${item.name}-${itemIndex}`}
            className="flex-row items-center justify-between py-2"
            style={{
              borderBottomWidth: itemIndex < lineItems.length - 1 ? 1 : 0,
              borderBottomColor: "#F1F5F9",
            }}
          >
            <Text className="text-base font-bold text-slate-900 flex-1 mr-2" numberOfLines={3}>
              {item.name}
            </Text>
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: accent + "18" }}>
              <Text className="text-sm font-extrabold" style={{ color: accent }}>
                ×{item.qty}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap mt-2">
        <View className="px-2.5 py-1.5 rounded-full mr-1.5 mb-1" style={{ backgroundColor: "#fff" }}>
          <Text className="text-xs font-bold text-slate-700">
            {formatStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      <View
        className="mt-2 rounded-2xl px-3.5 py-3.5"
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: accent + "22" }}
      >
        <Text className="text-xs font-semibold text-slate-500 uppercase mb-2">
          {progress.headline}
        </Text>
        <OrderProgressStepper progress={progress} accent={accent} />
      </View>

      {instant ? (
        <View
          className="mt-3 rounded-2xl px-3 py-3.5 items-center"
          style={{ backgroundColor: "#1D4ED8" }}
        >
          <Text className="text-xs font-semibold text-blue-100 uppercase tracking-widest">
            {preparing ? "Prepare & deliver in" : pending ? "Accept within" : "Time left"}
          </Text>
          <Text className="text-4xl font-black text-white mt-1 tracking-wider">
            {countdown || "—"}
          </Text>
        </View>
      ) : pending ? (
        <View className="mt-3 rounded-2xl px-3 py-2.5 items-center" style={{ backgroundColor: "#FEF3C7" }}>
          <Text className="text-sm font-bold text-amber-900">Tap card to accept & start preparing</Text>
        </View>
      ) : null}

      {actions.length > 0 && onQuickAction ? (
        <View className="flex-row flex-wrap mt-3">
          {actions.map((action) => (
            <TouchableOpacity
              key={action.value}
              onPress={() => onQuickAction(order, action.value)}
              disabled={isUpdating}
              className="flex-1 mx-0.5 px-3 py-3.5 rounded-xl items-center"
              style={{
                backgroundColor:
                  action.value === "out_for_delivery" ? "#059669" : "#1D4ED8",
                opacity: isUpdating ? 0.6 : 1,
              }}
            >
              <Text className="text-sm font-bold text-white">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export default function LiveOrderActivityBoard({
  dashboard,
  onOrderPress,
  onQuickAction,
  updatingOrder,
  nextActions,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const [dayTab, setDayTab] = useState<DayTab>("today");
  const [prepBucket, setPrepBucket] = useState<PrepBucket>("to_prepare");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const dayOrders = useMemo(
    () =>
      getDayOrders(dashboard, dayTab, {
        actionableOnly: dayTab === "tomorrow",
      }),
    [dashboard, dayTab],
  );

  const todayActionableCount = useMemo(
    () => getDayOrders(dashboard, "today", { actionableOnly: true }).length,
    [dashboard],
  );

  const bucketCounts = useMemo(
    () => countOrdersByPrepBucket(dayOrders),
    [dayOrders],
  );

  const bucketOrders = useMemo(
    () => filterOrdersByPrepBucket(dayOrders, prepBucket),
    [dayOrders, prepBucket],
  );

  const slotCounts = useMemo(
    () => countOrdersBySlot(bucketOrders),
    [bucketOrders],
  );

  const orders = useMemo(
    () =>
      sortActiveOrdersForBoard(filterOrdersBySlot(bucketOrders, slotFilter)),
    [bucketOrders, slotFilter],
  );

  const todayCount = dashboard?.today_orders?.length || 0;
  const tomorrowCount = dashboard?.tomorrow_orders?.length || 0;
  const todayActiveCount = todayActionableCount;

  const pendingCount = dayOrders.filter((o) => isPendingAcceptance(o)).length;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [dayTab, prepBucket, slotFilter]);

  useEffect(() => {
    if (activeIndex >= orders.length) {
      setActiveIndex(0);
    }
  }, [orders.length, activeIndex]);

  useEffect(() => {
    if (orders.length > 0) return;
    const next = PREP_BUCKETS.find((b) => bucketCounts[b.key] > 0);
    if (next && next.key !== prepBucket) setPrepBucket(next.key);
  }, [orders.length, bucketCounts, prepBucket]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(nextIndex, Math.max(orders.length - 1, 0))));
  };

  const bucketHeadline =
    prepBucket === "to_prepare"
      ? "Needs kitchen action"
      : prepBucket === "preparing"
        ? "In the kitchen"
        : "Handed to rider";

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4"
      style={{
        borderWidth: 1,
        borderColor: "#BFDBFE",
        backgroundColor: "#fff",
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: "#1D4ED8" }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-2xl items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Ionicons name="restaurant" size={20} color="#fff" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-blue-100">Prep queue</Text>
              <Text className="text-xl font-extrabold text-white">
                {orders.length > 0
                  ? `${orders.length} in ${bucketHeadline.toLowerCase()}`
                  : bucketHeadline}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row mt-3 rounded-xl p-1" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          {([
            { key: "today" as DayTab, label: "Today", count: todayCount, activeCount: todayActiveCount },
            { key: "tomorrow" as DayTab, label: "Tomorrow", count: tomorrowCount },
          ]).map((tab) => {
            const active = dayTab === tab.key;
            const countLabel =
              tab.key === "today" && tab.activeCount != null && tab.activeCount !== tab.count
                ? `${tab.count} (${tab.activeCount} active)`
                : String(tab.count);
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setDayTab(tab.key)}
                className="flex-1 py-2.5 rounded-lg items-center"
                style={{ backgroundColor: active ? "#fff" : "transparent" }}
              >
                <Text
                  className="text-base font-extrabold"
                  style={{ color: active ? "#1D4ED8" : "#E0E7FF" }}
                >
                  {tab.label} ({countLabel})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row mt-3 rounded-xl p-1" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
          {PREP_BUCKETS.map((bucket) => {
            const active = prepBucket === bucket.key;
            const count = bucketCounts[bucket.key];
            return (
              <TouchableOpacity
                key={bucket.key}
                onPress={() => setPrepBucket(bucket.key)}
                className="flex-1 py-3 rounded-lg items-center mx-0.5"
                style={{ backgroundColor: active ? "#fff" : "transparent" }}
              >
                <Text
                  className="text-xs font-extrabold"
                  style={{ color: active ? "#1D4ED8" : "#E0E7FF" }}
                >
                  {bucket.label}
                </Text>
                <Text
                  className="text-lg font-black mt-0.5"
                  style={{ color: active ? "#1D4ED8" : "#FFF" }}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {pendingCount > 0 && prepBucket === "to_prepare" ? (
        <View
          style={{
            backgroundColor: "#DC2626",
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: "#FFF",
              fontSize: 16,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            🔔 {pendingCount} NEW ORDER{pendingCount === 1 ? "" : "S"} WAITING — ACCEPT NOW
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        {SLOT_FILTERS.map((slot) => {
          const count = slotCounts[slot.key];
          const active = slotFilter === slot.key;
          return (
            <TouchableOpacity
              key={slot.key}
              onPress={() => setSlotFilter(slot.key)}
              className="mr-2 px-3.5 py-2.5 rounded-xl"
              style={{
                backgroundColor: active ? "#DBEAFE" : "#F8FAFC",
                borderWidth: 1,
                borderColor: active ? "#1D4ED8" : "#E2E8F0",
              }}
            >
              <Text
                className="text-sm font-bold"
                style={{ color: active ? "#1D4ED8" : "#64748B" }}
              >
                {slot.icon ? `${slot.icon} ` : ""}
                {slot.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View className="py-3">
        {orders.length > 0 ? (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 12 }}
              onMomentumScrollEnd={onScrollEnd}
            >
              {orders.map((order, index) => (
                <OrderActivityCard
                  key={getOrderId(order) || `${index}`}
                  order={order}
                  now={now}
                  index={index + 1}
                  total={orders.length}
                  dayHint={dayTab}
                  onPress={() => onOrderPress?.(order)}
                  onQuickAction={onQuickAction}
                  updatingOrder={updatingOrder}
                  nextActions={nextActions}
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

            <Text className="text-center text-sm text-slate-500 mt-2 px-4">
              Buckets: To prepare → Preparing → Out · Slot chips filter within bucket
            </Text>
          </>
        ) : (
          <View className="px-4 py-8 items-center">
            <Ionicons name="restaurant-outline" size={40} color="#94A3B8" />
            <Text className="text-base text-slate-500 mt-2 text-center">
              {dayTab === "today"
                ? `Nothing in "${bucketHeadline}" for this filter.`
                : "No orders scheduled for this bucket tomorrow."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
