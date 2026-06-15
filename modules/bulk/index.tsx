import { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { Colors } from 'constants/theme';
import { useStoreStore } from 'store/storeStore';
import { storeService } from 'services/storeService';
import BulkOrdersPanel from 'components/BulkOrdersPanel';
import type { PendingBulkInquiry, PendingBulkOrder } from 'types';

const unwrapData = <T,>(payload: any): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
};

type BulkOrdersPayload = {
  upcoming: PendingBulkOrder[];
  past: PendingBulkOrder[];
  awaiting_payment: PendingBulkOrder[];
};

export default function BulkScreen() {
  const { fetchDashboard } = useStoreStore();
  const [loading, setLoading] = useState(false);
  const [bulkOrders, setBulkOrders] = useState<BulkOrdersPayload>({
    upcoming: [],
    past: [],
    awaiting_payment: [],
  });
  const [inquiries, setInquiries] = useState<PendingBulkInquiry[]>([]);

  const loadBulkData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, inquiriesRes] = await Promise.all([
        storeService.getBulkOrders(),
        storeService.getBulkInquiries(),
      ]);
      const ordersPayload = unwrapData<BulkOrdersPayload>(ordersRes);
      const inquiriesPayload = unwrapData<PendingBulkInquiry[]>(inquiriesRes);
      setBulkOrders({
        upcoming: ordersPayload?.upcoming || [],
        past: ordersPayload?.past || [],
        awaiting_payment: ordersPayload?.awaiting_payment || [],
      });
      setInquiries(Array.isArray(inquiriesPayload) ? inquiriesPayload : []);
      await fetchDashboard();
    } catch {
      // Keep last loaded data visible on refresh failure.
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadBulkData();
    }, [loadBulkData]),
  );

  const pendingInquiryCount = inquiries.filter((item) => item.status === 'submitted').length;

  return (
    <SafeAreaView className="flex-1 bg-amber-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#D97706" />

      <View className="w-full bg-amber-600 rounded-b-3xl pb-6 pt-8 px-6 mb-4 shadow-md" style={{ elevation: 6 }}>
        <Text className="text-2xl font-extrabold text-white mb-1 tracking-wide">Bulk Orders</Text>
        <Text className="text-base text-amber-100 mb-2">
          Manage event orders, inquiries and quotations
        </Text>
        <View className="flex-row mt-2">
          <View className="flex-1 rounded-xl px-3 py-2 mr-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-amber-100">Upcoming</Text>
            <Text className="text-lg font-bold text-white">{bulkOrders.upcoming.length}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-amber-100">Past</Text>
            <Text className="text-lg font-bold text-white">{bulkOrders.past.length}</Text>
          </View>
          <View className="flex-1 rounded-xl px-3 py-2 ml-1" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="text-[11px] text-amber-100">Inquiries</Text>
            <Text className="text-lg font-bold text-white">{pendingInquiryCount}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: Colors.background }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadBulkData} colors={[Colors.primary]} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-4 mb-4">
          <BulkOrdersPanel
            upcomingOrders={bulkOrders.upcoming}
            pastOrders={bulkOrders.past}
            awaitingOrders={bulkOrders.awaiting_payment}
            inquiries={inquiries}
            onUpdated={loadBulkData}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
