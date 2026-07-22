import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { storeService } from "services/storeService";
import { Colors } from "constants/theme";

const SLOT_META: Record<string, { label: string; icon: string }> = {
  morning: { label: "Morning", icon: "sunny-outline" },
  lunch: { label: "Lunch", icon: "restaurant-outline" },
  evening: { label: "Evening", icon: "partly-sunny-outline" },
  dinner: { label: "Dinner", icon: "moon-outline" },
};

const formatDateLabel = (dateStr: string) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const d = new Date(`${dateStr}T12:00:00`);
  const formatted = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (dateStr === today) return `Today · ${formatted}`;
  if (dateStr === tomorrow) return `Tomorrow · ${formatted}`;
  return formatted;
};

export default function DeliveriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [qtyTarget, setQtyTarget] = useState<any>(null);
  const [qtyValue, setQtyValue] = useState("1");
  const [addTarget, setAddTarget] = useState<any>(null);
  const [addDate, setAddDate] = useState("");
  const [addSlot, setAddSlot] = useState("morning");
  const [addQty, setAddQty] = useState("1");
  const [addAtEnd, setAddAtEnd] = useState(true);

  const fetchDeliveries = async () => {
    try {
      const res = await storeService.getManageDeliveries();
      const payload = res?.data || res || {};
      setGrouped(payload.grouped || {});
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDeliveries();
    }, []),
  );

  const keyOf = (d: any) => `${d.subscription_id}-${d.delivery_id}`;

  const handleSkip = (delivery: any) => {
    if (!delivery.can_skip) {
      Alert.alert("Cannot skip", "Skip is allowed until 2 hours before this slot's delivery time.");
      return;
    }
    Alert.alert(
      "Skip delivery?",
      `${delivery.customer_name} · ${delivery.meal_name || delivery.package_name}\nReplacement will be added at plan end.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyKey(keyOf(delivery));
              await storeService.skipDelivery(delivery.subscription_id, {
                date: delivery.date,
                slot: delivery.slot,
                skip_quantity: delivery.quantity || 1,
              });
              await fetchDeliveries();
              Alert.alert("Skipped", "Delivery skipped and replacement added.");
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to skip");
            } finally {
              setBusyKey(null);
            }
          },
        },
      ],
    );
  };

  const openQty = (delivery: any) => {
    setQtyValue(String(Math.max(1, Number(delivery.quantity || 1)) + 1));
    setQtyTarget(delivery);
  };

  const confirmQty = async () => {
    if (!qtyTarget) return;
    const quantity = Number(qtyValue);
    const current = Math.max(1, Number(qtyTarget.quantity || 1));
    if (!Number.isFinite(quantity) || quantity <= current) {
      Alert.alert("Invalid quantity", `Enter more than current qty (${current}).`);
      return;
    }
    try {
      setBusyKey(keyOf(qtyTarget));
      const res = await storeService.updateDeliveryQuantity(qtyTarget.subscription_id, {
        date: qtyTarget.date,
        slot: qtyTarget.slot,
        quantity,
      });
      setQtyTarget(null);
      await fetchDeliveries();
      const charge = Number(res?.data?.delta_charge || 0);
      Alert.alert(
        "Quantity updated",
        charge > 0
          ? `Qty is now ${quantity}. ₹${charge.toFixed(2)} charged to customer wallet.`
          : `Qty is now ${quantity}.`,
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to update quantity");
    } finally {
      setBusyKey(null);
    }
  };

  const openAdd = (delivery: any) => {
    setAddTarget(delivery);
    setAddAtEnd(true);
    setAddDate(delivery.date || "");
    setAddSlot(delivery.slot || "morning");
    setAddQty("1");
  };

  const confirmAdd = async () => {
    if (!addTarget) return;
    const quantity = Math.max(1, Number(addQty) || 1);
    try {
      setBusyKey(keyOf(addTarget));
      await storeService.addDelivery(addTarget.subscription_id, {
        at_end: addAtEnd,
        date: addAtEnd ? undefined : addDate,
        slot: addSlot,
        quantity,
      });
      setAddTarget(null);
      await fetchDeliveries();
      Alert.alert("Delivery added", addAtEnd ? "Added at end of plan." : `Added on ${addDate}.`);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to add delivery");
    } finally {
      setBusyKey(null);
    }
  };

  const dateKeys = Object.keys(grouped).sort();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-xl font-extrabold text-textPrimary">Deliveries</Text>
          <Text className="text-xs text-textSecondary mt-0.5">
            Skip · Reschedule · Increase qty · Add delivery
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/subscriptions" as any)}>
          <Text className="text-sm font-bold" style={{ color: Colors.primary }}>
            Subs
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDeliveries();
              }}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {dateKeys.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <Ionicons name="calendar-outline" size={40} color="#9E9E9E" />
              <Text className="text-base font-bold text-textPrimary mt-3">No upcoming deliveries</Text>
              <Text className="text-sm text-textSecondary mt-2 text-center">
                Active subscription deliveries will appear here for easy management.
              </Text>
            </View>
          ) : (
            dateKeys.map((dateKey) => (
              <View key={dateKey} className="mb-5">
                <Text className="text-sm font-extrabold mb-2" style={{ color: Colors.primary }}>
                  {formatDateLabel(dateKey)}
                </Text>
                {(grouped[dateKey] || []).map((delivery: any) => {
                  const slot = SLOT_META[delivery.slot] || SLOT_META.morning;
                  const busy = busyKey === keyOf(delivery);
                  return (
                    <View
                      key={keyOf(delivery)}
                      className="bg-white rounded-2xl p-4 mb-3 border border-slate-100"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-2">
                          <Text className="text-base font-bold text-textPrimary">
                            {delivery.customer_name}
                          </Text>
                          <Text className="text-sm text-textSecondary mt-1">
                            {delivery.meal_name || delivery.package_name}
                          </Text>
                          <View className="flex-row items-center mt-2">
                            <Ionicons name={slot.icon as any} size={14} color="#6B7280" />
                            <Text className="text-xs text-textTertiary ml-1">
                              {slot.label}
                              {delivery.quantity > 1 ? ` · Qty ${delivery.quantity}` : ""}
                              {delivery.customer_phone ? ` · ${delivery.customer_phone}` : ""}
                            </Text>
                          </View>
                        </View>
                        <View
                          className="px-2 py-1 rounded-lg"
                          style={{
                            backgroundColor:
                              delivery.status === "missed"
                                ? "#FFEBEE"
                                : delivery.status === "preparing"
                                  ? "#FFF3E0"
                                  : "#E8F5E9",
                          }}
                        >
                          <Text
                            className="text-[11px] font-bold capitalize"
                            style={{
                              color:
                                delivery.status === "missed"
                                  ? "#C62828"
                                  : delivery.status === "preparing"
                                    ? "#E65100"
                                    : Colors.success,
                            }}
                          >
                            {delivery.status}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row flex-wrap gap-2 mt-3">
                        <TouchableOpacity
                          onPress={() => handleSkip(delivery)}
                          disabled={!delivery.can_skip || busy}
                          className="px-3 py-2 rounded-xl border"
                          style={{
                            borderColor: delivery.can_skip ? "#D32F2F" : "#E5E7EB",
                            opacity: delivery.can_skip ? 1 : 0.45,
                          }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: delivery.can_skip ? "#D32F2F" : "#9CA3AF" }}
                          >
                            Skip
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: "/order/[id]",
                              params: {
                                id: delivery.subscription_id,
                                focusDate: delivery.date,
                                focusSlot: delivery.slot,
                              },
                            } as any)
                          }
                          className="px-3 py-2 rounded-xl border"
                          style={{ borderColor: "#1565C0" }}
                        >
                          <Text className="text-xs font-bold" style={{ color: "#1565C0" }}>
                            Reschedule
                          </Text>
                        </TouchableOpacity>

                        {delivery.can_increase_quantity ? (
                          <TouchableOpacity
                            onPress={() => openQty(delivery)}
                            disabled={busy}
                            className="px-3 py-2 rounded-xl border"
                            style={{ borderColor: Colors.success, backgroundColor: "#E8F5E9" }}
                          >
                            <Text className="text-xs font-bold" style={{ color: Colors.success }}>
                              + Qty
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          onPress={() => openAdd(delivery)}
                          disabled={busy}
                          className="px-3 py-2 rounded-xl border"
                          style={{ borderColor: Colors.primary }}
                        >
                          <Text className="text-xs font-bold" style={{ color: Colors.primary }}>
                            + Delivery
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: "/order/[id]",
                              params: { id: delivery.subscription_id, focusDate: delivery.date },
                            } as any)
                          }
                          className="px-3 py-2 rounded-xl bg-slate-100"
                        >
                          <Text className="text-xs font-bold text-textSecondary">Open</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!qtyTarget} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-lg font-bold text-textPrimary mb-1">Increase quantity</Text>
            <Text className="text-sm text-textSecondary mb-4">
              {qtyTarget?.customer_name} · current {qtyTarget?.quantity || 1}
            </Text>
            <TextInput
              value={qtyValue}
              onChangeText={setQtyValue}
              keyboardType="number-pad"
              className="border border-slate-200 rounded-xl px-4 py-3 text-base mb-4"
              placeholder="New quantity"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setQtyTarget(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
              >
                <Text className="font-bold text-textSecondary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmQty}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: Colors.success }}
              >
                <Text className="font-bold text-white">Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!addTarget} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-lg font-bold text-textPrimary mb-1">Add delivery</Text>
            <Text className="text-sm text-textSecondary mb-4">
              For {addTarget?.customer_name}
            </Text>

            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setAddAtEnd(true)}
                className="flex-1 py-2.5 rounded-xl border items-center"
                style={{
                  borderColor: addAtEnd ? Colors.primary : "#E5E7EB",
                  backgroundColor: addAtEnd ? Colors.primary + "15" : "#FFF",
                }}
              >
                <Text className="text-xs font-bold" style={{ color: addAtEnd ? Colors.primary : "#6B7280" }}>
                  At plan end
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddAtEnd(false)}
                className="flex-1 py-2.5 rounded-xl border items-center"
                style={{
                  borderColor: !addAtEnd ? Colors.primary : "#E5E7EB",
                  backgroundColor: !addAtEnd ? Colors.primary + "15" : "#FFF",
                }}
              >
                <Text className="text-xs font-bold" style={{ color: !addAtEnd ? Colors.primary : "#6B7280" }}>
                  Specific date
                </Text>
              </TouchableOpacity>
            </View>

            {!addAtEnd ? (
              <TextInput
                value={addDate}
                onChangeText={setAddDate}
                placeholder="YYYY-MM-DD"
                className="border border-slate-200 rounded-xl px-4 py-3 text-base mb-3"
                autoCapitalize="none"
              />
            ) : null}

            <View className="flex-row flex-wrap gap-2 mb-3">
              {Object.keys(SLOT_META).map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => setAddSlot(slot)}
                  className="px-3 py-2 rounded-xl border"
                  style={{
                    borderColor: addSlot === slot ? Colors.primary : "#E5E7EB",
                    backgroundColor: addSlot === slot ? Colors.primary + "15" : "#FFF",
                  }}
                >
                  <Text
                    className="text-xs font-bold capitalize"
                    style={{ color: addSlot === slot ? Colors.primary : "#6B7280" }}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={addQty}
              onChangeText={setAddQty}
              keyboardType="number-pad"
              placeholder="Quantity"
              className="border border-slate-200 rounded-xl px-4 py-3 text-base mb-4"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setAddTarget(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
              >
                <Text className="font-bold text-textSecondary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmAdd}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: Colors.primary }}
              >
                <Text className="font-bold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
