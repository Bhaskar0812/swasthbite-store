
import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Colors } from 'constants/theme';
import { useStoreStore } from 'store/storeStore';
import type { DashboardOrder } from 'types';
import { pickImageUrl } from 'utils/image';


export default function OrdersScreen() {
  const { dashboard, packages, loading, fetchDashboard, fetchPackages } = useStoreStore();
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const normalizeText = (value?: string) => {
    const normalized = String(value || '').trim();
    return normalized && normalized !== '-' ? normalized : '';
  };

  const getOrderTitle = (item: DashboardOrder) =>
    normalizeText(item.meal_name) || normalizeText(item.package_name) || 'Order';
  const getOrderImage = (item: DashboardOrder) => {
    const direct = pickImageUrl(item, [
      'package_image',
      'image',
      'meal_image',
      'image_url',
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
    if (direct) return direct;

    const packageId = String((item as any)?.package_id || (item as any)?.package?._id || '').trim();
    const packageName = normalizeText(item.package_name || (item as any)?.package?.name);

    const pkg = packages.find((p: any) => {
      const idMatch = packageId && String(p?._id || '').trim() === packageId;
      const nameMatch = packageName && normalizeText(p?.name) === packageName;
      return idMatch || nameMatch;
    });

    return pickImageUrl(pkg, ['image_url', 'image', 'thumbnail', 'photo', 'media.url', 'images']);
  };
  const isInstantOrder = (item: DashboardOrder) => item.delivery_mode === 'instant';
  const isDeliveredOrder = (item: DashboardOrder) => {
    const status = String(item.status || '').toLowerCase();
    return ['delivered', 'completed', 'cancelled'].includes(status);
  };

  const sortOrders = (list: DashboardOrder[]) => {
    return [...list].sort((a, b) => {
      const aRank = isInstantOrder(a) ? 0 : isDeliveredOrder(a) ? 2 : 1;
      const bRank = isInstantOrder(b) ? 0 : isDeliveredOrder(b) ? 2 : 1;
      if (aRank !== bRank) return aRank - bRank;

      if (aRank === 0) {
        const aDeadline = a.instant_deadline_at ? new Date(a.instant_deadline_at).getTime() : 0;
        const bDeadline = b.instant_deadline_at ? new Date(b.instant_deadline_at).getTime() : 0;
        return aDeadline - bDeadline;
      }

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });
  };

  const orders = sortOrders(tab === 'today' ? (dashboard?.today_orders || []) : (dashboard?.tomorrow_orders || []));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'preparing':
      case 'ready':
      case 'out_for_delivery':
        return Colors.info;
      case 'delivered':
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.textTertiary;
    }
  };

  const getOrderAddress = (item: DashboardOrder) =>
    item.delivery_address?.full_address ||
    item.delivery_address?.address ||
    item.address_snapshot?.full_address ||
    [
      item.address_snapshot?.workplace_name,
      item.address_snapshot?.floor,
      item.address_snapshot?.desk_number,
      item.address_snapshot?.city,
    ]
      .filter(Boolean)
      .join(', ');

  const getInstantCountdown = (item: DashboardOrder) => {
    if (item.delivery_mode !== 'instant') return '';

    const deadlineAt = item.instant_deadline_at
      ? new Date(item.instant_deadline_at).getTime()
      : item.createdAt
        ? new Date(item.createdAt).getTime() + 60 * 60 * 1000
        : 0;

    if (!deadlineAt) return 'Instant';

    const remainingMs = Math.max(0, deadlineAt - now);
    if (remainingMs <= 0) return 'Expired';

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m ${seconds}s left`;
    return `${seconds}s left`;
  };

  const renderOrder = ({ item }: { item: DashboardOrder }) => (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.push(`/order/${item.order_id || item._id}` as any)}
      className="rounded-3xl p-4 mb-4 mx-4 shadow-lg"
      style={{
        elevation: 6,
        shadowColor: item.delivery_mode === 'instant' ? '#2563EB' : '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: item.delivery_mode === 'instant' ? 0.15 : 0.08,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: item.delivery_mode === 'instant' ? '#2563EB' : '#EEF2FF',
        backgroundColor: item.delivery_mode === 'instant' ? '#EFF6FF' : '#fff',
      }}
    >
      {item.delivery_mode === 'instant' ? (
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            backgroundColor: '#2563EB',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            zIndex: 1,
          }}
        >
          <Text className="text-[10px] font-bold text-white">Instant</Text>
        </View>
      ) : null}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-start flex-1 mr-3 min-w-0">
          <View className="w-14 h-14 rounded-2xl overflow-hidden bg-blue-50 items-center justify-center mr-3">
            {getOrderImage(item) ? (
              <Image
                source={{ uri: getOrderImage(item) }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="restaurant-outline" size={20} color={Colors.info} />
            )}
          </View>

          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-textPrimary" numberOfLines={2}>
              {getOrderTitle(item)}
            </Text>
            {(item.quantity || 1) > 1 && (
              <View className="mt-1 self-start px-2 py-0.5 rounded-full bg-blue-100">
                <Text className="text-xs font-bold text-blue-800">×{item.quantity}</Text>
              </View>
            )}
          </View>
        </View>

        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: getStatusColor(item.status) + '15' }}
        >
          <Text className="text-xs font-semibold capitalize" style={{ color: getStatusColor(item.status) }}>
            {item.status}
          </Text>
        </View>
      </View>

      {item.delivery_mode === 'instant' ? (
        <View className="flex-row items-center justify-between mt-1 mb-1.5 px-3 py-2 rounded-xl" style={{ backgroundColor: '#E3F2FD' }}>
          <View className="flex-row items-center flex-1 pr-2">
            <Ionicons name="flash-outline" size={14} color={Colors.info} />
            <Text className="text-xs font-semibold text-blue-700 ml-1" numberOfLines={1}>
              Instant order
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="timer-outline" size={14} color={Colors.info} />
            <Text className="text-xs font-bold text-blue-700 ml-1" numberOfLines={1}>
              {getInstantCountdown(item)}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center mb-1.5">
        <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
        <Text className="text-sm text-textSecondary ml-1.5" numberOfLines={1}>{item.user_name}</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 pr-2">
          <Ionicons name="call-outline" size={14} color={Colors.textTertiary} />
          <Text className="text-xs text-textTertiary ml-1.5" numberOfLines={1}>{item.user_phone}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
          <Text className="text-xs text-textTertiary ml-1 capitalize" numberOfLines={1}>{item.slot}</Text>
        </View>
      </View>
      {item.package_name && (
        <View className="flex-row items-center mt-2 bg-blue-50 rounded-lg px-2.5 py-1.5">
          <Ionicons name="cube-outline" size={14} color={Colors.info} />
          <Text className="text-xs text-info ml-1.5" style={{ color: Colors.info }}>{item.package_name}</Text>
        </View>
      )}
      {item.delivery_note ? (
        <View className="flex-row items-center mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
          <Ionicons name="document-text-outline" size={14} color="#D97706" />
          <Text className="text-xs ml-1.5 flex-1" style={{ color: '#92400E' }} numberOfLines={2}>{item.delivery_note}</Text>
        </View>
      ) : null}

      {getOrderAddress(item) ? (
        <View className="flex-row items-start mt-2 bg-slate-50 rounded-xl px-3 py-2">
          <Ionicons name="location-outline" size={14} color={Colors.info} style={{ marginTop: 2 }} />
          <Text className="text-xs text-textSecondary ml-2 flex-1" numberOfLines={2}>
            {getOrderAddress(item)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-blue-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#2563EB" />
      {/* Blue accent header */}
      <View className="w-full bg-blue-600 rounded-b-3xl pb-6 pt-8 px-6 mb-4 shadow-md" style={{ elevation: 6 }}>
        <Text className="text-2xl font-extrabold text-white mb-1 tracking-wide">Orders</Text>
        <Text className="text-base text-blue-100 mb-2">Track and manage your deliveries</Text>
        {/* Tab Switcher */}
        <View className="flex-row bg-blue-100 rounded-xl p-1 mt-2">
          {([
            { key: 'today' as const, label: `Today (${dashboard?.today_orders?.length || 0})` },
            { key: 'tomorrow' as const, label: `Tomorrow (${dashboard?.tomorrow_orders?.length || 0})` },
          ]).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className="flex-1 py-2.5 rounded-lg items-center"
              style={tab === t.key ? { backgroundColor: '#2563EB' } : {}}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: tab === t.key ? '#fff' : '#2563EB' }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrder}
        style={{ backgroundColor: Colors.background }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboard} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No orders for {tab}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
