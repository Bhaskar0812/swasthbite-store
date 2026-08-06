import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardData, DashboardOrder } from "types";
import {
  countOrdersByPrepBucket,
  DayTab,
  filterOrdersByPrepBucket,
  formatCountdown,
  formatDeliverByTime,
  formatSlotLabel,
  getDayOrders,
  getInstantDeadline,
  getOrderId,
  getOrderLineItems,
  isInstantOrder,
  isPendingAcceptance,
  PREP_BUCKETS,
  PrepBucket,
  sortActiveOrdersForBoard,
} from "utils/orderActivity";

type QuickAction = { label: string; value: string };

type Props = {
  dashboard: DashboardData | null;
  onOrderPress?: (order: DashboardOrder) => void;
  onQuickAction?: (order: DashboardOrder, status: string) => void;
  updatingOrder?: string | null;
  nextActions?: (status: string) => QuickAction[];
};

const SimpleOrderRow = ({
  order,
  now,
  onPress,
  onQuickAction,
  updatingOrder,
  nextActions,
}: {
  order: DashboardOrder;
  now: number;
  onPress?: () => void;
  onQuickAction?: (order: DashboardOrder, status: string) => void;
  updatingOrder?: string | null;
  nextActions?: (status: string) => QuickAction[];
}) => {
  const instant = isInstantOrder(order);
  const pending = isPendingAcceptance(order);
  const lineItems = getOrderLineItems(order);
  const orderKey = getOrderId(order);
  const isUpdating = Boolean(
    updatingOrder &&
      (updatingOrder === orderKey || String(updatingOrder).startsWith(`${orderKey}-`)),
  );
  const actions = nextActions?.(String(order.status || "").toLowerCase()) || [];
  const primaryAction = actions[0] || null;
  const countdown = instant
    ? formatCountdown(getInstantDeadline(order), now, { withSeconds: true })
    : "";

  const borderColor = instant
    ? "#2563EB"
    : pending
      ? "#D97706"
      : "#E2E8F0";
  const bg = instant ? "#EFF6FF" : pending ? "#FFFBEB" : "#FFFFFF";

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        borderRadius: 18,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View className="flex-row items-start justify-between mb-1">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-extrabold text-slate-900" numberOfLines={1}>
            {order.user_name || "Customer"}
          </Text>
          {order.user_phone ? (
            <Text className="text-sm text-slate-500 mt-0.5">{order.user_phone}</Text>
          ) : null}
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: instant ? "#2563EB" : "#F1F5F9" }}
        >
          <Text
            className="text-xs font-bold"
            style={{ color: instant ? "#fff" : "#334155" }}
          >
            {instant ? "INSTANT" : formatSlotLabel(order.slot)}
          </Text>
        </View>
      </View>

      <Text className="text-base font-semibold text-slate-700 mb-2">
        {instant ? "Deliver ASAP" : `Deliver by ${formatDeliverByTime(order)}`}
      </Text>

      {lineItems.length > 0 ? (
        <View className="mb-3">
          {lineItems.slice(0, 3).map((item, idx) => (
            <Text
              key={`${item.name}-${idx}`}
              className="text-base font-bold text-slate-900"
              numberOfLines={1}
            >
              {item.name} ×{item.qty}
            </Text>
          ))}
          {lineItems.length > 3 ? (
            <Text className="text-sm text-slate-500 mt-0.5">
              +{lineItems.length - 3} more items
            </Text>
          ) : null}
        </View>
      ) : (
        <Text className="text-base font-semibold text-slate-600 mb-3" numberOfLines={2}>
          {order.meal_name || order.package_name || "Order"}
        </Text>
      )}

      {instant && countdown ? (
        <Text className="text-base font-extrabold text-blue-700 mb-2">
          Time left: {countdown}
        </Text>
      ) : null}

      {primaryAction && onQuickAction ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onQuickAction(order, primaryAction.value);
          }}
          disabled={isUpdating}
          className="rounded-xl py-3.5 items-center"
          style={{
            backgroundColor:
              primaryAction.value === "out_for_delivery" ? "#059669" : "#1D4ED8",
            opacity: isUpdating ? 0.6 : 1,
          }}
        >
          <Text className="text-base font-bold text-white">
            {isUpdating ? "Updating…" : primaryAction.label}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text className="text-sm font-semibold text-slate-500 text-center">
          Tap for details
        </Text>
      )}
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

  const orders = useMemo(
    () =>
      sortActiveOrdersForBoard(filterOrdersByPrepBucket(dayOrders, prepBucket)),
    [dayOrders, prepBucket],
  );

  const todayCount = dashboard?.today_orders?.length || 0;
  const tomorrowCount = dashboard?.tomorrow_orders?.length || 0;
  const pendingCount = dayOrders.filter((o) => isPendingAcceptance(o)).length;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (orders.length > 0) return;
    const next = PREP_BUCKETS.find((b) => bucketCounts[b.key] > 0);
    if (next && next.key !== prepBucket) setPrepBucket(next.key);
  }, [orders.length, bucketCounts, prepBucket]);

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
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: "#1D4ED8",
        }}
      >
        <View className="flex-row items-center mb-3">
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
                ? `${orders.length} · ${bucketHeadline}`
                : bucketHeadline}
            </Text>
          </View>
        </View>

        <View
          className="flex-row rounded-xl p-1 mb-3"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        >
          {(
            [
              {
                key: "today" as DayTab,
                label: "Today",
                count: todayCount,
                activeCount: todayActionableCount,
              },
              {
                key: "tomorrow" as DayTab,
                label: "Tomorrow",
                count: tomorrowCount,
              },
            ] as const
          ).map((tab) => {
            const active = dayTab === tab.key;
            const countLabel =
              tab.key === "today" &&
              tab.activeCount != null &&
              tab.activeCount !== tab.count
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

        <View
          className="flex-row rounded-xl p-1"
          style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        >
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
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: "#FFF",
              fontSize: 15,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            {pendingCount} new order{pendingCount === 1 ? "" : "s"} waiting — accept now
          </Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
        {orders.length > 0 ? (
          orders.map((order, index) => (
            <SimpleOrderRow
              key={getOrderId(order) || `order-${index}`}
              order={order}
              now={now}
              onPress={() => onOrderPress?.(order)}
              onQuickAction={onQuickAction}
              updatingOrder={updatingOrder}
              nextActions={nextActions}
            />
          ))
        ) : (
          <View className="py-8 items-center px-4">
            <Ionicons name="checkmark-done-outline" size={36} color="#94A3B8" />
            <Text className="text-base text-slate-500 mt-2 text-center">
              {dayTab === "today"
                ? `Nothing in "${bucketHeadline}" right now.`
                : "No orders in this bucket for tomorrow."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
