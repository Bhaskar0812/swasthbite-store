import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import Toast from 'react-native-toast-message';
import type { Refund } from 'types';

export default function RefundsScreen() {
  const insets = useSafeAreaInsets();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundableOrders, setRefundableOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subscription_id: '', amount: '', reason: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, oRes] = await Promise.all([
        storeService.getRefunds(),
        storeService.getRefundableOrders(),
      ]);
      setRefunds(rRes.data || []);
      setRefundableOrders(oRes.data || []);
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const handleRefund = async () => {
    if (!form.subscription_id || !form.amount || !form.reason) {
      Toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    setSaving(true);
    try {
      await storeService.issueRefund({
        subscription_id: form.subscription_id,
        amount: Number(form.amount),
        reason: form.reason,
      });
      Toast.show({ type: 'success', text1: 'Refund issued' });
      setModalVisible(false);
      setForm({ subscription_id: '', amount: '', reason: '' });
      fetchData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (value: unknown) => {
    const num = Number(value);
    return `₹${Number.isFinite(num) ? num.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}`;
  };

  const getOrderCardData = (order: any) => {
    const customerName =
      order?.customer?.name ||
      order?.user?.name ||
      order?.customer_name ||
      order?.user_name ||
      order?.name ||
      'Customer';

    const orderTypeRaw = String(
      order?.order_type || order?.type || order?.source || order?.category || '',
    ).toLowerCase();
    const orderTypeLabel =
      orderTypeRaw === 'manual'
        ? 'Manual Order'
        : orderTypeRaw === 'bulk'
          ? 'Bulk Order'
          : 'Subscription Order';

    const deliveredMeals = Array.isArray(order?.delivered_dates)
      ? order.delivered_dates
        .map((d: any) => String(d?.meal_name || '').trim())
        .filter(Boolean)
      : [];

    const fromOrderItems = Array.isArray(order?.order_items)
      ? order.order_items
        .map((i: any) => String(i?.name || i?.meal_name || i?.title || '').trim())
        .filter(Boolean)
      : [];

    const primaryItemList =
      fromOrderItems.length > 0
        ? fromOrderItems
        : deliveredMeals.length > 0
          ? deliveredMeals
          : [
            order?.package_name,
            order?.meal_name,
            order?.item_name,
            order?.title,
          ].filter(Boolean);

    const uniqueItems = Array.from(new Set(primaryItemList.map((v: string) => v.trim()).filter(Boolean)));
    const itemSummary = uniqueItems.length > 0 ? uniqueItems.join(', ') : 'Order details unavailable';

    const amount =
      order?.max_refundable ??
      order?.total_amount ??
      order?.order_value ??
      order?.amount ??
      order?.per_delivery_value ??
      0;

    const dateValue = order?.created_at || order?.createdAt || order?.start_date || order?.date;
    const dateStr = dateValue
      ? new Date(dateValue).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      })
      : '';

    const orderId =
      String(
        order?._id ||
        order?.subscription_id ||
        order?.order_id ||
        order?.id ||
        '',
      ).trim() || '';

    return {
      customerName,
      subTitle: `${orderTypeLabel} - ${itemSummary}`,
      amount,
      dateStr,
      orderId,
    };
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Refunds</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-primary rounded-lg px-3 py-1.5"
        >
          <Text className="text-white text-xs font-semibold">+ Issue</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={refunds}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} colors={[Colors.primary]} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-sm font-semibold text-textPrimary">{item.customer?.name}</Text>
              <Text className="text-base font-bold text-error">₹{item.amount}</Text>
            </View>
            <Text className="text-xs text-textSecondary">{item.reason}</Text>
            <Text className="text-xs text-textTertiary mt-1">
              {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="return-down-back-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No refunds issued</Text>
          </View>
        }
      />

      {/* Issue Refund Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1 px-5"
            style={{
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-textPrimary">Issue Refund</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} bounces={true}>
              {refundableOrders.length > 0 && (
                <>
                  <Text className="text-xs font-medium text-textSecondary mb-2">Select Order</Text>
                  <View className="mb-4">
                    {refundableOrders.map((item) => {
                      const card = getOrderCardData(item as any);

                      return (
                        <TouchableOpacity
                          key={item._id}
                          onPress={() => setForm({ ...form, subscription_id: item._id })}
                          className="mb-2 p-3 rounded-lg border"
                          style={{
                            borderColor: form.subscription_id === item._id ? Colors.primary : Colors.border,
                            backgroundColor: form.subscription_id === item._id ? Colors.primary + '10' : '#fff',
                          }}
                        >
                          <View className="flex-row justify-between items-start">
                            <View className="flex-1 pr-2">
                              <Text className="text-sm font-semibold" style={{ color: form.subscription_id === item._id ? Colors.primary : Colors.textPrimary }}>
                                {card.customerName}
                              </Text>
                              <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={2}>{card.subTitle}</Text>
                              {card.orderId ? (
                                <Text className="text-[11px] mt-0.5" style={{ color: Colors.textSecondary }} numberOfLines={1}>
                                  Order ID: {card.orderId}
                                </Text>
                              ) : null}
                              <Text className="text-xs text-textTertiary mt-0.5">{formatAmount(card.amount)}</Text>
                            </View>
                            <Text className="text-[10px] text-textTertiary ml-2">{card.dateStr}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text className="text-xs font-medium text-textSecondary mb-1">Amount</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.amount} onChangeText={(t) => setForm({ ...form, amount: t })} placeholder="Refund amount" keyboardType="numeric" />

              <Text className="text-xs font-medium text-textSecondary mb-1">Reason</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-4" value={form.reason} onChangeText={(t) => setForm({ ...form, reason: t })} placeholder="Reason for refund" multiline numberOfLines={3} />
            </ScrollView>

            <TouchableOpacity onPress={handleRefund} disabled={saving} className="bg-primary rounded-xl py-4 items-center mt-3">
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">Issue Refund</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
