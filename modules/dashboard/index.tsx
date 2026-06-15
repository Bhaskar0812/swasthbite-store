import { useEffect, useCallback, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useStoreStore } from 'store/storeStore';
import { useAuthStore } from 'store/authStore';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import { transitionAcceptedOrder } from 'services/incomingOrderAlertService';
import PartnerOrderQueue from 'components/PartnerOrderQueue';
import DeliveryScheduleBanner from 'components/DeliveryScheduleBanner';
import PendingBulkOrdersBanner from 'components/PendingBulkOrdersBanner';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import {
  isHiddenStoreDelivery,
  sortStoreOrdersByDateAndSlot,
} from 'utils/orderActivity';
import type { DashboardOrder } from 'types';
import { pickImageUrl, resolveImageUrl } from 'utils/image';

export default function DashboardScreen() {
  const { dashboard, packages, isOnline, loading, fetchDashboard, fetchPackages, toggleOnline } = useStoreStore();
  const user = useAuthStore((s) => s.user);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  useEffect(() => {
    // Update clock less frequently to avoid dashboard jitter while swiping.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(() => {
    fetchDashboard();
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

  const getOrderQuantity = (order: DashboardOrder) => {
    const directQty = Number((order as any)?.quantity);
    if (Number.isFinite(directQty) && directQty > 0) return Math.floor(directQty);

    return (
      parseTrailingQuantity((order as any)?.meal_name) ||
      parseTrailingQuantity((order as any)?.package_name) ||
      1
    );
  };

  const getOrderTitle = (order: DashboardOrder) => {
    const baseTitle =
      stripTrailingQuantity(order.meal_name) ||
      stripTrailingQuantity(order.package_name) ||
      'Order';
    const qty = getOrderQuantity(order);
    return qty > 1 ? `${baseTitle} x${qty}` : baseTitle;
  };
  const getOrderImage = (order: DashboardOrder) => {
    const bundleImage =
      resolveImageUrl((order as any)?.bundle_items?.[0]?.image) ||
      resolveImageUrl((order as any)?.delivery_dates?.[0]?.bundle_items?.[0]?.image) ||
      resolveImageUrl((order as any)?.delivery_dates?.[0]?.meal_image);
    if (bundleImage) return bundleImage;

    const direct = pickImageUrl(order, [
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

    const packageId = String((order as any)?.package_id || (order as any)?.package?._id || '').trim();
    const packageName = normalizeText(order.package_name || (order as any)?.package?.name);

    const pkg = packages.find((p: any) => {
      const idMatch = packageId && String(p?._id || '').trim() === packageId;
      const nameMatch = packageName && normalizeText(p?.name) === packageName;
      return idMatch || nameMatch;
    });

    return pickImageUrl(pkg, ['image_url', 'image', 'thumbnail', 'photo', 'media.url', 'images']);
  };
  const isInstantOrder = (order: DashboardOrder) => order.delivery_mode === 'instant';
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const getInstantCountdown = (order: DashboardOrder) => {
    if (!isInstantOrder(order)) return '';

    const deadlineAt = order.instant_deadline_at
      ? new Date(order.instant_deadline_at).getTime()
      : order.createdAt
        ? new Date(order.createdAt).getTime() + 60 * 60 * 1000
        : 0;

    if (!deadlineAt) return 'Instant';

    const remainingMs = Math.max(0, deadlineAt - now);
    if (remainingMs <= 0) return 'Expired';

    const totalMinutes = Math.floor(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m left`;
    return 'Under 1m left';
  };

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
  const tomorrowOrders = sortOrders(
    (dashboard?.tomorrow_orders || []).filter((o) => !isHiddenStoreDelivery(o.status)),
    'asc',
  );

  const getOrderAddress = (order: DashboardOrder) =>
    order.delivery_address?.full_address ||
    order.delivery_address?.address ||
    order.address_snapshot?.full_address ||
    [
      order.address_snapshot?.workplace_name,
      order.address_snapshot?.floor,
      order.address_snapshot?.desk_number,
      order.address_snapshot?.city,
    ]
      .filter(Boolean)
      .join(', ');

  const formatOrderStatus = (status?: string) =>
    String(status || 'scheduled').replaceAll('_', ' ');

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

  const OrderItem = ({ order }: { order: DashboardOrder }) => (
    (() => {
      const localOrderKey = String((order as any)?._id || '').trim();
      const currentStatus = String(statusOverrides[localOrderKey] || order.status || '').toLowerCase();
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => navigateToOrder(order)}
          className="rounded-2xl px-4 py-4 mb-3"
          style={{
            elevation: 3,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            borderWidth: 1,
            borderColor: order.delivery_mode === 'instant' ? '#2563EB' : '#E5E7EB',
            backgroundColor: order.delivery_mode === 'instant' ? '#EFF6FF' : '#fff',
          }}
        >
          {order.delivery_mode === 'instant' ? (
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
          {(order as any)?.is_bulk_order ? (
            <View
              style={{
                position: 'absolute',
                top: order.delivery_mode === 'instant' ? 36 : 12,
                right: 16,
                backgroundColor: '#F59E0B',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                zIndex: 1,
              }}
            >
              <Text className="text-[10px] font-bold text-white">Bulk</Text>
            </View>
          ) : null}
          <View className="flex-row items-stretch">
            <View className="w-1.5 rounded-full mr-3" style={{ backgroundColor: Colors.info }} />

            <View className="w-16 mr-3">
              <View className="w-16 h-16 rounded-2xl overflow-hidden bg-blue-50 items-center justify-center">
                {getOrderImage(order) ? (
                  <Image
                    source={{ uri: getOrderImage(order) }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="restaurant-outline" size={22} color={Colors.info} />
                )}
              </View>
            </View>

            <View className="flex-1 min-w-0">
              <DeliveryScheduleBanner order={order} now={now} compact />

              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-textPrimary" numberOfLines={2}>
                    {getOrderTitle(order)}
                  </Text>
                  <Text className="text-xs text-textSecondary mt-1" numberOfLines={1}>
                    {order.user_name}
                  </Text>
                </View>

                <View
                  className="px-3 py-1 rounded-full self-start"
                  style={{ backgroundColor: (currentStatus === 'delivered' ? Colors.success : Colors.warning) + '15' }}
                >
                  <Text
                    className="text-[10px] font-bold capitalize"
                    style={{ color: currentStatus === 'delivered' ? Colors.success : Colors.warning }}
                  >
                    {currentStatus || order.status}
                  </Text>
                </View>
              </View>

              {order.delivery_mode === 'instant' ? (
                <View className="flex-row items-center mt-2 bg-blue-50 rounded-full px-3 py-2">
                  <Ionicons name="timer-outline" size={12} color={Colors.info} />
                  <Text className="text-[10px] font-semibold text-blue-700 ml-1" numberOfLines={1}>
                    {getInstantCountdown(order)}
                  </Text>
                </View>
              ) : null}

              {(() => {
                const address =
                  order.delivery_address?.full_address ||
                  order.delivery_address?.address ||
                  order.address_snapshot?.full_address ||
                  [
                    order.address_snapshot?.workplace_name,
                    order.address_snapshot?.floor,
                    order.address_snapshot?.desk_number,
                    order.address_snapshot?.city,
                  ]
                    .filter(Boolean)
                    .join(', ');

                return address ? (
                  <View className="mt-3 flex-row items-start rounded-xl bg-slate-50 px-3 py-2">
                    <Ionicons name="location-outline" size={14} color={Colors.info} style={{ marginTop: 2 }} />
                    <Text className="text-xs text-textSecondary ml-2 flex-1" numberOfLines={2}>
                      {address}
                    </Text>
                  </View>
                ) : null;
              })()}

              {dashboardNextActions(currentStatus).length ? (
                <View className="mt-3">
                  {dashboardNextActions(currentStatus).map((action) => {
                    const key = `${order._id}-${action.value}`;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          updateOrderStatus(order, action.value);
                        }}
                        disabled={Boolean(updatingOrder)}
                        className="mb-2 rounded-2xl px-3 py-3 flex-row items-center justify-center"
                        style={{
                          backgroundColor: action.value === 'out_for_delivery' ? '#E8F5E9' : '#DBEAFE',
                          borderWidth: 1,
                          borderColor: action.value === 'out_for_delivery' ? '#81C784' : '#60A5FA',
                          opacity: updatingOrder ? 0.6 : 1,
                        }}
                      >
                        <Ionicons
                          name={action.value === 'out_for_delivery' ? 'bicycle-outline' : 'checkmark-circle-outline'}
                          size={14}
                          color={action.value === 'out_for_delivery' ? '#1B5E20' : '#1D4ED8'}
                        />
                        <Text
                          className="text-xs font-bold ml-1.5"
                          style={{ color: action.value === 'out_for_delivery' ? '#1B5E20' : '#1D4ED8' }}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                currentStatus === 'out_for_delivery' ? (
                  <Text className="text-xs text-textTertiary mt-3">
                    Delivery partner will mark this order delivered.
                  </Text>
                ) : null
              )}
            </View>
          </View>

        </TouchableOpacity>
      );
    })()
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

        <PartnerOrderQueue
          dashboard={dashboard}
          now={now}
          onOrderPress={navigateToOrder}
          onQuickAction={(order, status) => updateOrderStatus(order, status)}
          updatingOrder={updatingOrder}
          statusOverrides={statusOverrides}
          getOrderTitle={getOrderTitle}
          getOrderImage={getOrderImage}
          getOrderAddress={getOrderAddress}
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

        {/* Today's Orders */}
        {(todayOrders.length > 0) && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-textPrimary mb-2">Today's Orders ({todayOrders.length})</Text>
            {todayOrders.slice(0, 5).map((order) => (
              <OrderItem key={order._id} order={order} />
            ))}
            {todayOrders.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} className="py-2 items-center">
                <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>View all orders</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tomorrow's Orders Preview */}
        {(tomorrowOrders.length > 0) && (
          <View className="mb-4">
            <Text className="text-base font-bold text-textPrimary mb-2">Tomorrow ({tomorrowOrders.length})</Text>
            {tomorrowOrders.slice(0, 3).map((order) => (
              <OrderItem key={order._id} order={order} />
            ))}
          </View>
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
