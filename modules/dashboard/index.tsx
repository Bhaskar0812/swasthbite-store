import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
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
import { transitionAcceptedOrder } from 'services/incomingOrderAlertService';
import LiveOrderActivityBoard from 'components/LiveOrderActivityBoard';
import { formatCountdown } from 'utils/orderActivity';
import type { DashboardOrder } from 'types';
import { pickImageUrl, resolveImageUrl } from 'utils/image';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { dashboard, packages, isOnline, loading, fetchDashboard, fetchPackages, toggleOnline } = useStoreStore();
  const user = useAuthStore((s) => s.user);
  const [now, setNow] = useState(Date.now());
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchDashboard();
    fetchPackages();
  }, []);

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
  const upcomingDeck = [
    ...todayOrders.filter((o) => !isDeliveredOrder(o)),
    ...tomorrowOrders.filter((o) => !isDeliveredOrder(o)),
  ];
  const pastDeck = [
    ...todayOrders.filter((o) => isDeliveredOrder(o)),
    ...tomorrowOrders.filter((o) => isDeliveredOrder(o)),
  ];

  const [swipeLane, setSwipeLane] = useState<'upcoming' | 'past'>('upcoming');
  const [upcomingIndex, setUpcomingIndex] = useState(0);
  const [pastIndex, setPastIndex] = useState(0);
  const [laneHistory, setLaneHistory] = useState<Array<{ lane: 'upcoming' | 'past'; index: number }>>([]);
  const [isSwipeGestureActive, setIsSwipeGestureActive] = useState(false);
  const swipeAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const swipeGestureLockRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const hasInitializedUpcomingStartRef = useRef(false);
  const selectedUpcomingCardIdRef = useRef('');
  const selectedPastCardIdRef = useRef('');
  const upcomingDeckKey = upcomingDeck
    .map((order) => String((order as any)?._id || (order as any)?.subscription_id || (order as any)?.order_id || '').trim())
    .join('|');
  const pastDeckKey = pastDeck
    .map((order) => String((order as any)?._id || (order as any)?.subscription_id || (order as any)?.order_id || '').trim())
    .join('|');

  useEffect(() => {
    if (upcomingDeck.length === 0) {
      setUpcomingIndex(0);
      hasInitializedUpcomingStartRef.current = false;
      selectedUpcomingCardIdRef.current = '';
      return;
    }

    if (hasInitializedUpcomingStartRef.current) {
      const selectedId = selectedUpcomingCardIdRef.current;
      if (selectedId) {
        const stickyIdx = upcomingDeck.findIndex((order) => {
          const id = String((order as any)?._id || (order as any)?.subscription_id || (order as any)?.order_id || '').trim();
          return id === selectedId;
        });

        if (stickyIdx >= 0) {
          setUpcomingIndex(stickyIdx);
          return;
        }
      }

      setUpcomingIndex((prev) => ((prev % upcomingDeck.length) + upcomingDeck.length) % upcomingDeck.length);
      return;
    }

    const preparingIndex = upcomingDeck.findIndex(
      (order) => String(order.status || '').toLowerCase() === 'preparing',
    );

    if (preparingIndex >= 0) {
      setUpcomingIndex(preparingIndex);
      return;
    }

    const mostRecentIndex = upcomingDeck.reduce((bestIdx, order, idx, list) => {
      const best = list[bestIdx];
      const orderTs = new Date(order.createdAt || order.date || 0).getTime();
      const bestTs = new Date(best.createdAt || best.date || 0).getTime();
      return orderTs > bestTs ? idx : bestIdx;
    }, 0);

    setUpcomingIndex(mostRecentIndex);
    hasInitializedUpcomingStartRef.current = true;
  }, [upcomingDeckKey]);

  useEffect(() => {
    if (pastDeck.length > 0) {
      const selectedId = selectedPastCardIdRef.current;
      if (selectedId) {
        const stickyIdx = pastDeck.findIndex((order) => {
          const id = String((order as any)?._id || (order as any)?.subscription_id || (order as any)?.order_id || '').trim();
          return id === selectedId;
        });
        if (stickyIdx >= 0) {
          setPastIndex(stickyIdx);
          return;
        }
      }

      setPastIndex((prev) => ((prev % pastDeck.length) + pastDeck.length) % pastDeck.length);
    } else {
      setPastIndex(0);
      selectedPastCardIdRef.current = '';
    }
  }, [pastDeckKey]);

  useEffect(() => {
    if (swipeLane === 'upcoming' && upcomingDeck.length === 0 && pastDeck.length > 0) {
      setSwipeLane('past');
    }
    if (swipeLane === 'past' && pastDeck.length === 0 && upcomingDeck.length > 0) {
      setSwipeLane('upcoming');
    }
  }, [swipeLane, upcomingDeck.length, pastDeck.length]);

  const activeDeck = swipeLane === 'upcoming' ? upcomingDeck : pastDeck;
  const activeIndex = swipeLane === 'upcoming' ? upcomingIndex : pastIndex;
  const activeDeckLength = activeDeck.length;
  const normalizedActiveIndex = activeDeckLength
    ? ((activeIndex % activeDeckLength) + activeDeckLength) % activeDeckLength
    : 0;
  const activeCard = activeDeckLength
    ? activeDeck[normalizedActiveIndex] || activeDeck[0] || null
    : null;
  const activeCardKey = String((activeCard as any)?._id || (activeCard as any)?.order_id || '').trim();

  useEffect(() => {
    // If deck has cards but resolved active card is missing, loop back to first card.
    if (activeDeckLength > 0 && !activeCard) {
      if (swipeLane === 'upcoming') setUpcomingIndex(0);
      else setPastIndex(0);
      swipeAnim.setValue({ x: 0, y: 0 });
    }
  }, [activeDeckLength, activeCard, swipeLane, swipeAnim]);

  useEffect(() => {
    // Always snap card back to center when lane/card changes to avoid off-screen blank state.
    if (!isSwipeGestureActive) {
      swipeAnim.stopAnimation();
      swipeAnim.setValue({ x: 0, y: 0 });
    }
  }, [activeCardKey, normalizedActiveIndex, swipeLane, isSwipeGestureActive, swipeAnim]);

  useEffect(() => {
    if (!activeCard) return;
    const id = String((activeCard as any)?._id || (activeCard as any)?.subscription_id || (activeCard as any)?.order_id || '').trim();
    if (!id) return;

    if (swipeLane === 'upcoming') selectedUpcomingCardIdRef.current = id;
    else selectedPastCardIdRef.current = id;
  }, [activeCard, swipeLane]);
  const activeCardStatus = String(
    activeCard
      ? statusOverrides[String((activeCard as any)?._id || '').trim()] || activeCard.status || ''
      : '',
  ).toLowerCase();
  const activeCardAction = activeCard ? dashboardNextActions(activeCardStatus)[0] : null;

  const applySwipeDirection = (direction: 'left' | 'right') => {
    const targetLane: 'upcoming' | 'past' = direction === 'left' ? 'upcoming' : 'past';

    if (targetLane === swipeLane) {
      if (targetLane === 'upcoming' && upcomingDeck.length > 0) {
        setUpcomingIndex((prev) => (prev + 1) % upcomingDeck.length);
      }
      if (targetLane === 'past' && pastDeck.length > 0) {
        setPastIndex((prev) => (prev + 1) % pastDeck.length);
      }
      return;
    }

    setLaneHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.lane === targetLane) {
        if (targetLane === 'upcoming' && upcomingDeck.length > 0) {
          setUpcomingIndex(last.index % upcomingDeck.length);
        }
        if (targetLane === 'past' && pastDeck.length > 0) {
          setPastIndex(last.index % pastDeck.length);
        }
        return prev.slice(0, -1);
      }

      return [...prev, { lane: swipeLane, index: activeIndex }];
    });

    setSwipeLane(targetLane);
  };

  const goToPrevCard = () => {
    if (swipeLane === 'upcoming' && upcomingDeck.length > 0) {
      setUpcomingIndex((prev) => (prev - 1 + upcomingDeck.length) % upcomingDeck.length);
      return;
    }
    if (swipeLane === 'past' && pastDeck.length > 0) {
      setPastIndex((prev) => (prev - 1 + pastDeck.length) % pastDeck.length);
    }
  };

  const goToNextCard = () => {
    if (swipeLane === 'upcoming' && upcomingDeck.length > 0) {
      setUpcomingIndex((prev) => (prev + 1) % upcomingDeck.length);
      return;
    }
    if (swipeLane === 'past' && pastDeck.length > 0) {
      setPastIndex((prev) => (prev + 1) % pastDeck.length);
    }
  };

  const triggerSwipe = (direction: 'left' | 'right') => {
    if (!activeCard) return;
    swipeAnim.stopAnimation();
    const toX = direction === 'left' ? -width : width;
    Animated.timing(swipeAnim, {
      toValue: { x: toX, y: 0 },
      duration: 130,
      useNativeDriver: false,
    }).start(() => {
      swipeAnim.setValue({ x: 0, y: 0 });
      applySwipeDirection(direction);
    });
  };

  const swipeResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      const absDx = Math.abs(gestureState.dx);
      const absDy = Math.abs(gestureState.dy);

      if (swipeGestureLockRef.current === 'vertical') return false;
      if (swipeGestureLockRef.current === 'horizontal') return true;

      if (absDx < 10 && absDy < 10) return false;

      if (absDx > 12 && absDx > absDy * 1.35) {
        swipeGestureLockRef.current = 'horizontal';
        return true;
      }

      if (absDy > absDx) {
        swipeGestureLockRef.current = 'vertical';
      }

      return false;
    },
    onPanResponderGrant: () => {
      setIsSwipeGestureActive(true);
      swipeAnim.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      const clampedDx = Math.max(-width * 0.9, Math.min(width * 0.9, gestureState.dx));
      swipeAnim.setValue({ x: clampedDx, y: 0 });
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderRelease: (_, gestureState) => {
      setIsSwipeGestureActive(false);
      swipeGestureLockRef.current = 'none';
      const shouldSwipe = Math.abs(gestureState.dx) > Math.max(40, width * 0.14) || Math.abs(gestureState.vx) > 0.2;
      if (shouldSwipe) {
        triggerSwipe(gestureState.dx < 0 ? 'left' : 'right');
        return;
      }
      Animated.spring(swipeAnim, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }).start();
    },
    onPanResponderTerminate: () => {
      setIsSwipeGestureActive(false);
      swipeGestureLockRef.current = 'none';
      Animated.spring(swipeAnim, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }).start();
    },
  });

  const swipeTranslateX = swipeAnim.x.interpolate({
    inputRange: [-width, width],
    outputRange: [-width, width],
    extrapolate: 'clamp',
  });

  const swipeRotation = swipeAnim.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-4deg', '0deg', '4deg'],
    extrapolate: 'clamp',
  });
  const incomingNextTranslateX = swipeAnim.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0, width * 0.22, width * 0.22],
    extrapolate: 'clamp',
  });
  const incomingPrevTranslateX = swipeAnim.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [-width * 0.22, -width * 0.22, 0],
    extrapolate: 'clamp',
  });
  const incomingNextOpacity = swipeAnim.x.interpolate({
    inputRange: [-width, -30, 0, width],
    outputRange: [0.95, 0.45, 0, 0],
    extrapolate: 'clamp',
  });
  const incomingPrevOpacity = swipeAnim.x.interpolate({
    inputRange: [-width, 0, 30, width],
    outputRange: [0, 0, 0.45, 0.95],
    extrapolate: 'clamp',
  });
  const incomingNextScale = swipeAnim.x.interpolate({
    inputRange: [-width, 0],
    outputRange: [1, 0.97],
    extrapolate: 'clamp',
  });
  const incomingPrevScale = swipeAnim.x.interpolate({
    inputRange: [0, width],
    outputRange: [0.97, 1],
    extrapolate: 'clamp',
  });
  const scrollIndicatorWidth = scrollY.interpolate({
    inputRange: [0, 900],
    outputRange: [32, Math.max(32, width - 64)],
    extrapolate: 'clamp',
  });
  const scrollIndicatorOpacity = scrollY.interpolate({
    inputRange: [0, 20, 120],
    outputRange: [0.4, 0.95, 1],
    extrapolate: 'clamp',
  });

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

  const formatOrderDate = (order: DashboardOrder) => {
    const value = order.date || order.createdAt;
    if (!value) return 'Today';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Today';
    return parsed.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const formatOrderStatus = (status?: string) =>
    String(status || 'scheduled').replaceAll('_', ' ');

  const formatSlotLabel = (order: DashboardOrder) => {
    if (order.delivery_mode === 'instant') return 'Instant';
    const slot = String(order.slot || 'scheduled').trim();
    return slot ? slot.charAt(0).toUpperCase() + slot.slice(1) : 'Scheduled';
  };

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
      <Animated.ScrollView
        scrollEnabled={!isSwipeGestureActive}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
      >
        <View className="mb-3">
          <View
            style={{
              height: 4,
              borderRadius: 999,
              backgroundColor: '#E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                height: 4,
                width: scrollIndicatorWidth,
                opacity: scrollIndicatorOpacity,
                borderRadius: 999,
                backgroundColor: '#1D4ED8',
              }}
            />
          </View>
        </View>

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

        <LiveOrderActivityBoard
          dashboard={dashboard}
          onOrderPress={navigateToOrder}
        />

        {/* Dashboard Swipe Deck */}
        <View className="bg-white rounded-3xl p-4 mb-4" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-textPrimary">Swipe Orders</Text>
            <View className="flex-row items-center">
              <View
                className="px-2.5 py-1 rounded-full mr-1"
                style={{ backgroundColor: swipeLane === 'upcoming' ? '#DBEAFE' : '#F1F5F9' }}
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: swipeLane === 'upcoming' ? '#1D4ED8' : '#64748B' }}
                >
                  Next {upcomingDeck.length}
                </Text>
              </View>
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: swipeLane === 'past' ? '#DCFCE7' : '#F1F5F9' }}
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: swipeLane === 'past' ? '#047857' : '#64748B' }}
                >
                  Prev {pastDeck.length}
                </Text>
              </View>
            </View>
          </View>

          {activeCard ? (
            <>
              <View>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => navigateToOrder(activeCard)}
                  className="rounded-3xl overflow-hidden"
                  style={{ borderWidth: 1, borderColor: '#DCE6FF', backgroundColor: '#F8FAFF' }}
                >
                  <View className="h-44 bg-blue-50 items-center justify-center">
                    {getOrderImage(activeCard) ? (
                      <Image
                        source={{ uri: getOrderImage(activeCard) }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="restaurant-outline" size={34} color={Colors.info} />
                    )}
                  </View>
                  <View className="p-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-lg font-bold text-textPrimary flex-1 pr-2" numberOfLines={2}>
                        {getOrderTitle(activeCard)}
                      </Text>
                      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEF3C7' }}>
                        <Text className="text-[10px] font-extrabold text-amber-800 capitalize">
                          {formatOrderStatus(activeCard.status)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-textSecondary mb-1" numberOfLines={1}>
                      {activeCard.user_name || 'Customer'}
                    </Text>

                    <View className="flex-row flex-wrap mb-2 mt-1">
                      <View className="px-2.5 py-1 rounded-full mr-2 mb-1" style={{ backgroundColor: '#DBEAFE' }}>
                        <Text className="text-[11px] font-extrabold" style={{ color: '#1D4ED8' }}>
                          SLOT: {formatSlotLabel(activeCard)}
                        </Text>
                      </View>
                      <View className="px-2.5 py-1 rounded-full mr-2 mb-1" style={{ backgroundColor: '#FEF3C7' }}>
                        <Text className="text-[11px] font-extrabold" style={{ color: '#92400E' }}>
                          STATUS: {formatOrderStatus(activeCard.status)}
                        </Text>
                      </View>
                      <View className="px-2.5 py-1 rounded-full mb-1" style={{ backgroundColor: '#EDE9FE' }}>
                        <Text className="text-[11px] font-extrabold" style={{ color: '#5B21B6' }}>
                          DATE: {formatOrderDate(activeCard)}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs text-textSecondary mb-2" numberOfLines={2}>
                      {getOrderAddress(activeCard) || 'Address pending'}
                    </Text>
                    {activeCard.delivery_mode === 'instant' ? (
                      <View className="rounded-2xl px-3 py-3 mb-2" style={{ backgroundColor: '#1D4ED8' }}>
                        <Text className="text-[10px] font-bold text-blue-100 text-center uppercase">
                          Time left
                        </Text>
                        <Text className="text-2xl font-black text-white text-center mt-1">
                          {formatCountdown(getInstantDeadline(activeCard), now, { withSeconds: true }) || '—'}
                        </Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-textTertiary" numberOfLines={1}>
                        {activeCard.delivery_mode === 'instant' ? 'Instant order' : 'Scheduled order'}
                      </Text>
                      <Text className="text-xs font-semibold" style={{ color: Colors.info }}>
                        Tap for details
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {activeDeckLength > 1 ? (
                <View className="flex-row items-center justify-between mt-3">
                  <TouchableOpacity
                    onPress={goToPrevCard}
                    className="h-9 px-3 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#86EFAC' }}
                  >
                    <Ionicons name="arrow-back" size={14} color="#047857" />
                    <Text className="text-xs font-bold ml-1" style={{ color: '#047857' }}>Prev</Text>
                  </TouchableOpacity>
                  <Text className="text-xs font-semibold" style={{ color: Colors.textSecondary }}>
                    {normalizedActiveIndex + 1}/{activeDeckLength}
                  </Text>
                  <TouchableOpacity
                    onPress={goToNextCard}
                    className="h-9 px-3 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD' }}
                  >
                    <Text className="text-xs font-bold mr-1" style={{ color: '#1D4ED8' }}>Next</Text>
                    <Ionicons name="arrow-forward" size={14} color="#1D4ED8" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between mt-4">
                <TouchableOpacity
                  onPress={() => navigateToOrder(activeCard)}
                  className="h-11 px-4 rounded-2xl flex-row items-center justify-center"
                  style={{ backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#A5B4FC' }}
                >
                  <Ionicons name="open-outline" size={16} color="#4338CA" />
                  <Text className="text-xs font-bold ml-1" style={{ color: '#4338CA' }}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!activeCardAction) return;
                    updateOrderStatus(activeCard, activeCardAction.value);
                  }}
                  className="h-11 px-4 rounded-2xl flex-row items-center justify-center"
                  disabled={!activeCardAction || Boolean(updatingOrder)}
                  style={{
                    backgroundColor: activeCardAction ? '#E8F5E9' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: activeCardAction ? '#81C784' : '#CBD5E1',
                    opacity: !activeCardAction || updatingOrder ? 0.6 : 1,
                  }}
                >
                  <Ionicons
                    name={activeCardAction?.value === 'out_for_delivery' ? 'bicycle-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color={activeCardAction ? '#1B5E20' : '#64748B'}
                  />
                  <Text className="text-xs font-bold ml-1" style={{ color: activeCardAction ? '#1B5E20' : '#64748B' }}>
                    {activeCardAction ? activeCardAction.label : 'No Action'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC' }}>
              <Text className="text-sm text-textSecondary">No orders available for swipe right now.</Text>
            </View>
          )}
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
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
