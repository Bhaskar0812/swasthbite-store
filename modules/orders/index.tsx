import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from 'constants/theme';
import { useStoreStore } from 'store/storeStore';
import type { DashboardOrder } from 'types';
import { pickImageUrl, resolveImageUrl } from 'utils/image';
import PartnerOrderQueue from 'components/PartnerOrderQueue';
import DeliveryScheduleBanner from 'components/DeliveryScheduleBanner';
import PendingBulkOrdersBanner from 'components/PendingBulkOrdersBanner';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import BulkOrdersPanel from 'components/BulkOrdersPanel';
import {
  formatCountdown,
  formatStatusLabel,
  getInstantDeadline,
  getTodayDateKey,
  isHiddenStoreDelivery,
  sortStoreOrdersByDateAndSlot,
} from 'utils/orderActivity';

type OrdersTab = 'today' | 'tomorrow' | 'delivered' | 'bulk';

export default function OrdersScreen() {
  const { dashboard, packages, loading, fetchDashboard, fetchPackages } = useStoreStore();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<OrdersTab>('today');
  const [activeIndexes, setActiveIndexes] = useState<Record<Exclude<OrdersTab, 'bulk'>, number>>({
    today: 0,
    tomorrow: 0,
    delivered: 0,
  });
  const [now, setNow] = useState(Date.now());

  const selectedByTabRef = useRef<Record<Exclude<OrdersTab, 'bulk'>, string>>({
    today: '',
    tomorrow: '',
    delivered: '',
  });
  const hasInitializedDeliveredRef = useRef(false);

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      if (String(tabParam || '').toLowerCase() === 'bulk') {
        setActiveTab('bulk');
      }
    }, [fetchDashboard, tabParam]),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizeText = (value?: string) => {
    const normalized = String(value || '').trim();
    return normalized && normalized !== '-' ? normalized : '';
  };

  const parseTrailingQuantity = (value?: string) => {
    const label = String(value || '').trim();
    const match = label.match(/\bx\s*(\d+)\s*$/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const stripTrailingQuantity = (value?: string) => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    return normalized.replace(/\s*x\s*\d+\s*$/i, '').trim();
  };

  const getOrderQuantity = (item: DashboardOrder) => {
    const directQty = Number((item as any)?.quantity);
    if (Number.isFinite(directQty) && directQty > 0) return Math.floor(directQty);

    return (
      parseTrailingQuantity((item as any)?.meal_name) ||
      parseTrailingQuantity((item as any)?.package_name) ||
      1
    );
  };

  const getOrderTitle = (item: DashboardOrder) =>
    stripTrailingQuantity(item.meal_name) || stripTrailingQuantity(item.package_name) || 'Order';

  const getOrderImage = (item: DashboardOrder) => {
    const bundleImage =
      resolveImageUrl((item as any)?.bundle_items?.[0]?.image) ||
      resolveImageUrl((item as any)?.delivery_dates?.[0]?.bundle_items?.[0]?.image) ||
      resolveImageUrl((item as any)?.delivery_dates?.[0]?.meal_image);
    if (bundleImage) return bundleImage;

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
    return ['delivered', 'completed'].includes(status);
  };

  const isTerminalOrder = (item: DashboardOrder) => {
    const status = String(item.status || '').toLowerCase();
    return ['delivered', 'completed', 'cancelled', 'failed', 'skipped', 'missed'].includes(status);
  };

  const isPreparingStatus = (status?: string) => {
    const value = String(status || '').toLowerCase();
    return ['preparing', 'assigned', 'accepted'].includes(value);
  };

  const isOutForDeliveryStatus = (status?: string) => {
    const value = String(status || '').toLowerCase();
    return ['out_for_delivery', 'picked_up'].includes(value);
  };

  const isDeliveredStatus = (status?: string) => {
    const value = String(status || '').toLowerCase();
    return ['delivered', 'completed'].includes(value);
  };

  const sortOrders = (list: DashboardOrder[], dateDirection: 'asc' | 'desc' = 'asc') =>
    sortStoreOrdersByDateAndSlot(list, { dateDirection, instantFirst: true });

  const todayDateLabel = useMemo(() => getTodayDateKey(now), [now]);

  const todayAllOrders = (dashboard?.today_orders || []).filter(
    (item) => !isHiddenStoreDelivery(item.status),
  );
  const tomorrowAllOrders = (dashboard?.tomorrow_orders || []).filter(
    (item) => !isHiddenStoreDelivery(item.status),
  );

  const todaySliderOrders = useMemo(
    () => sortOrders(todayAllOrders.filter((item) => !isTerminalOrder(item)), 'asc'),
    [todayAllOrders],
  );

  const tomorrowSliderOrders = useMemo(
    () => sortOrders(tomorrowAllOrders.filter((item) => !isTerminalOrder(item)), 'asc'),
    [tomorrowAllOrders],
  );

  const deliveredSliderOrders = useMemo(() => {
    const backendDelivered = dashboard?.delivered_orders || [];
    const fallbackDelivered = [...todayAllOrders, ...tomorrowAllOrders].filter((item) => isDeliveredOrder(item));
    const source = backendDelivered.length ? backendDelivered : fallbackDelivered;
    return sortOrders(source.filter((item) => isDeliveredOrder(item)), 'desc');
  }, [dashboard?.delivered_orders, todayAllOrders, tomorrowAllOrders]);

  const decks: Record<Exclude<OrdersTab, 'bulk'>, DashboardOrder[]> = {
    today: todaySliderOrders,
    tomorrow: tomorrowSliderOrders,
    delivered: deliveredSliderOrders,
  };

  const confirmedBulkOrders = dashboard?.confirmed_bulk_orders || dashboard?.pending_bulk_orders || [];
  const awaitingBulkOrders = dashboard?.awaiting_payment_bulk_orders || [];
  const bulkInquiries = dashboard?.pending_bulk_inquiries || [];
  const bulkTabCount =
    confirmedBulkOrders.length +
    awaitingBulkOrders.length +
    bulkInquiries.filter((item) => item.status === 'submitted').length;

  const syncTabIndex = (tab: Exclude<OrdersTab, 'bulk'>, deck: DashboardOrder[]) => {
    if (!deck.length) {
      setActiveIndexes((prev) => ({ ...prev, [tab]: 0 }));
      selectedByTabRef.current[tab] = '';
      if (tab === 'delivered') hasInitializedDeliveredRef.current = false;
      return;
    }

    const selectedId = selectedByTabRef.current[tab];
    if (selectedId) {
      const stickyIdx = deck.findIndex((item) => {
        const id = String((item as any)?.order_id || (item as any)?.subscription_id || item?._id || '').trim();
        return id === selectedId;
      });
      if (stickyIdx >= 0) {
        setActiveIndexes((prev) => ({ ...prev, [tab]: stickyIdx }));
        return;
      }
    }

    if (tab === 'delivered' && !hasInitializedDeliveredRef.current) {
      const todayIdx = deck.findIndex((item) => {
        const d = new Date(item.date || item.createdAt || '').toISOString().split('T')[0];
        return d === todayDateLabel;
      });
      setActiveIndexes((prev) => ({ ...prev, delivered: todayIdx >= 0 ? todayIdx : 0 }));
      hasInitializedDeliveredRef.current = true;
      return;
    }

    setActiveIndexes((prev) => ({
      ...prev,
      [tab]: ((prev[tab] % deck.length) + deck.length) % deck.length,
    }));
  };

  const todayDeckKey = todaySliderOrders
    .map((item) => String((item as any)?.order_id || (item as any)?.subscription_id || item?._id || '').trim())
    .join('|');
  const tomorrowDeckKey = tomorrowSliderOrders
    .map((item) => String((item as any)?.order_id || (item as any)?.subscription_id || item?._id || '').trim())
    .join('|');
  const deliveredDeckKey = deliveredSliderOrders
    .map((item) => String((item as any)?.order_id || (item as any)?.subscription_id || item?._id || '').trim())
    .join('|');

  useEffect(() => {
    syncTabIndex('today', todaySliderOrders);
  }, [todayDeckKey]);

  useEffect(() => {
    syncTabIndex('tomorrow', tomorrowSliderOrders);
  }, [tomorrowDeckKey]);

  useEffect(() => {
    syncTabIndex('delivered', deliveredSliderOrders);
  }, [deliveredDeckKey, todayDateLabel]);

  const activeDeck = activeTab === 'bulk' ? [] : decks[activeTab];
  const activeDeckLength = activeDeck.length;
  const rawIndex = activeTab === 'bulk' ? 0 : activeIndexes[activeTab] || 0;
  const normalizedActiveIndex = activeDeckLength
    ? ((rawIndex % activeDeckLength) + activeDeckLength) % activeDeckLength
    : 0;

  const currentOrder = activeDeckLength
    ? activeDeck[normalizedActiveIndex] || activeDeck[0] || null
    : null;

  useEffect(() => {
    if (!currentOrder) return;
    selectedByTabRef.current[activeTab] = String(
      (currentOrder as any)?.order_id ||
      (currentOrder as any)?.subscription_id ||
      (currentOrder as any)?._id ||
      '',
    ).trim();
  }, [currentOrder, activeTab]);

  const preparingCount = todayAllOrders.filter((item) => isPreparingStatus(item.status)).length;
  const outForDeliveryCount = todayAllOrders.filter((item) => isOutForDeliveryStatus(item.status)).length;
  const deliveredTodayCount = todayAllOrders.filter((item) => isDeliveredStatus(item.status)).length;

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

  const getStatusColor = (status: string) => {
    switch (String(status || '').toLowerCase()) {
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

  const goToPrev = () => {
    if (!activeDeckLength) return;
    setActiveIndexes((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] - 1 + activeDeckLength) % activeDeckLength,
    }));
  };

  const goToNext = () => {
    if (!activeDeckLength) return;
    setActiveIndexes((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] + 1) % activeDeckLength,
    }));
  };

  const renderOrderCard = (item: DashboardOrder | null) => {
    if (!item) {
      return (
        <View
          className="rounded-3xl p-6 mx-4 items-center justify-center"
          style={{
            minHeight: 430,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <Ionicons name="cube-outline" size={44} color={Colors.textTertiary} />
          <Text className="text-textSecondary text-base font-semibold mt-3">No orders in this tab</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => navigateToOrder(item)}
        className="rounded-3xl mx-4 shadow-lg overflow-hidden"
        style={{
          minHeight: 430,
          elevation: 6,
          shadowColor: item.delivery_mode === 'instant' ? '#2563EB' : '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: item.delivery_mode === 'instant' ? 0.15 : 0.08,
          shadowRadius: 12,
          borderWidth: 1,
          borderColor: item.delivery_mode === 'instant' ? '#2563EB' : '#EEF2FF',
          backgroundColor: '#fff',
        }}
      >
        <View className="w-full h-56 bg-slate-100">
          {getOrderImage(item) ? (
            <Image
              source={{ uri: getOrderImage(item) }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="restaurant-outline" size={36} color={Colors.textTertiary} />
            </View>
          )}
        </View>

        <View className="p-4">
          {item.delivery_mode === 'instant' ? (
            <View
              style={{
                position: 'absolute',
                top: 14,
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

          <DeliveryScheduleBanner order={item} now={now} />

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
                {getOrderQuantity(item) > 1 && (
                  <View className="mt-1 self-start px-2 py-0.5 rounded-full bg-blue-100">
                    <Text className="text-xs font-bold text-blue-800">×{getOrderQuantity(item)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: getStatusColor(item.status) + '15' }}>
              <Text className="text-xs font-semibold" style={{ color: getStatusColor(item.status) }}>
                {formatStatusLabel(item.status)}
              </Text>
            </View>
          </View>

          {item.delivery_mode === 'instant' ? (
            <View className="mt-1 mb-1.5 px-3 py-3 rounded-2xl" style={{ backgroundColor: '#1D4ED8' }}>
              <View className="flex-row items-center justify-center mb-1">
                <Ionicons name="flash" size={14} color="#BFDBFE" />
                <Text className="text-[10px] font-bold text-blue-100 ml-1 uppercase tracking-widest">
                  Instant • live timer
                </Text>
              </View>
              <Text className="text-3xl font-black text-white text-center tracking-wider">
                {formatCountdown(getInstantDeadline(item), now, { withSeconds: true }) || '—'}
              </Text>
              <Text className="text-[11px] text-blue-100 text-center mt-1">
                Swipe other cards above to compare time left
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center mb-1.5">
            <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
            <Text className="text-sm text-textSecondary ml-1.5" numberOfLines={1}>{item.user_name}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="call-outline" size={14} color={Colors.textTertiary} />
            <Text className="text-xs text-textTertiary ml-1.5" numberOfLines={1}>{item.user_phone}</Text>
          </View>

          {item.package_name && (
            <View className="flex-row items-center mt-2 bg-blue-50 rounded-lg px-2.5 py-1.5">
              <Ionicons name="cube-outline" size={14} color={Colors.info} />
              <Text className="text-xs ml-1.5" style={{ color: Colors.info }}>{item.package_name}</Text>
            </View>
          )}

          {getOrderAddress(item) ? (
            <View className="flex-row items-start mt-2 bg-slate-50 rounded-xl px-3 py-2">
              <Ionicons name="location-outline" size={14} color={Colors.info} style={{ marginTop: 2 }} />
              <Text className="text-xs text-textSecondary ml-2 flex-1" numberOfLines={2}>
                {getOrderAddress(item)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const tabs: Array<{ key: OrdersTab; label: string; count: number }> = [
    { key: 'today', label: 'Today', count: todaySliderOrders.length },
    { key: 'tomorrow', label: 'Tomorrow', count: tomorrowSliderOrders.length },
    { key: 'bulk', label: 'Bulk', count: bulkTabCount },
    { key: 'delivered', label: 'Delivered', count: deliveredSliderOrders.length },
  ];

  return (
    <SafeAreaView className="flex-1 bg-blue-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      <View className="w-full bg-blue-600 rounded-b-3xl pb-6 pt-8 px-6 mb-4 shadow-md" style={{ elevation: 6 }}>
        <Text className="text-2xl font-extrabold text-white mb-1 tracking-wide">Orders</Text>
        <Text className="text-base text-blue-100 mb-2">Track and manage your deliveries</Text>

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
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-4 mt-1">
          <PartnerOrderQueue
            dashboard={dashboard}
            now={now}
            onOrderPress={navigateToOrder}
            getOrderTitle={getOrderTitle}
            getOrderImage={getOrderImage}
            getOrderAddress={getOrderAddress}
          />

          <PendingBulkInquiriesBanner
            inquiries={bulkInquiries.filter((item) => item.status === 'submitted').slice(0, 1)}
            onUpdated={fetchDashboard}
          />

          <PendingBulkOrdersBanner
            orders={(dashboard?.pending_bulk_orders || []).slice(0, 1)}
            onNoted={fetchDashboard}
          />
        </View>

        <View className="mx-4 mb-3 rounded-xl px-2 py-2" style={{ backgroundColor: '#EAF0FF' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    className="h-10 rounded-lg items-center justify-center mx-1 px-4"
                    style={{ backgroundColor: active ? '#DBEAFE' : 'transparent', minWidth: 88 }}
                  >
                    <Text className="text-sm font-bold" style={{ color: active ? '#1D4ED8' : '#475569' }}>
                      {tab.label} {tab.count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {activeTab === 'bulk' ? (
          <View className="mx-4 mb-4">
            <BulkOrdersPanel
              orders={confirmedBulkOrders}
              awaitingOrders={awaitingBulkOrders}
              inquiries={bulkInquiries}
              onUpdated={fetchDashboard}
            />
          </View>
        ) : (
          <>
        <View style={{ minHeight: 440, justifyContent: 'center', marginBottom: 8 }}>
          {renderOrderCard(currentOrder)}
        </View>

        <View className="flex-row items-center justify-center mb-2">
          <TouchableOpacity
            onPress={goToPrev}
            className="w-12 h-12 rounded-full items-center justify-center mr-4"
            style={{ backgroundColor: '#FFE4E6' }}
            disabled={!activeDeckLength}
          >
            <Ionicons name="arrow-back" size={22} color="#E11D48" />
          </TouchableOpacity>

          <Text className="text-lg font-bold" style={{ color: Colors.textSecondary, minWidth: 70, textAlign: 'center' }}>
            {activeDeckLength ? `${normalizedActiveIndex + 1}/${activeDeckLength}` : '0/0'}
          </Text>

          <TouchableOpacity
            onPress={goToNext}
            className="w-12 h-12 rounded-full items-center justify-center ml-4"
            style={{ backgroundColor: '#DBEAFE' }}
            disabled={!activeDeckLength}
          >
            <Ionicons name="arrow-forward" size={22} color="#2563EB" />
          </TouchableOpacity>
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
