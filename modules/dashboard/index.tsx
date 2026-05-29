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
import { router } from 'expo-router';
import { useStoreStore } from 'store/storeStore';
import { useAuthStore } from 'store/authStore';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import type { DashboardOrder } from 'types';
import { pickImageUrl } from 'utils/image';

export default function DashboardScreen() {
  const { dashboard, packages, isOnline, loading, fetchDashboard, fetchPackages, toggleOnline } = useStoreStore();
  const user = useAuthStore((s) => s.user);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

  useEffect(() => {
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

  const getOrderTitle = (order: DashboardOrder) =>
    normalizeText(order.meal_name) || normalizeText(order.package_name) || 'Order';
  const getOrderImage = (order: DashboardOrder) => {
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

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m ${seconds}s left`;
    return `${seconds}s left`;
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

  const isFinalStatus = (status?: string) =>
    ['delivered', 'completed', 'cancelled', 'skipped', 'missed'].includes(String(status || '').toLowerCase());

  const getInstantDeadline = (order: DashboardOrder) => {
    if (!isInstantOrder(order)) return 0;
    if (order.instant_deadline_at) {
      const parsed = new Date(order.instant_deadline_at).getTime();
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    return createdAt ? createdAt + 60 * 60 * 1000 : 0;
  };

  const getActionableOrders = () =>
    [
      ...(dashboard?.today_orders || []),
      ...(dashboard?.tomorrow_orders || []),
    ].filter((order) => !isFinalStatus(order.status));

  const pickNextOrder = () => {
    const actionable = getActionableOrders();
    if (!actionable.length) return null;

    const instant = actionable
      .filter((order) => isInstantOrder(order))
      .sort((a, b) => {
        const aDeadline = getInstantDeadline(a);
        const bDeadline = getInstantDeadline(b);
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;
        return new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime();
      })[0];

    if (instant) return instant;

    return actionable.sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      return aDate - bDate;
    })[0];
  };

  const nextOrder = pickNextOrder();
  const preparingCount = (dashboard?.today_orders || []).filter((order) => String(order.status || '').toLowerCase() === 'preparing').length;
  const outForDeliveryCount = (dashboard?.today_orders || []).filter((order) => String(order.status || '').toLowerCase() === 'out_for_delivery').length;
  const deliveredTodayCount = (dashboard?.today_orders || []).filter((order) => ['delivered', 'completed'].includes(String(order.status || '').toLowerCase())).length;
  const pastDueInstantCount = (dashboard?.today_orders || []).filter((order) => {
    if (!isInstantOrder(order)) return false;
    const deadline = getInstantDeadline(order);
    return deadline > 0 && deadline <= now && !isFinalStatus(order.status);
  }).length;

  const resolveOrderApiIds = (order: DashboardOrder) => {
    const candidates = [
      (order as any)?.order_id,
      (order as any)?.subscription_id,
      (order as any)?.id,
      order?._id,
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

      await fetchDashboard();
      Alert.alert('Updated', 'Order status updated successfully.');
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

  const isDeliveredOrder = (order: DashboardOrder) => {
    const status = String(order.status || '').toLowerCase();
    return ['delivered', 'completed', 'cancelled'].includes(status);
  };

  const sortOrders = (orders: DashboardOrder[] = []) => {
    return [...orders].sort((a, b) => {
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

  const todayOrders = sortOrders(dashboard?.today_orders || []);
  const tomorrowOrders = sortOrders(dashboard?.tomorrow_orders || []);

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

  const OrderItem = ({ order, dateLabel = 'Today' }: { order: DashboardOrder; dateLabel?: string }) => (
    (() => {
      const localOrderKey = String((order as any)?._id || '').trim();
      const currentStatus = String(statusOverrides[localOrderKey] || order.status || '').toLowerCase();
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => router.push(`/order/${order.order_id || order._id}` as any)}
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

              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-center flex-1 pr-2">
                  <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
                  <Text className="text-xs text-textTertiary ml-1 capitalize" numberOfLines={1}>
                    {order.slot}
                  </Text>
                </View>

                <View className="flex-row items-center bg-blue-50 rounded-full px-2.5 py-1">
                  <Ionicons name="receipt-outline" size={12} color={Colors.info} />
                  <Text className="text-[10px] font-semibold text-blue-700 ml-1" numberOfLines={1}>
                    {dateLabel}
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
        <View className="flex-row items-center justify-between mb-6">
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

        {/* Live Order Activity */}
        <View className="bg-white rounded-3xl p-4 mb-4" style={{ borderWidth: 1, borderColor: '#DCE6FF' }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#E8EEFF' }}>
                <Ionicons name="notifications" size={18} color="#1D4ED8" />
              </View>
              <View className="ml-2">
                <Text className="text-sm font-semibold text-textSecondary">Live Activity</Text>
                <Text className="text-base font-bold text-textPrimary">Next order status board</Text>
              </View>
            </View>
            {pastDueInstantCount > 0 ? (
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEE2E2' }}>
                <Text className="text-[11px] font-bold" style={{ color: '#B91C1C' }}>
                  {pastDueInstantCount} urgent
                </Text>
              </View>
            ) : null}
          </View>

          {nextOrder ? (
            <View className="rounded-2xl p-3 mb-3" style={{ backgroundColor: isInstantOrder(nextOrder) ? '#EFF6FF' : '#F8FAFC' }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-textPrimary flex-1 pr-2" numberOfLines={1}>
                  {getOrderTitle(nextOrder)}
                </Text>
                <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
                  <Text className="text-[10px] font-semibold text-slate-700 capitalize">
                    {String(nextOrder.status || 'scheduled').replaceAll('_', ' ')}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-xs text-textSecondary" numberOfLines={1}>
                  {nextOrder.delivery_mode === 'instant' ? 'Instant order' : `Slot: ${nextOrder.slot || 'scheduled'}`}
                </Text>
                <View className="flex-row items-center">
                  <Ionicons name="timer-outline" size={13} color={Colors.info} />
                  <Text className="text-xs font-bold ml-1" style={{ color: Colors.info }}>
                    {getInstantCountdown(nextOrder) || 'Scheduled'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="rounded-2xl p-3 mb-3" style={{ backgroundColor: '#F8FAFC' }}>
              <Text className="text-sm text-textSecondary">No active order right now. Waiting for next order.</Text>
            </View>
          )}

          <View className="flex-row">
            <View className="flex-1 rounded-2xl px-3 py-2 mr-1" style={{ backgroundColor: '#EFF6FF' }}>
              <Text className="text-[11px] text-textSecondary">Preparing</Text>
              <Text className="text-lg font-bold" style={{ color: '#1D4ED8' }}>{preparingCount}</Text>
            </View>
            <View className="flex-1 rounded-2xl px-3 py-2 mx-1" style={{ backgroundColor: '#ECFDF3' }}>
              <Text className="text-[11px] text-textSecondary">Out for delivery</Text>
              <Text className="text-lg font-bold" style={{ color: '#047857' }}>{outForDeliveryCount}</Text>
            </View>
            <View className="flex-1 rounded-2xl px-3 py-2 ml-1" style={{ backgroundColor: '#FFF7ED' }}>
              <Text className="text-[11px] text-textSecondary">Delivered today</Text>
              <Text className="text-lg font-bold" style={{ color: '#C2410C' }}>{deliveredTodayCount}</Text>
            </View>
          </View>
        </View>

        {/* Today's Orders */}
        {(dashboard?.today_orders?.length ?? 0) > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-textPrimary mb-2">Today's Orders ({dashboard!.today_orders.length})</Text>
            {todayOrders.slice(0, 5).map((order) => (
              <OrderItem key={order._id} order={order} />
            ))}
            {dashboard!.today_orders.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} className="py-2 items-center">
                <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>View all orders</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tomorrow's Orders Preview */}
        {(dashboard?.tomorrow_orders?.length ?? 0) > 0 && (
          <View className="mb-4">
            <Text className="text-base font-bold text-textPrimary mb-2">Tomorrow ({dashboard!.tomorrow_orders.length})</Text>
            {tomorrowOrders.slice(0, 3).map((order) => (
              <OrderItem key={order._id} order={order} dateLabel="Tomorrow" />
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
