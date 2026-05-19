import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import { pickImageUrl, resolveImageUrl } from 'utils/image';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: Colors.textSecondary, bg: '#F3F4F6' },
  preparing: { label: 'Preparing', color: Colors.info, bg: '#E3F2FD' },
  out_for_delivery: { label: 'Out for Delivery', color: '#2563EB', bg: '#DBEAFE' },
  delivered: { label: 'Delivered', color: Colors.success, bg: '#E6F9F1' },
  skipped: { label: 'Skipped', color: Colors.warning, bg: '#FFF4E6' },
  missed: { label: 'Missed', color: Colors.error, bg: '#FFEEF0' },
  cancelled: { label: 'Cancelled', color: Colors.error, bg: '#FFEEF0' },
};

const nextActions = (status: string) => {
  switch (status) {
    case 'scheduled':
      return [
        { label: 'Mark as Preparing', value: 'preparing' },
        { label: 'Out for Delivery', value: 'out_for_delivery' },
        { label: 'Delivered', value: 'delivered' },
      ];
    case 'preparing':
      return [
        { label: 'Out for Delivery', value: 'out_for_delivery' },
        { label: 'Delivered', value: 'delivered' },
      ];
    case 'out_for_delivery':
      return [{ label: 'Delivered', value: 'delivered' }];
    case 'missed':
    case 'skipped':
      return [{ label: 'Reschedule', value: 'scheduled' }];
    default:
      return [];
  }
};

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

