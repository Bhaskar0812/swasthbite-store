import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import { formatSlotLabel } from 'utils/orderActivity';

type StoreSubscription = {
  _id: string;
  package_name?: string;
  status?: string;
  user_name?: string;
  user_phone?: string;
  remaining_count?: number;
  total_deliveries?: number;
  delivered_count?: number;
  next_delivery_date?: string;
  next_delivery_slot?: string;
  delivery_address?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<StoreSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await storeService.getSubscriptions('active');
      setItems(res?.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: StoreSubscription }) => {
    const shortId = String(item._id || '').slice(-6).toUpperCase();
    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/order/[id]' as any,
            params: { id: item._id, openAt: String(Date.now()) },
          })
        }
        className="bg-white rounded-2xl p-4 mb-3 border border-divider"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-textPrimary" numberOfLines={1}>
              {item.package_name || 'Subscription'}
            </Text>
            <Text className="text-sm text-textSecondary mt-0.5">
              #{shortId} • {item.user_name || 'Customer'}
            </Text>
          </View>
          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: Colors.successLight }}>
            <Text className="text-xs font-bold" style={{ color: Colors.success }}>
              Active
            </Text>
          </View>
        </View>

        {item.delivery_address ? (
          <View className="flex-row items-start mb-2">
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} style={{ marginTop: 2 }} />
            <Text className="text-sm text-textSecondary ml-1.5 flex-1" numberOfLines={2}>
              {item.delivery_address}
            </Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-2 mt-1">
          <View className="px-2.5 py-1 rounded-full bg-slate-100">
            <Text className="text-xs font-semibold text-slate-700">
              Next: {formatDate(item.next_delivery_date)}
            </Text>
          </View>
          {item.next_delivery_slot ? (
            <View className="px-2.5 py-1 rounded-full bg-slate-100">
              <Text className="text-xs font-semibold text-slate-700">
                {formatSlotLabel(item.next_delivery_slot)}
              </Text>
            </View>
          ) : null}
          <View className="px-2.5 py-1 rounded-full bg-slate-100">
            <Text className="text-xs font-semibold text-slate-700">
              {item.delivered_count || 0}/{item.total_deliveries || 0} delivered
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Active Subscriptions</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3">No active subscriptions</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
