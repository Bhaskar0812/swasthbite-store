import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { Colors } from "constants/theme";
import { storeService } from "services/storeService";

type TabKey = "new" | "mine";

type CatalogRequest = {
  _id: string;
  subject_name?: string;
  status?: string;
  entity_type?: string;
  createdAt?: string;
  rejected_reason?: string;
  review_note?: string;
  payload?: {
    name?: string;
    price?: number;
    meal_type?: string;
    slot?: string;
    description?: string;
  };
};

const MEAL_TYPES = [
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-Veg" },
  { value: "vegan", label: "Vegan" },
] as const;

const SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "lunch", label: "Lunch" },
  { value: "evening", label: "Evening" },
  { value: "dinner", label: "Dinner" },
  { value: "both", label: "Both" },
] as const;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  meal_type: "veg",
  slot: "lunch",
  image: "",
};

const statusStyle = (status?: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { bg: "#DCFCE7", color: "#166534", label: "Approved" };
  if (s === "rejected") return { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" };
  return { bg: "#FEF3C7", color: "#92400E", label: "Pending" };
};

export default function CatalogRequestsScreen() {
  const [tab, setTab] = useState<TabKey>("new");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await storeService.getCatalogRequests({ entity_type: "menu_item" });
      setRequests(res?.data || []);
    } catch {
      Toast.show({
        type: "error",
        text1: "Could not load requests",
        position: "top",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "mine") fetchRequests();
  }, [tab, fetchRequests]);

  const submit = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) {
      Alert.alert("Name required", "Enter the menu item name.");
      return;
    }
    if (!(price > 0)) {
      Alert.alert("Price required", "Enter a valid price greater than 0.");
      return;
    }

    try {
      setSaving(true);
      await storeService.submitMenuItemCatalogRequest({
        name,
        description: form.description.trim(),
        price,
        base_price: price,
        meal_type: form.meal_type,
        slot: form.slot,
        image: form.image.trim() || undefined,
        is_available: true,
      });
      setForm(emptyForm);
      Toast.show({
        type: "success",
        text1: "Submitted",
        text2: "Super admin will review your catalog request",
        position: "top",
      });
      setTab("mine");
      fetchRequests();
    } catch (err: any) {
      Alert.alert(
        "Submit failed",
        err?.response?.data?.message || "Could not submit catalog request",
      );
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({
    selected,
    label,
    onPress,
  }: {
    selected: boolean;
    label: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="px-3 py-2 rounded-full mr-2 mb-2"
      style={{
        backgroundColor: selected ? Colors.primary : "#F1F5F9",
        borderWidth: 1,
        borderColor: selected ? Colors.primary : "#E2E8F0",
      }}
    >
      <Text
        className="text-sm font-bold"
        style={{ color: selected ? "#fff" : "#475569" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-2 pb-3 flex-row items-center border-b border-border bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-1">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-textPrimary">Catalog Request</Text>
          <Text className="text-sm text-textSecondary">
            Request a new menu item for super admin approval
          </Text>
        </View>
      </View>

      <View className="flex-row mx-4 mt-4 mb-2 bg-white rounded-xl p-1 border border-border">
        {(
          [
            { key: "new" as const, label: "New request" },
            { key: "mine" as const, label: "My requests" },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-lg items-center"
            style={tab === t.key ? { backgroundColor: Colors.primary } : {}}
          >
            <Text
              className="text-sm font-bold"
              style={{ color: tab === t.key ? "#fff" : Colors.textSecondary }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "new" ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-sm font-bold text-textSecondary mb-1.5">Item name *</Text>
            <TextInput
              className="bg-white border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-4"
              placeholder="e.g. Paneer Butter Masala"
              placeholderTextColor={Colors.textTertiary}
              value={form.name}
              onChangeText={(name) => setForm((p) => ({ ...p, name }))}
            />

            <Text className="text-sm font-bold text-textSecondary mb-1.5">Price (₹) *</Text>
            <TextInput
              className="bg-white border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-4"
              placeholder="149"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              value={form.price}
              onChangeText={(price) => setForm((p) => ({ ...p, price }))}
            />

            <Text className="text-sm font-bold text-textSecondary mb-1.5">Meal type</Text>
            <View className="flex-row flex-wrap mb-3">
              {MEAL_TYPES.map((m) => (
                <Chip
                  key={m.value}
                  label={m.label}
                  selected={form.meal_type === m.value}
                  onPress={() => setForm((p) => ({ ...p, meal_type: m.value }))}
                />
              ))}
            </View>

            <Text className="text-sm font-bold text-textSecondary mb-1.5">Slot</Text>
            <View className="flex-row flex-wrap mb-3">
              {SLOTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={form.slot === s.value}
                  onPress={() => setForm((p) => ({ ...p, slot: s.value }))}
                />
              ))}
            </View>

            <Text className="text-sm font-bold text-textSecondary mb-1.5">Description</Text>
            <TextInput
              className="bg-white border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-4"
              placeholder="Short description for kitchen / customer"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 88 }}
              value={form.description}
              onChangeText={(description) => setForm((p) => ({ ...p, description }))}
            />

            <Text className="text-sm font-bold text-textSecondary mb-1.5">
              Image URL (optional)
            </Text>
            <TextInput
              className="bg-white border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-6"
              placeholder="https://…"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              value={form.image}
              onChangeText={(image) => setForm((p) => ({ ...p, image }))}
            />

            <TouchableOpacity
              onPress={submit}
              disabled={saving}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-extrabold text-white">
                  Submit for approval
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchRequests}
              colors={[Colors.primary]}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={
            !loading ? (
              <View className="py-16 items-center">
                <Ionicons name="document-text-outline" size={40} color="#94A3B8" />
                <Text className="text-base text-slate-500 mt-3 text-center">
                  No catalog requests yet
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const st = statusStyle(item.status);
            const dateLabel = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "";
            return (
              <View
                className="bg-white rounded-2xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-start justify-between mb-1">
                  <Text className="text-lg font-extrabold text-textPrimary flex-1 pr-2">
                    {item.subject_name || item.payload?.name || "Item"}
                  </Text>
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: st.bg }}
                  >
                    <Text className="text-xs font-bold" style={{ color: st.color }}>
                      {st.label}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-textSecondary">
                  {[
                    item.payload?.meal_type,
                    item.payload?.slot,
                    item.payload?.price != null ? `₹${item.payload.price}` : null,
                    dateLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {item.status === "rejected" && item.rejected_reason ? (
                  <Text className="text-sm text-red-700 mt-2">
                    Reason: {item.rejected_reason}
                  </Text>
                ) : null}
                {item.review_note ? (
                  <Text className="text-sm text-slate-500 mt-1">Note: {item.review_note}</Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
