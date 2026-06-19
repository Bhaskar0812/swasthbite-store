import { useEffect, useMemo, useCallback } from 'react';
import {
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
import type { DashboardOrder } from 'types';
import LiveOrderActivityBoard from 'components/LiveOrderActivityBoard';
import MissedOrdersBanner from 'components/MissedOrdersBanner';
import PendingBulkOrdersBanner from 'components/PendingBulkOrdersBanner';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import {
  isHiddenStoreDelivery,
} from 'utils/orderActivity';

export default function OrdersScreen() {
  const { dashboard, loading, fetchDashboard, fetchPackages } = useStoreStore();

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
    (item) => !isHiddenStoreDelivery(item.status),
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
      },
    });
  };

  const tomorrowCount = useMemo(
    () => (dashboard?.tomorrow_orders || []).filter((item) => !isHiddenStoreDelivery(item.status)).length,
    [dashboard?.tomorrow_orders],
  );

  const missedCount = dashboard?.missed_orders?.length || 0;

  return (
    <SafeAreaView className="flex-1 bg-blue-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      <View className="w-full bg-blue-600 rounded-b-3xl pb-6 pt-8 px-6 mb-4 shadow-md" style={{ elevation: 6 }}>
        <Text className="text-2xl font-extrabold text-white mb-1 tracking-wide">Orders</Text>
        <Text className="text-base text-blue-100 mb-2">
          Today {todayAllOrders.length} • Tomorrow {tomorrowCount}
          {missedCount > 0 ? ` • Missed ${missedCount}` : ''}
        </Text>

        <View className="flex-row mt-2 mb-2">
          <View className="flex-1 rounded-xl px-3 py-2 mr-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-blue-100">Preparing</Text>
            <Text className="text-lg font-bold text-white">{preparingCount}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-blue-100">Out for delivery</Text>
            <Text className="text-lg font-bold text-white">{outForDeliveryCount}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2 ml-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-blue-100">Delivered today</Text>
            <Text className="text-lg font-bold text-white">{deliveredTodayCount}</Text>
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
