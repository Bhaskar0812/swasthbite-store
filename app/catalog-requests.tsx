import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { getImagePicker } from "utils/imagePicker";

type TabKey = "new" | "mine";
type FormTab = "basic" | "details" | "nutrition";

type CatalogRequest = {
  _id: string;
  subject_name?: string;
  status?: string;
  createdAt?: string;
  rejected_reason?: string;
  review_note?: string;
  payload?: Record<string, any>;
};

const MEAL_TYPES = [
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-Veg" },
  { value: "vegan", label: "Vegan" },
] as const;

const SLOT_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "lunch", label: "Lunch" },
  { value: "evening", label: "Evening" },
  { value: "dinner", label: "Dinner" },
] as const;

const BULK_UNITS = ["plate", "bowl", "pack", "piece", "tray", "kg"];

const emptyForm = {
  name: "",
  description: "",
  image: "",
  base_price: "",
  original_price: "",
  categories: [] as string[],
  meal_type: "veg",
  slots: ["lunch"] as string[],
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  serving_size: "",
  preparation_time: "",
  ingredients: "",
  allergens: "",
  tags: "",
  bulk_serving_unit: "plate",
  bulk_serving_capacity: "1",
  is_available: true,
};

const statusStyle = (status?: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { bg: "#DCFCE7", color: "#166534", label: "Approved" };
  if (s === "rejected") return { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" };
  return { bg: "#FEF3C7", color: "#92400E", label: "Pending" };
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
    <Text className="text-sm font-bold" style={{ color: selected ? "#fff" : "#475569" }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <View className="mb-4">
    <Text className="text-sm font-bold text-textSecondary mb-1.5">{label}</Text>
    {children}
  </View>
);

const inputClass =
  "bg-white border border-border rounded-xl px-4 py-3 text-base text-textPrimary";

export default function CatalogRequestsScreen() {
  const [tab, setTab] = useState<TabKey>("new");
  const [formTab, setFormTab] = useState<FormTab>("basic");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await storeService.getCatalogRequests({ entity_type: "menu_item" });
      setRequests(res?.data || []);
    } catch {
      Toast.show({ type: "error", text1: "Could not load requests", position: "top" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await storeService.getCategories();
      const list =
        res?.data?.categories ||
        res?.categories ||
        res?.data ||
        [];
      setCategories(Array.isArray(list) ? list : []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (tab === "mine") fetchRequests();
  }, [tab, fetchRequests]);

  const toggleSlot = (slot: string) => {
    setForm((prev) => {
      const has = prev.slots.includes(slot);
      const next = has
        ? prev.slots.filter((s) => s !== slot)
        : [...prev.slots, slot];
      return { ...prev, slots: next.length ? next : prev.slots };
    });
  };

  const toggleCategory = (id: string) => {
    setForm((prev) => {
      const has = prev.categories.includes(id);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => c !== id)
          : [...prev.categories, id],
      };
    });
  };

  const uploadFromUri = async (uri: string, name?: string) => {
    try {
      setUploading(true);
      const res = await storeService.uploadImage(uri, name || `catalog-${Date.now()}.jpg`);
      const url = res?.url || res?.data?.url;
      if (!url) throw new Error("No URL returned");
      setForm((p) => ({ ...p, image: url }));
      Toast.show({ type: "success", text1: "Image uploaded", position: "top" });
    } catch (err: any) {
      Alert.alert(
        "Upload failed",
        err?.response?.data?.message || err?.message || "Could not upload image",
      );
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        "Update required",
        "Photo picker needs a newer app install. You can paste an image URL below for now.",
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to pick an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 2],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadFromUri(result.assets[0].uri, result.assets[0].fileName || undefined);
    } catch (err: any) {
      Alert.alert(
        "Could not open photos",
        err?.message || "Photo library is unavailable on this app build.",
      );
    }
  };

  const captureFromCamera = async () => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        "Update required",
        "Camera needs a newer app install. You can paste an image URL below for now.",
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow camera access to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 2],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadFromUri(result.assets[0].uri, `camera-${Date.now()}.jpg`);
    } catch (err: any) {
      Alert.alert(
        "Could not open camera",
        err?.message || "Camera is unavailable on this app build.",
      );
    }
  };

  const chooseImageSource = () => {
    Alert.alert("Item image", "Choose how to add a photo", [
      { text: "Camera", onPress: () => captureFromCamera() },
      { text: "Photo library", onPress: () => pickFromLibrary() },
      form.image
        ? {
            text: "Remove image",
            style: "destructive",
            onPress: () => setForm((p) => ({ ...p, image: "" })),
          }
        : undefined,
      { text: "Cancel", style: "cancel" },
    ].filter(Boolean) as any);
  };

  const submit = async () => {
    const name = form.name.trim();
    const basePrice = Number(form.base_price);
    if (!name) return Alert.alert("Name required", "Enter the menu item name.");
    if (!(basePrice > 0)) return Alert.alert("Price required", "Enter a valid selling price.");
    if (!form.slots.length) return Alert.alert("Slot required", "Select at least one slot.");

    const splitList = (value: string) =>
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      setSaving(true);
      const slot =
        form.slots.length === 1 ? form.slots[0] : "both";
      await storeService.submitMenuItemCatalogRequest({
        name,
        description: form.description.trim(),
        image: form.image || undefined,
        price: basePrice,
        base_price: basePrice,
        original_price: Number(form.original_price) || 0,
        categories: form.categories,
        meal_type: form.meal_type,
        slot,
        slots: form.slots,
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        fiber: Number(form.fiber) || 0,
        serving_size: form.serving_size.trim(),
        preparation_time: form.preparation_time.trim(),
        ingredients: splitList(form.ingredients),
        allergens: splitList(form.allergens),
        tags: splitList(form.tags),
        bulk_serving_unit: form.bulk_serving_unit || "plate",
        bulk_serving_capacity: Math.max(1, Number(form.bulk_serving_capacity) || 1),
        is_available: true,
      });
      setForm(emptyForm);
      setFormTab("basic");
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

  const discountPreview = useMemo(() => {
    const mrp = Number(form.original_price) || 0;
    const price = Number(form.base_price) || 0;
    if (!(mrp > price && mrp > 0)) return null;
    return Math.round(((mrp - price) / mrp) * 100);
  }, [form.base_price, form.original_price]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-2 pb-3 flex-row items-center border-b border-border bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-1">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-textPrimary">Catalog Request</Text>
          <Text className="text-sm text-textSecondary">Same fields as web — for super admin approval</Text>
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
          <View className="flex-row mx-4 mb-2">
            {(
              [
                { key: "basic" as const, label: "Basic" },
                { key: "details" as const, label: "Details" },
                { key: "nutrition" as const, label: "Nutrition" },
              ] as const
            ).map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setFormTab(t.key)}
                className="mr-2 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: formTab === t.key ? "#DBEAFE" : "#F8FAFC",
                  borderWidth: 1,
                  borderColor: formTab === t.key ? "#1D4ED8" : "#E2E8F0",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: formTab === t.key ? "#1D4ED8" : "#64748B" }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {formTab === "basic" ? (
              <>
                <Field label="Item name *">
                  <TextInput
                    className={inputClass}
                    placeholder="e.g. Paneer Tikka Bowl"
                    placeholderTextColor={Colors.textTertiary}
                    value={form.name}
                    onChangeText={(name) => setForm((p) => ({ ...p, name }))}
                  />
                </Field>

                <Field label="Description">
                  <TextInput
                    className={inputClass}
                    placeholder="Describe the item..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    style={{ minHeight: 80 }}
                    textAlignVertical="top"
                    value={form.description}
                    onChangeText={(description) => setForm((p) => ({ ...p, description }))}
                  />
                </Field>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-textSecondary mb-1.5">Price (₹) *</Text>
                    <TextInput
                      className={inputClass}
                      keyboardType="decimal-pad"
                      placeholder="149"
                      placeholderTextColor={Colors.textTertiary}
                      value={form.base_price}
                      onChangeText={(base_price) => setForm((p) => ({ ...p, base_price }))}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-textSecondary mb-1.5">MRP (₹)</Text>
                    <TextInput
                      className={inputClass}
                      keyboardType="decimal-pad"
                      placeholder="199"
                      placeholderTextColor={Colors.textTertiary}
                      value={form.original_price}
                      onChangeText={(original_price) =>
                        setForm((p) => ({ ...p, original_price }))
                      }
                    />
                  </View>
                </View>
                {discountPreview != null ? (
                  <Text className="text-sm font-bold text-green-700 mb-3">
                    {discountPreview}% OFF vs MRP
                  </Text>
                ) : null}

                <Field label="Image">
                  <TouchableOpacity
                    onPress={chooseImageSource}
                    disabled={uploading}
                    className="rounded-2xl border border-dashed border-border bg-white items-center justify-center overflow-hidden"
                    style={{ minHeight: 160 }}
                  >
                    {uploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : form.image ? (
                      <Image
                        source={{ uri: form.image }}
                        style={{ width: "100%", height: 180 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center py-8">
                        <Ionicons name="camera-outline" size={32} color={Colors.textTertiary} />
                        <Text className="text-sm font-semibold text-textSecondary mt-2">
                          Camera or photo library
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TextInput
                    className={`${inputClass} mt-3`}
                    placeholder="Or paste image URL"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={form.image}
                    onChangeText={(image) => setForm((p) => ({ ...p, image }))}
                  />
                </Field>

                <Field label="Meal type">
                  <View className="flex-row flex-wrap">
                    {MEAL_TYPES.map((m) => (
                      <Chip
                        key={m.value}
                        label={m.label}
                        selected={form.meal_type === m.value}
                        onPress={() => setForm((p) => ({ ...p, meal_type: m.value }))}
                      />
                    ))}
                  </View>
                </Field>

                <Field label="Slots (select one or more) *">
                  <View className="flex-row flex-wrap">
                    {SLOT_OPTIONS.map((s) => (
                      <Chip
                        key={s.value}
                        label={s.label}
                        selected={form.slots.includes(s.value)}
                        onPress={() => toggleSlot(s.value)}
                      />
                    ))}
                  </View>
                </Field>

                {categories.length > 0 ? (
                  <Field label="Categories">
                    <View className="flex-row flex-wrap">
                      {categories.map((c) => (
                        <Chip
                          key={c._id}
                          label={c.name}
                          selected={form.categories.includes(c._id)}
                          onPress={() => toggleCategory(c._id)}
                        />
                      ))}
                    </View>
                  </Field>
                ) : null}

                <View className="flex-row gap-3 mb-2">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-textSecondary mb-1.5">
                      Bulk unit
                    </Text>
                    <View className="flex-row flex-wrap">
                      {BULK_UNITS.map((u) => (
                        <Chip
                          key={u}
                          label={u}
                          selected={form.bulk_serving_unit === u}
                          onPress={() =>
                            setForm((p) => ({ ...p, bulk_serving_unit: u }))
                          }
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Field label="Bulk serving capacity">
                  <TextInput
                    className={inputClass}
                    keyboardType="number-pad"
                    value={form.bulk_serving_capacity}
                    onChangeText={(bulk_serving_capacity) =>
                      setForm((p) => ({ ...p, bulk_serving_capacity }))
                    }
                  />
                </Field>
              </>
            ) : null}

            {formTab === "details" ? (
              <>
                <Field label="Ingredients (comma separated)">
                  <TextInput
                    className={inputClass}
                    placeholder="Paneer, Bell Pepper, Spices"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    style={{ minHeight: 72 }}
                    textAlignVertical="top"
                    value={form.ingredients}
                    onChangeText={(ingredients) => setForm((p) => ({ ...p, ingredients }))}
                  />
                </Field>
                <Field label="Allergens (comma separated)">
                  <TextInput
                    className={inputClass}
                    placeholder="Dairy, Nuts, Gluten"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    style={{ minHeight: 72 }}
                    textAlignVertical="top"
                    value={form.allergens}
                    onChangeText={(allergens) => setForm((p) => ({ ...p, allergens }))}
                  />
                </Field>
                <Field label="Tags (comma separated)">
                  <TextInput
                    className={inputClass}
                    placeholder="Spicy, High Protein, Bestseller"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    style={{ minHeight: 72 }}
                    textAlignVertical="top"
                    value={form.tags}
                    onChangeText={(tags) => setForm((p) => ({ ...p, tags }))}
                  />
                </Field>
                <Field label="Preparation time">
                  <TextInput
                    className={inputClass}
                    placeholder="e.g. 20-25 mins"
                    placeholderTextColor={Colors.textTertiary}
                    value={form.preparation_time}
                    onChangeText={(preparation_time) =>
                      setForm((p) => ({ ...p, preparation_time }))
                    }
                  />
                </Field>
                <Field label="Serving size">
                  <TextInput
                    className={inputClass}
                    placeholder="e.g. 250g / 1 bowl"
                    placeholderTextColor={Colors.textTertiary}
                    value={form.serving_size}
                    onChangeText={(serving_size) =>
                      setForm((p) => ({ ...p, serving_size }))
                    }
                  />
                </Field>
              </>
            ) : null}

            {formTab === "nutrition" ? (
              <>
                {(
                  [
                    ["calories", "Calories"],
                    ["protein", "Protein (g)"],
                    ["carbs", "Carbs (g)"],
                    ["fat", "Fat (g)"],
                    ["fiber", "Fiber (g)"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <TextInput
                      className={inputClass}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                      value={form[key]}
                      onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
                    />
                  </Field>
                ))}
              </>
            ) : null}

            <TouchableOpacity
              onPress={submit}
              disabled={saving || uploading}
              className="rounded-2xl py-4 items-center mt-2"
              style={{
                backgroundColor: Colors.primary,
                opacity: saving || uploading ? 0.7 : 1,
              }}
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
                <Text className="text-base text-slate-500 mt-3">No catalog requests yet</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const st = statusStyle(item.status);
            const slots =
              Array.isArray(item.payload?.slots) && item.payload.slots.length
                ? item.payload.slots.join(", ")
                : item.payload?.slot || "";
            const dateLabel = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "";
            return (
              <View className="bg-white rounded-2xl p-4 mb-3 border border-border">
                <View className="flex-row items-start justify-between mb-1">
                  <Text className="text-lg font-extrabold text-textPrimary flex-1 pr-2">
                    {item.subject_name || item.payload?.name || "Item"}
                  </Text>
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: st.bg }}>
                    <Text className="text-xs font-bold" style={{ color: st.color }}>
                      {st.label}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-textSecondary">
                  {[
                    item.payload?.meal_type,
                    slots,
                    item.payload?.price != null || item.payload?.base_price != null
                      ? `₹${item.payload?.price ?? item.payload?.base_price}`
                      : null,
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
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
