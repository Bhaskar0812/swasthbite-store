import { useEffect, useMemo, useCallback, useState } from 'react';
import {
  Alert,
  View,
  Text,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from 'constants/theme';
import { useStoreStore } from 'store/storeStore';
import { storeService } from 'services/storeService';
import { transitionAcceptedOrder } from 'services/incomingOrderAlertService';
import type { DashboardOrder } from 'types';
import LiveOrderActivityBoard from 'components/LiveOrderActivityBoard';
import MissedOrdersBanner from 'components/MissedOrdersBanner';
import PendingBulkOrdersBanner from 'components/PendingBulkOrdersBanner';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import {
  getOrderDeliveryDateKey,
  getTodayDateKey,
  isHiddenStoreDelivery,
} from 'utils/orderActivity';

export default function OrdersScreen() {
  const { dashboard, loading, fetchDashboard, fetchPackages } = useStoreStore();
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  const todayAllOrders = (dashboard?.today_orders || []).filter(
    (item) => !isHiddenStoreDelivery(item.status, (item as any)?.skipped_by),
  );

  const preparingCount = todayAllOrders.filter((item) =>
    ['preparing', 'assigned', 'accepted'].includes(String(item.status || '').toLowerCase()),
  ).length;
  const outForDeliveryCount = todayAllOrders.filter((item) =>
    ['out_for_delivery', 'picked_up'].includes(String(item.status || '').toLowerCase()),
  ).length;
  const deliveredTodayCount = todayAllOrders.filter((item) =>
    ['delivered', 'completed'].includes(String(item.status || '').toLowerCase()),
  ).length;

  const bulkInquiries = dashboard?.pending_bulk_inquiries || [];

  const resolveOrderRouteId = (item: DashboardOrder) => {
    const candidates = [
      (item as any)?.order_id,
      (item as any)?.subscription_id,
      item?._id,
      (item as any)?.id,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return candidates[0] || '';
  };

  const resolveOrderAltIds = (item: DashboardOrder) => {
    const candidates = [
      (item as any)?.order_id,
      (item as any)?.subscription_id,
      item?._id,
      (item as any)?.id,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return Array.from(new Set(candidates));
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

  const nextActions = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'pending':
        return [{ label: 'Accept and Start Preparing', value: 'preparing' }];
      case 'scheduled':
        return [{ label: 'Start Preparing', value: 'preparing' }];
      case 'preparing':
        return [{ label: 'Mark Out for Delivery', value: 'out_for_delivery' }];
      default:
        return [];
    }
  };

  const updateOrderStatus = async (order: DashboardOrder, status: string) => {
    const orderIds = resolveOrderAltIds(order);
    const deliveryIndexes = resolveDeliveryIndexes(order);
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

      if (!updated) throw lastError || new Error('Unable to update order status');

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
      Alert.alert(
        'Status update failed',
        error?.response?.data?.message || 'Unable to update order status',
      );
    } finally {
      setUpdatingOrder(null);
    }
  };

  const navigateToOrder = (item: DashboardOrder) => {
    const routeId = resolveOrderRouteId(item);
    const altIds = resolveOrderAltIds(item);
    if (!routeId) return;

    router.push({
      pathname: '/order/[id]' as any,
      params: {
        id: routeId,
        alts: altIds.join(','),
        openAt: String(Date.now()),
        focusDate: getOrderDeliveryDateKey(item) || getTodayDateKey(),
      },
    });
  };

  const tomorrowCount = useMemo(
    () =>
      (dashboard?.tomorrow_orders || []).filter(
        (item) => !isHiddenStoreDelivery(item.status, (item as any)?.skipped_by),
      ).length,
    [dashboard?.tomorrow_orders],
  );

  const missedCount = dashboard?.missed_orders?.length || 0;

  return (
    <SafeAreaView className="flex-1 bg-blue-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      <View className="w-full bg-blue-600 rounded-b-3xl pb-6 pt-8 px-6 mb-4 shadow-md" style={{ elevation: 6 }}>
        <Text className="text-2xl font-extrabold text-white mb-1 tracking-wide">Orders</Text>
        <Text className="text-lg text-blue-100 mb-2">
          Today {todayAllOrders.length} • Tomorrow {tomorrowCount}
          {missedCount > 0 ? ` • Missed ${missedCount}` : ''}
        </Text>

        <View className="flex-row mt-2 mb-2">
          <View className="flex-1 rounded-xl px-3 py-2.5 mr-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-sm text-blue-100">Preparing</Text>
            <Text className="text-xl font-bold text-white">{preparingCount}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2.5 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-sm text-blue-100">Out for delivery</Text>
            <Text className="text-xl font-bold text-white">{outForDeliveryCount}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2.5 ml-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-sm text-blue-100">Delivered today</Text>
            <Text className="text-xl font-bold text-white">{deliveredTodayCount}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: Colors.background }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboard} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <MissedOrdersBanner dashboard={dashboard} onOrderPress={navigateToOrder} />

        <LiveOrderActivityBoard
          dashboard={dashboard}
          onOrderPress={navigateToOrder}
          onQuickAction={updateOrderStatus}
          updatingOrder={updatingOrder}
          nextActions={nextActions}
        />

        <PendingBulkInquiriesBanner
          inquiries={bulkInquiries.filter((item) => item.status === 'submitted').slice(0, 1)}
          onUpdated={fetchDashboard}
        />

        <PendingBulkOrdersBanner
          orders={(dashboard?.pending_bulk_orders || []).slice(0, 1)}
          onNoted={fetchDashboard}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