const buildAddress = (order: any) => {
  const address = order?.delivery_address;
  if (!address) return '';
  return (
    address.full_address ||
    address.address ||
    [address.workplace_name, address.floor, address.desk_number, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(', ')
  );
};

export default function StoreOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await storeService.getOrderDetail(String(id));
      setOrder(res.data);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to load order detail');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const statusMeta = useMemo(() => STATUS_META[String(order?.status || '').toLowerCase()] || STATUS_META.scheduled, [order?.status]);

  const updateDeliveryStatus = async (deliveryIndex: number, status: string) => {
    if (!id) return;
    const key = `${deliveryIndex}-${status}`;
    try {
      setUpdatingKey(key);
      const res = await storeService.updateOrderDeliveryStatus(String(id), {
        delivery_index: deliveryIndex,
        status,
      });
      setOrder(res.data);
      Alert.alert('Updated', 'Delivery status updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update delivery status');
    } finally {
      setUpdatingKey(null);
    }
  };

  const requestPayment = async () => {
    if (!id) return;
    try {
      setUpdatingKey('payment');
      const dueAmount = Number(order?.due_amount || 0);
      const res = await storeService.requestOrderPayment(String(id), {
        due_amount: dueAmount > 0 ? dueAmount : undefined,
      });
      setOrder(res.data || order);
      Alert.alert('Sent', 'Payment request sent to customer.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to request payment');
    } finally {
      setUpdatingKey(null);
    }
  };

  const markPaid = async () => {
    if (!id) return;
    try {
      setUpdatingKey('mark_paid');
      const paidAmount = Number(order?.paid_amount || 0);
      const dueAmount = Number(order?.due_amount || 0);
      const res = await storeService.updateOrderPaymentState(String(id), {
        payment_status: 'paid',
        paid_amount: paidAmount + dueAmount,
        due_amount: 0,
      });
      setOrder(res.data || order);
      Alert.alert('Success', 'Order marked as paid.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to mark order paid');
    } finally {
      setUpdatingKey(null);
    }
  };

  const cancelOrder = async () => {
    if (!id) return;
    Alert.alert('Cancel order?', 'This will cancel the remaining deliveries for this order.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdatingKey('cancel');
            const res = await storeService.cancelOrder(String(id), 'wallet');
            setOrder(res.data?.data?.order || res.data?.data || order);
            Alert.alert('Cancelled', 'Order cancelled successfully.');
          } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.message || 'Failed to cancel order');
          } finally {
            setUpdatingKey(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text className="text-textSecondary mt-3">Loading order detail...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
        <Text className="text-textSecondary mt-3 text-center">Order not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: Colors.primary }}>
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const addressText = buildAddress(order);
  const normalizeText = (value?: string) => {
    const normalized = String(value || '').trim();
    return normalized && normalized !== '-' ? normalized : '';
  };

  const deliveryGroups = (order.delivery_dates || []).reduce((groups: Record<string, any[]>, delivery: any) => {
    const dateKey = new Date(delivery.date).toISOString().split('T')[0];
    groups[dateKey] = groups[dateKey] || [];
    groups[dateKey].push(delivery);
    return groups;
  }, {});

  const sortedDeliveryDates = Object.keys(deliveryGroups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  const packageImage = pickImageUrl(order, [
    'image',
    'image_url',
    'package_image',
    'meal_image',
    'thumbnail',
    'photo',
    'media.url',
    'images',
    'package.image',
    'package.image_url',
    'package.thumbnail',
    'package.photo',
    'package.images',
    'meal.image',
    'meal.image_url',
    'item.image',
    'item.image_url',
  ]);
  const orderTitle =
    normalizeText(order.meal_name) || normalizeText(order.package_name) || 'Order';
  const orderSubtitle =
    normalizeText(order.package_name) || normalizeText(order.meal_name) || 'Order';
  const dueAmount = Number(order.due_amount || 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white">
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-textPrimary">Order Detail</Text>
          <View className="w-11 h-11" />
        </View>

        <View className="bg-blue-600 rounded-3xl p-4 mb-4 shadow-lg" style={{ elevation: 5 }}>
          <View className="flex-row items-start">
            <View className="w-16 h-16 rounded-2xl bg-white/15 overflow-hidden items-center justify-center mr-3">
              {packageImage ? (
                <Image source={{ uri: packageImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="restaurant-outline" size={26} color="#fff" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-extrabold" numberOfLines={2}>{orderTitle}</Text>
              <Text className="text-blue-100 mt-1" numberOfLines={1}>{orderSubtitle}</Text>
              <View className="flex-row items-center mt-2">
                <View className="px-3 py-1 rounded-full mr-2" style={{ backgroundColor: statusMeta.bg }}>
                  <Text className="text-xs font-bold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-white/15">
                  <Text className="text-xs font-semibold text-white">{order.slot}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ elevation: 2 }}>
          <Text className="text-sm font-bold text-textPrimary mb-3">Customer</Text>
          <View className="flex-row items-center mb-2">
            <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
            <Text className="text-sm text-textSecondary ml-2">{order.user?.name || order.user_name}</Text>
          </View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
            <Text className="text-sm text-textSecondary ml-2">{order.user?.phone_number || order.user_phone || '-'}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
            <Text className="text-sm text-textSecondary ml-2">{order.quantity || 1} item(s)</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ elevation: 2 }}>
          <Text className="text-sm font-bold text-textPrimary mb-2">Delivery Address</Text>
          <View className="flex-row items-start">
            <Ionicons name="location-outline" size={18} color={Colors.info} style={{ marginTop: 2 }} />
            <Text className="text-sm text-textSecondary ml-2 flex-1" numberOfLines={3}>
              {addressText || 'Address not available'}
            </Text>
          </View>
        </View>

        <View className="flex-row mb-4">
          <View className="flex-1 bg-white rounded-2xl p-4 mr-2 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-xs text-textSecondary">Payment</Text>
            <Text className="text-lg font-bold text-textPrimary capitalize mt-1">{order.payment_status || 'unpaid'}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 ml-2 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-xs text-textSecondary">Due Amount</Text>
            <Text className="text-lg font-bold text-textPrimary mt-1">₹{dueAmount}</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-textPrimary">Order Actions</Text>
            <View className="flex-row">
              {(dueAmount > 0 && order.payment_status !== 'paid') ? (
                <TouchableOpacity
                  onPress={requestPayment}
                  disabled={updatingKey === 'payment'}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: Colors.primary }}
                >
                  <Text className="text-white text-xs font-semibold">
                    {updatingKey === 'payment' ? 'Sending...' : 'Request Payment'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {(dueAmount > 0 && order.payment_status !== 'paid') ? (
                <TouchableOpacity
                  onPress={markPaid}
                  disabled={updatingKey === 'mark_paid'}
                  className="px-3 py-2 rounded-xl"
                  style={{ backgroundColor: '#10B981' }}
                >
                  <Text className="text-white text-xs font-semibold">
                    {updatingKey === 'mark_paid' ? 'Updating...' : 'Mark Paid'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {!['delivered', 'completed', 'cancelled'].includes(String(order.status || '').toLowerCase()) ? (
            <TouchableOpacity
              onPress={cancelOrder}
              disabled={updatingKey === 'cancel'}
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: '#FFF1F2' }}
            >
              <Text className="text-error font-semibold text-center">
                {updatingKey === 'cancel' ? 'Cancelling...' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text className="text-lg font-bold text-textPrimary mb-3">Delivery Timeline</Text>
        {sortedDeliveryDates.length ? (
          sortedDeliveryDates.map((dateKey) => (
            <View key={dateKey} className="mb-4">
              <Text className="text-sm font-semibold text-textPrimary mb-2">{formatDateLabel(dateKey)}</Text>
              {deliveryGroups[dateKey].map((delivery: any) => {
                const meta = STATUS_META[String(delivery.status || '').toLowerCase()] || STATUS_META.scheduled;
                const actions = nextActions(String(delivery.status || '').toLowerCase());
                const canEdit = !['delivered', 'cancelled'].includes(String(delivery.status || '').toLowerCase());
                return (
                  <View key={delivery._id || `${delivery.delivery_index}`} className="bg-white rounded-2xl p-4 mb-3 shadow-sm" style={{ elevation: 2 }}>
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 pr-3">
                        <Text className="text-base font-bold text-textPrimary" numberOfLines={2}>
                          {delivery.meal_name || order.meal_name}
                        </Text>
                        <Text className="text-xs text-textSecondary mt-1">
                          {delivery.slot}
                        </Text>
                      </View>
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: meta.bg }}>
                        <Text className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</Text>
                      </View>
                    </View>

                    {pickImageUrl(delivery, ['meal_image', 'image', 'image_url', 'thumbnail', 'photo', 'media.url', 'images']) || packageImage ? (
                      <View className="w-full h-36 rounded-2xl overflow-hidden bg-slate-100 mb-3">
                        <Image
                          source={{ uri: pickImageUrl(delivery, ['meal_image', 'image', 'image_url', 'thumbnail', 'photo', 'media.url', 'images']) || packageImage }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}

                    {delivery.delivery_note ? (
                      <View className="flex-row items-start bg-amber-50 rounded-xl px-3 py-2 mb-3">
                        <Ionicons name="document-text-outline" size={14} color="#D97706" style={{ marginTop: 2 }} />
                        <Text className="text-xs text-[#92400E] ml-2 flex-1" numberOfLines={2}>{delivery.delivery_note}</Text>
                      </View>
                    ) : null}

                    <Text className="text-xs text-textTertiary">
                      Status updates are managed from the dashboard.
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View className="bg-white rounded-2xl p-4 items-center">
            <Ionicons name="calendar-outline" size={30} color={Colors.textTertiary} />
            <Text className="text-textSecondary mt-2">No delivery timeline found.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
