import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Toast from "react-native-toast-message";
import { Colors } from "constants/theme";
import { storeService } from "services/storeService";
import { useStoreStore } from "store/storeStore";

type OrderType = "one_time" | "subscription";
type PlanType = "weekly" | "monthly" | "quarterly";

type UserResult = {
  _id: string;
  name: string;
  email?: string;
  phone_number?: string;
};

type AddressResult = {
  _id: string;
  label?: string;
  address?: string;
  city?: string;
  pincode?: string;
  serviceable?: boolean;
};

type CartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
};

const SLOTS = ["morning", "lunch", "evening", "dinner"] as const;

const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export default function PunchOrderScreen() {
  const { menuItems, packages, menuItemIds, fetchMenuItems, fetchPackages, fetchMenuStatus } =
    useStoreStore();

  const [orderType, setOrderType] = useState<OrderType>("one_time");
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
    state: "Haryana",
  });

  const [addresses, setAddresses] = useState<AddressResult[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [packingCharge, setPackingCharge] = useState(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [menuQty, setMenuQty] = useState("1");
  const [deliveryDate, setDeliveryDate] = useState(toDateInput(new Date()));
  const [deliverySlot, setDeliverySlot] = useState<string>("lunch");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [packageQty, setPackageQty] = useState("1");
  const [planType, setPlanType] = useState<PlanType>("monthly");
  const [mealSlots, setMealSlots] = useState<string[]>(["lunch"]);
  const [startDate, setStartDate] = useState(toDateInput(new Date()));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMenuItems();
    fetchPackages();
    fetchMenuStatus();
  }, []);

  const storeMenuItems = useMemo(() => {
    const allowed = new Set((menuItemIds || []).map(String));
    const source = menuItems || [];
    if (!allowed.size) return source;
    return source.filter((item: any) => allowed.has(String(item._id)));
  }, [menuItems, menuItemIds]);

  const storePackages = useMemo(() => {
    const source = packages || [];
    const selected = source.filter((pkg: any) => pkg.store_selected);
    return selected.length ? selected : source;
  }, [packages]);

  const selectedPackage = useMemo(
    () => storePackages.find((p: any) => String(p._id) === selectedPackageId) || null,
    [storePackages, selectedPackageId],
  );

  const searchUsers = useCallback(async (q: string) => {
    setUserQuery(q);
    if (q.trim().length < 2) {
      setUsers([]);
      return;
    }
    try {
      setSearchingUsers(true);
      const res = await storeService.searchManualOrderUsers(q.trim(), 40);
      setUsers(res?.data || res || []);
    } catch {
      setUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  const loadAddresses = async (userId: string) => {
    try {
      const res = await storeService.getManualOrderUserAddresses(userId);
      const list = res?.data || res || [];
      setAddresses(list);
      const def = list.find((a: AddressResult) => a.serviceable !== false) || list[0];
      setSelectedAddressId(def?._id || "");
      if (def?._id) {
        const charges = await storeService.getManualOrderCharges(def._id);
        setPackingCharge(Number(charges?.data?.packing_charge || charges?.packing_charge || 0));
      }
    } catch {
      setAddresses([]);
    }
  };

  const selectUser = async (user: UserResult) => {
    setSelectedUser(user);
    setShowNewUser(false);
    setUsers([]);
    setUserQuery(user.name || user.phone_number || "");
    await loadAddresses(user._id);
  };

  const addToCart = () => {
    const item = storeMenuItems.find((m: any) => String(m._id) === selectedMenuItemId);
    const qty = Math.max(1, Number(menuQty) || 1);
    if (!item) return Alert.alert("Select item", "Pick a menu item first.");
    const price = Number(item.store_price || item.base_price || item.price || 0);
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item._id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item._id
            ? { ...c, quantity: c.quantity + qty }
            : c,
        );
      }
      return [
        ...prev,
        {
          menu_item_id: String(item._id),
          name: item.name,
          price,
          quantity: qty,
        },
      ];
    });
    setMenuQty("1");
  };

  const planConfig = useMemo(() => {
    if (!selectedPackage) return { days: 30, price: 0 };
    const qty = Math.max(1, Number(packageQty) || 1);
    const dual = mealSlots.length > 1;
    if (planType === "weekly") {
      return {
        days: Number(
          dual
            ? selectedPackage.weekly_dual_slot_days || selectedPackage.weekly_days || 6
            : selectedPackage.weekly_days || 6,
        ),
        price:
          Number(
            dual
              ? selectedPackage.weekly_dual_slot_price ||
                  selectedPackage.dual_slot_price ||
                  selectedPackage.weekly_price ||
                  selectedPackage.price ||
                  0
              : selectedPackage.weekly_price || selectedPackage.price || 0,
          ) * qty,
      };
    }
    if (planType === "quarterly") {
      return {
        days: Number(
          dual
            ? selectedPackage.quarterly_dual_slot_days ||
                selectedPackage.quarterly_days ||
                90
            : selectedPackage.quarterly_days || 90,
        ),
        price:
          Number(
            dual
              ? selectedPackage.quarterly_dual_slot_price ||
                  selectedPackage.dual_slot_price ||
                  selectedPackage.quarterly_price ||
                  selectedPackage.price ||
                  0
              : selectedPackage.quarterly_price || selectedPackage.price || 0,
          ) * qty,
      };
    }
    return {
      days: Number(
        dual
          ? selectedPackage.monthly_dual_slot_days || selectedPackage.monthly_days || 26
          : selectedPackage.monthly_days || 26,
      ),
      price:
        Number(
          dual
            ? selectedPackage.monthly_dual_slot_price ||
                selectedPackage.dual_slot_price ||
                selectedPackage.monthly_price ||
                selectedPackage.price ||
                0
            : selectedPackage.monthly_price || selectedPackage.price || 0,
        ) * qty,
    };
  }, [selectedPackage, planType, mealSlots.length, packageQty]);

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const oneTimeTotal = cartTotal + 20 + packingCharge;

  const toggleMealSlot = (slot: string) => {
    setMealSlots((prev) => {
      const has = prev.includes(slot);
      const next = has ? prev.filter((s) => s !== slot) : [...prev, slot];
      return next.length ? next.slice(0, 2) : prev;
    });
  };

  const submit = async () => {
    const payload: any = { order_type: orderType, notes: notes.trim() || undefined };

    if (showNewUser) {
      if (!newUser.name || !newUser.phone || !newUser.email) {
        return Alert.alert("Missing fields", "Name, phone and email are required for new user.");
      }
      if (!newUser.pincode) {
        return Alert.alert("Pincode required", "Enter delivery pincode.");
      }
      payload.user_phone = newUser.phone;
      payload.new_user = {
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        address: {
          label: "Work",
          address: newUser.address,
          city: newUser.city,
          pincode: newUser.pincode,
          state: newUser.state,
        },
      };
    } else if (selectedUser) {
      if (!selectedAddressId) {
        return Alert.alert("Address required", "Select a delivery address.");
      }
      payload.delivery_address_id = selectedAddressId;
      if (selectedUser.phone_number) payload.user_phone = selectedUser.phone_number;
      else payload.user_email = selectedUser.email;
    } else {
      return Alert.alert("Customer required", "Select or create a customer.");
    }

    if (orderType === "one_time") {
      if (!cart.length) return Alert.alert("Add items", "Add at least one menu item.");
      payload.items = cart.map((c) => ({
        menu_item_id: c.menu_item_id,
        quantity: c.quantity,
      }));
      payload.delivery_date = deliveryDate || undefined;
      payload.delivery_slot = deliverySlot;
    } else {
      if (!selectedPackageId) return Alert.alert("Package required", "Select a package.");
      if (!mealSlots.length) return Alert.alert("Slots required", "Select at least one meal slot.");
      const activeDays = [1, 2, 3, 4, 5, 6];
      payload.package_id = selectedPackageId;
      payload.package_quantity = Math.max(1, Number(packageQty) || 1);
      payload.duration_type = planType;
      payload.schedule_type = "custom";
      payload.active_days = activeDays;
      payload.meal_slots = mealSlots;
      payload.selected_meal_slots = mealSlots;
      payload.slot_schedule = mealSlots.map((slot) => ({
        slot,
        active_days: [...activeDays],
      }));
      payload.start_date = startDate || undefined;
    }

    try {
      setSubmitting(true);
      const res = await storeService.punchManualOrder(payload);
      const msg = res?.message || "Order punched successfully";
      Toast.show({ type: "success", text1: "Order punched", text2: msg, position: "top" });
      Alert.alert("Success", msg, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Punch failed",
        err?.response?.data?.message || "Could not punch order",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-2 pb-3 flex-row items-center border-b border-border bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-1">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-textPrimary">Punch Order</Text>
          <Text className="text-sm text-textSecondary">
            Same as web — create one-time or subscription orders
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm font-bold text-textSecondary mb-2">Order type</Text>
          <View className="flex-row mb-4">
            <Chip
              label="One-time"
              selected={orderType === "one_time"}
              onPress={() => setOrderType("one_time")}
            />
            <Chip
              label="Subscription"
              selected={orderType === "subscription"}
              onPress={() => setOrderType("subscription")}
            />
          </View>

          <Text className="text-base font-extrabold text-textPrimary mb-2">1. Customer</Text>
          {!showNewUser ? (
            <>
              <TextInput
                className="bg-white border border-border rounded-xl px-4 py-3 text-base mb-2"
                placeholder="Search name / phone / email"
                placeholderTextColor={Colors.textTertiary}
                value={userQuery}
                onChangeText={searchUsers}
              />
              {searchingUsers ? <ActivityIndicator color={Colors.primary} /> : null}
              {!selectedUser && users.length > 0 ? (
                <View className="bg-white border border-border rounded-xl mb-3 max-h-48">
                  <FlatList
                    data={users}
                    keyExtractor={(u) => u._id}
                    nestedScrollEnabled
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => selectUser(item)}
                        className="px-4 py-3 border-b border-border"
                      >
                        <Text className="text-base font-bold text-textPrimary">{item.name}</Text>
                        <Text className="text-sm text-textSecondary">
                          {item.phone_number || item.email}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : null}
              {selectedUser ? (
                <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                  <Text className="text-base font-bold text-emerald-900">{selectedUser.name}</Text>
                  <Text className="text-sm text-emerald-800">
                    {selectedUser.phone_number || selectedUser.email}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedUser(null);
                      setAddresses([]);
                      setSelectedAddressId("");
                    }}
                    className="mt-2"
                  >
                    <Text className="text-sm font-bold text-red-600">Change customer</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity onPress={() => setShowNewUser(true)} className="mb-4">
                <Text className="text-sm font-bold" style={{ color: Colors.primary }}>
                  + Create new customer
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View className="mb-4">
              {(
                [
                  ["name", "Name *"],
                  ["phone", "Phone *"],
                  ["email", "Email *"],
                  ["address", "Address"],
                  ["city", "City"],
                  ["pincode", "Pincode *"],
                  ["state", "State"],
                ] as const
              ).map(([key, label]) => (
                <View key={key} className="mb-2">
                  <Text className="text-xs font-bold text-textSecondary mb-1">{label}</Text>
                  <TextInput
                    className="bg-white border border-border rounded-xl px-3 py-2.5 text-base"
                    value={(newUser as any)[key]}
                    keyboardType={
                      key === "phone" || key === "pincode" ? "phone-pad" : "default"
                    }
                    autoCapitalize={key === "email" ? "none" : "words"}
                    onChangeText={(v) => setNewUser((p) => ({ ...p, [key]: v }))}
                  />
                </View>
              ))}
              <TouchableOpacity onPress={() => setShowNewUser(false)}>
                <Text className="text-sm font-bold text-textSecondary">
                  Back to search existing customer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedUser && addresses.length > 0 ? (
            <View className="mb-4">
              <Text className="text-sm font-bold text-textSecondary mb-2">Delivery address</Text>
              {addresses.map((a) => (
                <TouchableOpacity
                  key={a._id}
                  onPress={async () => {
                    setSelectedAddressId(a._id);
                    try {
                      const charges = await storeService.getManualOrderCharges(a._id);
                      setPackingCharge(
                        Number(charges?.data?.packing_charge || charges?.packing_charge || 0),
                      );
                    } catch {
                      setPackingCharge(0);
                    }
                  }}
                  className="rounded-xl p-3 mb-2 border"
                  style={{
                    borderColor: selectedAddressId === a._id ? Colors.primary : "#E2E8F0",
                    backgroundColor: selectedAddressId === a._id ? "#EFF6FF" : "#fff",
                  }}
                >
                  <Text className="text-sm font-bold text-textPrimary">
                    {a.label || "Address"} · {a.pincode}
                  </Text>
                  <Text className="text-sm text-textSecondary">
                    {[a.address, a.city].filter(Boolean).join(", ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {orderType === "one_time" ? (
            <View className="mb-4">
              <Text className="text-base font-extrabold text-textPrimary mb-2">2. Items</Text>
              <Text className="text-sm font-bold text-textSecondary mb-1">Menu item</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {storeMenuItems.map((item: any) => (
                  <Chip
                    key={item._id}
                    label={`${item.name} · ₹${item.store_price || item.base_price || item.price || 0}`}
                    selected={selectedMenuItemId === String(item._id)}
                    onPress={() => setSelectedMenuItemId(String(item._id))}
                  />
                ))}
              </ScrollView>
              <View className="flex-row items-center mb-3">
                <TextInput
                  className="bg-white border border-border rounded-xl px-3 py-2.5 text-base w-20 mr-2"
                  keyboardType="number-pad"
                  value={menuQty}
                  onChangeText={setMenuQty}
                />
                <TouchableOpacity
                  onPress={addToCart}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ backgroundColor: Colors.primary }}
                >
                  <Text className="text-white font-bold">Add to cart</Text>
                </TouchableOpacity>
              </View>
              {cart.map((c) => (
                <View
                  key={c.menu_item_id}
                  className="flex-row items-center justify-between bg-white border border-border rounded-xl px-3 py-2.5 mb-2"
                >
                  <Text className="text-sm font-bold flex-1">
                    {c.name} ×{c.quantity}
                  </Text>
                  <Text className="text-sm font-bold mr-3">₹{c.price * c.quantity}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setCart((prev) => prev.filter((x) => x.menu_item_id !== c.menu_item_id))
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              <Text className="text-sm font-bold text-textSecondary mt-2 mb-1">Delivery date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white border border-border rounded-xl px-4 py-3 mb-3"
              >
                <Text className="text-base font-semibold">{deliveryDate}</Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker
                  value={new Date(deliveryDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    if (Platform.OS !== "ios") setShowDatePicker(false);
                    if (d) setDeliveryDate(toDateInput(d));
                  }}
                />
              ) : null}

              <Text className="text-sm font-bold text-textSecondary mb-1">Slot</Text>
              <View className="flex-row flex-wrap mb-2">
                {SLOTS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    selected={deliverySlot === s}
                    onPress={() => setDeliverySlot(s)}
                  />
                ))}
              </View>
              <Text className="text-base font-extrabold text-textPrimary mt-2">
                Total: ₹{oneTimeTotal}{" "}
                <Text className="text-sm font-normal text-textSecondary">
                  (items + ₹20 platform + ₹{packingCharge} packing)
                </Text>
              </Text>
            </View>
          ) : (
            <View className="mb-4">
              <Text className="text-base font-extrabold text-textPrimary mb-2">2. Package</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {storePackages.map((pkg: any) => (
                  <Chip
                    key={pkg._id}
                    label={pkg.name}
                    selected={selectedPackageId === String(pkg._id)}
                    onPress={() => setSelectedPackageId(String(pkg._id))}
                  />
                ))}
              </ScrollView>
              <Text className="text-sm font-bold text-textSecondary mb-1">Plan</Text>
              <View className="flex-row flex-wrap mb-2">
                {(["weekly", "monthly", "quarterly"] as PlanType[]).map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={planType === p}
                    onPress={() => setPlanType(p)}
                  />
                ))}
              </View>
              <Text className="text-sm font-bold text-textSecondary mb-1">
                Meal slots (max 2)
              </Text>
              <View className="flex-row flex-wrap mb-2">
                {SLOTS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    selected={mealSlots.includes(s)}
                    onPress={() => toggleMealSlot(s)}
                  />
                ))}
              </View>
              <Text className="text-sm font-bold text-textSecondary mb-1">Quantity</Text>
              <TextInput
                className="bg-white border border-border rounded-xl px-4 py-3 text-base mb-3 w-28"
                keyboardType="number-pad"
                value={packageQty}
                onChangeText={setPackageQty}
              />
              <Text className="text-sm font-bold text-textSecondary mb-1">Start date</Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                className="bg-white border border-border rounded-xl px-4 py-3 mb-3"
              >
                <Text className="text-base font-semibold">{startDate}</Text>
              </TouchableOpacity>
              {showStartPicker ? (
                <DateTimePicker
                  value={new Date(startDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    if (Platform.OS !== "ios") setShowStartPicker(false);
                    if (d) setStartDate(toDateInput(d));
                  }}
                />
              ) : null}
              <Text className="text-base font-extrabold text-textPrimary">
                Plan: {planConfig.days} days · ₹{planConfig.price}
              </Text>
            </View>
          )}

          <Text className="text-sm font-bold text-textSecondary mb-1">Notes</Text>
          <TextInput
            className="bg-white border border-border rounded-xl px-4 py-3 text-base mb-4"
            placeholder="Optional notes"
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: Colors.primary, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-extrabold text-white">Punch order</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
