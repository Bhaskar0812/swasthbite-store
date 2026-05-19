import { useEffect, useCallback } from 'react';
import {
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
import type { DashboardOrder } from 'types';

export default function DashboardScreen() {
  const { dashboard, isOnline, loading, fetchDashboard, toggleOnline } = useStoreStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    fetchDashboard();
  }, []);

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
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.push(`/order/${order._id}` as any)}
      className="bg-white rounded-2xl px-4 py-4 mb-3"
      style={{
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      }}
    >
      <View className="flex-row items-stretch">
        <View className="w-1.5 rounded-full mr-3" style={{ backgroundColor: Colors.info }} />

        <View className="w-16 mr-3">
          <View className="w-16 h-16 rounded-2xl overflow-hidden bg-blue-50 items-center justify-center">
            {order.image || order.package_image ? (
              <Image
                source={{ uri: order.image || order.package_image }}
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
                {order.meal_name || 'Order'}
              </Text>
              <Text className="text-xs text-textSecondary mt-1" numberOfLines={1}>
                {order.user_name}
              </Text>
            </View>

            <View
              className="px-3 py-1 rounded-full self-start"
              style={{ backgroundColor: (order.status === 'delivered' ? Colors.success : Colors.warning) + '15' }}
            >
              <Text
                className="text-[10px] font-bold capitalize"
                style={{ color: order.status === 'delivered' ? Colors.success : Colors.warning }}
              >
                {order.status}
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
                Today
              </Text>
            </View>
          </View>

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
        </View>
      </View>

    </TouchableOpacity>
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

        {/* Today's Orders */}
        {(dashboard?.today_orders?.length ?? 0) > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-textPrimary mb-2">Today's Orders ({dashboard!.today_orders.length})</Text>
            {dashboard!.today_orders.slice(0, 5).map((order) => (
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
            {dashboard!.tomorrow_orders.slice(0, 3).map((order) => (
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
