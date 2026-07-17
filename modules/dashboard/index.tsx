import { useEffect, useCallback, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useStoreStore } from 'store/storeStore';
import { useAuthStore } from 'store/authStore';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import { transitionAcceptedOrder } from 'services/incomingOrderAlertService';
import LiveOrderActivityBoard from 'components/LiveOrderActivityBoard';
import PendingBulkOrdersBanner from 'components/PendingBulkOrdersBanner';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import MissedOrdersBanner from 'components/MissedOrdersBanner';
import {
  getOrderDeliveryDateKey,
  getTodayDateKey,
  isHiddenStoreDelivery,
  sortStoreOrdersByDateAndSlot,
} from 'utils/orderActivity';
import type { DashboardOrder } from 'types';

export default function DashboardScreen() {
  const { dashboard, isOnline, loading, fetchDashboard, toggleOnline } = useStoreStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  const onRefresh = useCallback(() => {
    fetchDashboard();
  }, []);

  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const dashboardNextActions = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'pending':
        return [{ label: 'Accept and Start Preparing', value: 'preparing' }];
      case 'scheduled':
        return [{ label: 'Start Preparing', value: 'preparing' }];
      case 'preparing':
        return [{ label: 'Mark Out for Delivery', value: 'out_for_delivery' }];
      case 'out_for_delivery':
        return [];
      default:
        return [];
    }
  };

  const resolveOrderApiIds = (order: DashboardOrder) => {
    const candidates = [
      (order as any)?.order_id,
      (order as any)?.subscription_id,
      order?._id,
      (order as any)?.id,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return Array.from(new Set(candidates));
  };

  const resolveOrderRouteId = (order: DashboardOrder) => {
    const candidates = [
      (order as any)?.order_id,
      (order as any)?.subscription_id,
      order?._id,
      (order as any)?.id,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return candidates[0] || '';
  };

  const navigateToOrder = (order: DashboardOrder) => {
    const routeId = resolveOrderRouteId(order);
    const fallbackIds = resolveOrderApiIds(order);

    if (!routeId) {
      Alert.alert('Order unavailable', 'Order details are not available right now.');
      return;
    }

    router.push({
      pathname: '/order/[id]' as any,
      params: {
        id: routeId,
        alts: fallbackIds.join(','),
        openAt: String(Date.now()),
        focusDate: getOrderDeliveryDateKey(order) || getTodayDateKey(),
      },
    });
  };

  const resolveDeliveryIndexes = (order: DashboardOrder) => {
    const raw = [
      (order as any)?.delivery_index,
      (order as any)?.current_delivery_index,
      (order as any)?.next_delivery_index,
      0,
    ];

    const normalized = raw
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0);

    return Array.from(new Set(normalized));
  };

  const updateOrderStatus = async (order: DashboardOrder, status: string) => {
    const orderIds = resolveOrderApiIds(order);
    const deliveryIndexes = resolveDeliveryIndexes(order);
    const localOrderKey = String((order as any)?._id || orderIds[0] || '').trim();

    if (!orderIds.length) {
      Alert.alert('Status update failed', 'Order id missing. Please refresh and try again.');
      return;
    }

    const key = `${orderIds[0]}-${status}`;
    try {
      setUpdatingOrder(key);

      let updated = false;
      let lastError: any = null;

      for (const orderId of orderIds) {
        for (const deliveryIndex of deliveryIndexes) {
          try {
            await storeService.updateOrderDeliveryStatus(orderId, {
              delivery_index: deliveryIndex,
              status,
            });
            updated = true;
            break;
          } catch (error: any) {
            lastError = error;
          }
        }

        if (updated) break;
      }

      if (!updated) {
        throw lastError || new Error('Unable to update order status');
      }

      if (localOrderKey) {
        setStatusOverrides((prev) => ({ ...prev, [localOrderKey]: status }));
      }

      if (['preparing', 'accepted', 'assigned'].includes(String(status).toLowerCase())) {
        await transitionAcceptedOrder(
          {
            subscription: order,
            subscription_id: orderIds[0],
            status,
          },
          dashboard,
        );
      }

      await fetchDashboard();
    } catch (error: any) {
      if (localOrderKey) {
        setStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[localOrderKey];
          return next;
        });
      }
      Alert.alert('Status update failed', error?.response?.data?.message || 'Unable to update order status');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const sortOrders = (orders: DashboardOrder[] = [], dateDirection: 'asc' | 'desc' = 'asc') =>
    sortStoreOrdersByDateAndSlot(orders, { dateDirection, instantFirst: true });

  const todayOrders = sortOrders(
    (dashboard?.today_orders || []).filter((o) => !isHiddenStoreDelivery(o.status)),
    'asc',
  );

  const StatCard = ({
    title,
    value,
    icon,
    color,
    onPress,
  }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 flex-1 mx-1.5 shadow-sm"
      style={{ minWidth: '45%' }}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text className="text-2xl font-bold text-textPrimary">{value}</Text>
      <Text className="text-xs text-textSecondary mt-0.5">{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <Text className="text-sm text-textSecondary">Welcome back,</Text>
            <Text className="text-xl font-bold text-textPrimary" numberOfLines={1}>
              {user?.store_name || user?.name || 'Store Partner'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-sm mr-2" style={{ color: isOnline ? Colors.online : Colors.offline }}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#E0E0E0', true: Colors.online + '50' }}
              thumbColor={isOnline ? Colors.online : '#9E9E9E'}
            />
          </View>
        </View>

        <MissedOrdersBanner dashboard={dashboard} onOrderPress={navigateToOrder} />

        <LiveOrderActivityBoard
          dashboard={dashboard}
          onOrderPress={navigateToOrder}
          onQuickAction={(order, status) => updateOrderStatus(order, status)}
          updatingOrder={updatingOrder}
          nextActions={dashboardNextActions}
        />

        <PendingBulkInquiriesBanner
          inquiries={dashboard?.pending_bulk_inquiries || []}
          onUpdated={fetchDashboard}
        />

        <PendingBulkOrdersBanner
          orders={dashboard?.pending_bulk_orders || []}
          onNoted={fetchDashboard}
        />

        {/* Quick Stats */}
        <View className="flex-row flex-wrap mb-4">
          <View className="flex-row w-full mb-3">
            <StatCard
              title="Total Orders"
              value={dashboard?.total_orders || 0}
              icon="receipt"
              color={Colors.primary}
              onPress={() => router.push('/(tabs)/orders')}
            />
            <StatCard
              title="Active Subs"
              value={dashboard?.active_subscriptions || 0}
              icon="people"
              color={Colors.info}
              onPress={() => router.push('/subscriptions')}
            />
          </View>
          <View className="flex-row w-full mb-3">
            <StatCard
              title="This Week"
              value={`₹${dashboard?.weekly_revenue || 0}`}
              icon="cash"
              color={Colors.success}
            />
            <StatCard
              title="This Month"
              value={`₹${dashboard?.monthly_revenue || 0}`}
              icon="trending-up"
              color={Colors.warning}
            />
          </View>
        </View>

        {/* Today's Orders — use Live Activity board above; link to full orders tab */}
        {(todayOrders.length > 0) && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/orders')}
            className="mb-4 py-3 items-center rounded-2xl"
            style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}
          >
            <Text className="text-sm font-bold" style={{ color: Colors.primary }}>
              View all {todayOrders.length} orders in Orders tab →
            </Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text className="text-lg font-bold text-textPrimary mb-3">Quick Actions</Text>
        <View className="flex-row flex-wrap mb-4">
          {[
            { label: 'Menu Items', icon: 'restaurant', route: '/(tabs)/menu', color: Colors.primary },
            { label: 'Settlements', icon: 'wallet', route: '/(tabs)/finance', color: Colors.success },
            { label: 'Chat', icon: 'chatbubbles', route: '/chat', color: Colors.info },
            { label: 'Promotions', icon: 'pricetag', route: '/promotions', color: Colors.accent },
            { label: 'Expenses', icon: 'card', route: '/expenses', color: Colors.warning },
            { label: 'Refunds', icon: 'return-down-back', route: '/refunds', color: Colors.error },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              onPress={() => router.push(action.route as any)}
              className="bg-white rounded-2xl p-3 items-center m-1.5"
              style={{ width: '30%', minHeight: 98 }}
              activeOpacity={0.7}
            >
              <View
                className="w-11 h-11 rounded-full items-center justify-center mb-1.5"
                style={{ backgroundColor: action.color + '15' }}
              >
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text className="text-xs text-textSecondary text-center" numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Settlements Summary */}
        {(dashboard?.recent_settlements?.length ?? 0) > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/finance')}
            className="bg-white rounded-2xl p-4 mb-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-textPrimary">Recent Settlements</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </View>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-textPrimary">₹{dashboard?.total_revenue || 0}</Text>
                <Text className="text-xs text-textSecondary">Total Revenue</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-warning">₹{dashboard?.pending_settlement_amount || 0}</Text>
                <Text className="text-xs text-textSecondary">Pending</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-success">{dashboard?.recent_settlements?.length || 0}</Text>
                <Text className="text-xs text-textSecondary">Recent</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Penalties */}
        {(dashboard?.pending_penalty_amount ?? 0) > 0 && (
          <View className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100">
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning" size={20} color={Colors.error} />
              <Text className="text-base font-bold text-error ml-2">Penalties</Text>
            </View>
            <Text className="text-textSecondary">
              ₹{dashboard?.pending_penalty_amount} pending
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
