
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
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
  const [swipeLane, setSwipeLane] = useState<'upcoming' | 'past'>('upcoming');
  const [upcomingCardIndex, setUpcomingCardIndex] = useState(0);
  const [pastCardIndex, setPastCardIndex] = useState(0);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const swipe = useRef(new Animated.ValueXY()).current;
  const screenWidth = Dimensions.get('window').width;
  const swipeThreshold = 110;

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
    return ['delivered', 'completed', 'cancelled', 'failed'].includes(status);
  };

  const isTerminalOrder = (item: DashboardOrder) => {
    const status = String(item.status || '').toLowerCase();
    return ['delivered', 'completed', 'cancelled', 'failed', 'skipped'].includes(status);
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

  const todayAllOrders = dashboard?.today_orders || [];
  const tomorrowAllOrders = dashboard?.tomorrow_orders || [];

  const todayOrders = todayAllOrders.filter((item) => !isTerminalOrder(item));
  const tomorrowOrders = tomorrowAllOrders.filter((item) => !isTerminalOrder(item));
  const pastOrders = sortOrders(
    [...todayAllOrders, ...tomorrowAllOrders].filter((item) => {
      const status = String(item.status || '').toLowerCase();
      return ['delivered', 'completed', 'cancelled', 'failed', 'skipped'].includes(status);
    }),
  );

  const upcomingOrders = useMemo(
    () => sortOrders([...todayOrders, ...tomorrowOrders]),
    [todayOrders, tomorrowOrders],
  );

  const laneOrders = swipeLane === 'upcoming' ? upcomingOrders : pastOrders;
  const activeIndex = swipeLane === 'upcoming' ? upcomingCardIndex : pastCardIndex;
  const currentOrder = laneOrders.length ? laneOrders[activeIndex % laneOrders.length] : null;
  const nextOrder = laneOrders.length
    ? laneOrders[(activeIndex + 1) % laneOrders.length]
    : null;

  const preparingCount = todayAllOrders.filter((item) => isPreparingStatus(item.status)).length;
  const outForDeliveryCount = todayAllOrders.filter((item) => isOutForDeliveryStatus(item.status)).length;
  const deliveredTodayCount = todayAllOrders.filter((item) => isDeliveredStatus(item.status)).length;

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

  const renderOrderCard = (item: DashboardOrder | null, isBehind = false) => {
    if (!item) {
      return (
        <View
          className="rounded-3xl p-6 mx-4 items-center justify-center"
          style={{
            minHeight: 460,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <Ionicons name="cube-outline" size={44} color={Colors.textTertiary} />
          <Text className="text-textSecondary text-base font-semibold mt-3">
            {swipeLane === 'upcoming' ? 'No upcoming orders' : 'No past orders'}
          </Text>
        </View>
      );
    }

    return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.push(`/order/${item.order_id || item._id}` as any)}
      className="rounded-3xl mx-4 shadow-lg overflow-hidden"
      style={{
        minHeight: 500,
        elevation: 6,
        shadowColor: item.delivery_mode === 'instant' ? '#2563EB' : '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isBehind ? 0.03 : item.delivery_mode === 'instant' ? 0.15 : 0.08,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: item.delivery_mode === 'instant' ? '#2563EB' : '#EEF2FF',
        backgroundColor: '#fff',
        opacity: isBehind ? 0.86 : 1,
        transform: [{ scale: isBehind ? 0.97 : 1 }],
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
      </View>
    </TouchableOpacity>
    );
  };

  const resetSwipePosition = () => {
    Animated.spring(swipe, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 7,
    }).start();
  };

  const completeSwipe = (direction: 'left' | 'right') => {
    const lane = direction === 'left' ? 'upcoming' : 'past';
    const list = lane === 'upcoming' ? upcomingOrders : pastOrders;

    setSwipeLane(lane);
    if (list.length > 0) {
      if (lane === 'upcoming') {
        setUpcomingCardIndex((prev) => (prev + 1) % list.length);
      } else {
        setPastCardIndex((prev) => (prev + 1) % list.length);
      }
    }

    swipe.setValue({ x: 0, y: 0 });
    setIsSwipeAnimating(false);
  };

  const forceSwipe = (direction: 'left' | 'right') => {
    if (isSwipeAnimating) return;
    setIsSwipeAnimating(true);

    const toX = direction === 'left' ? -screenWidth * 1.15 : screenWidth * 1.15;
    Animated.timing(swipe, {
      toValue: { x: toX, y: 0 },
      duration: 210,
      useNativeDriver: false,
    }).start(() => completeSwipe(direction));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: Animated.event([null, { dx: swipe.x, dy: swipe.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > swipeThreshold) {
          forceSwipe('right');
        } else if (gesture.dx < -swipeThreshold) {
          forceSwipe('left');
        } else {
          resetSwipePosition();
        }
      },
      onPanResponderTerminate: resetSwipePosition,
    }),
  ).current;

  const cardRotation = swipe.x.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const swipeCardStyle = {
    transform: [{ translateX: swipe.x }, { translateY: swipe.y }, { rotate: cardRotation }],
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-600" edges={['top']}>
      <StatusBar style="light" backgroundColor="#2563EB" />
      {/* Blue accent header */}
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

        <View className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Text className="text-blue-100 text-xs">Swipe Deck</Text>
          <Text className="text-white text-sm font-semibold">Left: Upcoming  |  Right: Past</Text>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: Colors.background }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboard} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row bg-blue-100 rounded-xl p-1 mt-2 mx-4 mb-4">
          {([
            { key: 'upcoming' as const, label: `Upcoming (${upcomingOrders.length})` },
            { key: 'past' as const, label: `Past (${pastOrders.length})` },
          ]).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSwipeLane(t.key)}
              className="flex-1 py-2.5 rounded-lg items-center"
              style={swipeLane === t.key ? { backgroundColor: '#2563EB' } : {}}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: swipeLane === t.key ? '#fff' : '#2563EB' }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs text-textTertiary mx-6 mb-2">
          Swipe left for upcoming, swipe right for past.
        </Text>

        <View style={{ minHeight: 520, justifyContent: 'center', marginBottom: 12 }}>
          <View style={{ position: 'absolute', width: '100%', paddingHorizontal: 0 }}>
            {renderOrderCard(nextOrder, true)}
          </View>
          <Animated.View {...panResponder.panHandlers} style={swipeCardStyle}>
            {renderOrderCard(currentOrder)}
          </Animated.View>
        </View>

        <View className="flex-row items-center justify-center mb-2">
          <TouchableOpacity
            onPress={() => forceSwipe('right')}
            className="w-12 h-12 rounded-full items-center justify-center mr-4"
            style={{ backgroundColor: '#FFE4E6' }}
          >
            <Ionicons name="arrow-back" size={22} color="#E11D48" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => forceSwipe('left')}
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: '#DBEAFE' }}
          >
            <Ionicons name="arrow-forward" size={22} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
