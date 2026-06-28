import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from 'store/authStore';
import { connectSocket, disconnectSocket, getSocket } from 'services/socket';
import { useStoreStore } from 'store/storeStore';
import { clearOngoingNextOrderActivity } from 'services/ongoingOrderActivityService';
import {
  ensurePartnerNotificationSetup,
  handlePartnerNotificationResponse,
} from 'services/partnerNotificationActions';
import {
  alertIncomingOrder,
  clearIncomingOrderAlert,
  handleIncomingOrderStatusChange,
  prepareIncomingOrderNotifications,
} from 'services/incomingOrderAlertService';
import PartnerOrderAlertHost from 'components/PartnerOrderAlertHost';
import { useSyncPushToken } from 'hooks/useSyncPushToken';
import { registerForPushNotifications } from 'services/pushNotificationService';
import AnimatedSplash from 'components/AnimatedSplash';
import Toast from 'react-native-toast-message';
import { debouncedDashboardRefresh } from 'utils/dashboardRefresh';
import '../global.css';

const handledOrderAlertAt = new Map<string, number>();
const ORDER_ALERT_DEDUPE_MS = 2500;

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data as Record<string, any> | undefined;
    const type = String(data?.type || data?.event || '').toLowerCase();
    const isOngoingActivity = type === 'ongoing_next_order';
    const isIncomingOrderPush =
      type === 'order_new' ||
      type === 'order:new' ||
      type === 'bulk_order_confirmed' ||
      type === 'bulk_order:confirmed';

    return {
      shouldShowAlert: isIncomingOrderPush,
      shouldPlaySound: isIncomingOrderPush,
      shouldSetBadge: isIncomingOrderPush,
      shouldShowBanner: isIncomingOrderPush,
      shouldShowList: isIncomingOrderPush && !isOngoingActivity,
    };
  },
});

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchDashboard = useStoreStore((s) => s.fetchDashboard);
  const refreshDashboardAndActivity = useStoreStore((s) => s.refreshDashboardAndActivity);
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const dashboard = useStoreStore((s) => s.dashboard);
  const isOnline = useStoreStore((s) => s.isOnline);
  const appStateRef = useRef(AppState.currentState);

  const queueDashboardRefresh = () => {
    debouncedDashboardRefresh(() => refreshDashboardAndActivity(), 800);
  };

  const shouldHandleOrderAlert = (orderId: string) => {
    const normalized = String(orderId || '').trim();
    if (!normalized) return true;
    const now = Date.now();
    const last = handledOrderAlertAt.get(normalized) || 0;
    if (now - last < ORDER_ALERT_DEDUPE_MS) return false;
    handledOrderAlertAt.set(normalized, now);
    return true;
  };

  // Sync push token with backend whenever authenticated
  useSyncPushToken();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        Notifications.setBadgeCountAsync(0).catch(() => null);
      }
    });
    Notifications.setBadgeCountAsync(0).catch(() => null);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function prepare() {
      await loadToken();
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
    prepare();
  }, []);

  useEffect(() => {
    if (token && user?._id) {
      registerForPushNotifications().catch(() => null);
      prepareIncomingOrderNotifications().catch(() => null);
      ensurePartnerNotificationSetup().catch(() => null);
      connectSocket(token, user._id);
      fetchDashboard().catch(() => null);
    } else if (!token) {
      disconnectSocket();
      clearOngoingNextOrderActivity();
      clearIncomingOrderAlert();
    }
    return () => {
      disconnectSocket();
    };
  }, [token, user?._id]);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data as Record<string, any> | undefined;
      if (!data) return;

      const content = notification?.request?.content;
      const eventType = String(data.type || data.event || '').toLowerCase();
      if (
        eventType === 'order_new' ||
        eventType === 'order:new' ||
        eventType === 'bulk_order_confirmed' ||
        eventType === 'bulk_order:confirmed' ||
        eventType === 'bulk_inquiry_new' ||
        eventType === 'bulk_inquiry:new'
      ) {
        if (
          eventType === 'bulk_order_confirmed' ||
          eventType === 'bulk_order:confirmed' ||
          eventType === 'bulk_inquiry_new' ||
          eventType === 'bulk_inquiry:new'
        ) {
          queueDashboardRefresh();
          if (appStateRef.current === 'active') {
            Toast.show({
              type: 'info',
              text1: content?.title || (eventType.includes('inquiry') ? 'New bulk inquiry' : 'Bulk order confirmed'),
              text2: String(content?.body || 'Open Bulk tab'),
              position: 'top',
            });
          }
          return;
        }

        const orderId = String(
          data.orderId || data.order_id || data.subscription_id || '',
        ).trim();
        if (!shouldHandleOrderAlert(orderId)) return;

        alertIncomingOrder(data, dashboard).catch(() => null);
        queueDashboardRefresh();
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      const type = String(data?.type || data?.event || '').toLowerCase();
      if (
        type === 'bulk_order_confirmed' ||
        type === 'bulk_order:confirmed' ||
        type === 'bulk_inquiry_new' ||
        type === 'bulk_inquiry:new' ||
        data?.tab === 'bulk'
      ) {
        router.push('/(tabs)/bulk' as any);
        return;
      }

      const handled = await handlePartnerNotificationResponse(response, {
        dashboard,
        onRefresh: async () => {
          await fetchDashboard();
        },
        navigateToOrder: (orderId, altIds) => {
          const candidates = [orderId, ...(altIds || [])]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
          const uniqueCandidates = Array.from(new Set(candidates));
          router.push({
            pathname: '/order/[id]' as any,
            params: {
              id: uniqueCandidates[0] || orderId,
              alts: uniqueCandidates.join(','),
              openAt: String(Date.now()),
            },
          });
        },
        navigateToOrdersTab: () => {
          router.push('/(tabs)/orders' as any);
        },
      });

      if (handled) return;

      const candidates = [
        data?._id,
        data?.subscription_id,
        data?.subscriptionId,
        data?.orderId,
        data?.order_id,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      const uniqueCandidates = Array.from(new Set(candidates));
      const orderId = uniqueCandidates[0] || '';
      if (!orderId || type === 'ongoing_next_order') return;

      router.push({
        pathname: '/order/[id]' as any,
        params: {
          id: orderId,
          alts: uniqueCandidates.join(','),
          openAt: String(Date.now()),
        },
      });
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [dashboard, fetchDashboard, refreshDashboardAndActivity]);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket();
    if (!socket) return;

    const refreshStoreState = async () => {
      queueDashboardRefresh();
    };

    const onNewOrder = (payload: any) => {
      const isBulkOrder =
        String(payload?.type || '').toLowerCase() === 'bulk_order' ||
        payload?.subscription?.is_bulk_order === true;

      if (isBulkOrder) {
        refreshStoreState();
        return;
      }

      alertIncomingOrder(payload, dashboard).catch((error) => {
        console.error('Failed to present new order notification', error);
      });

      refreshStoreState();
    };

    const onOrderUpdated = (payload: any) => {
      handleIncomingOrderStatusChange(payload, dashboard).catch(() => null);
      refreshStoreState();
    };

    const onOrderCancelled = (payload: any) => {
      handleIncomingOrderStatusChange({
        ...payload,
        status: 'cancelled',
      }, dashboard).catch(() => null);
      refreshStoreState();
    };

    const onDeliveryRescheduled = () => {
      refreshStoreState();
    };

    const onDeliveryStatus = (payload: any) => {
      handleIncomingOrderStatusChange(payload, dashboard).catch(() => null);
      refreshStoreState();
    };

    const onStoreToggled = (payload: any) => {
      Toast.show({
        type: payload?.is_online ? 'success' : 'info',
        text1: payload?.is_online ? 'Store is online' : 'Store is offline',
        text2: payload?.status ? `Current status: ${payload.status}` : undefined,
        position: 'top',
      });
    };

    const onBulkInquiry = () => {
      refreshStoreState();
    };

    socket.on('order:new', onNewOrder);
    socket.on('bulk_inquiry:new', onBulkInquiry);
    socket.on('order:updated', onOrderUpdated);
    socket.on('order:cancelled', onOrderCancelled);
    socket.on('delivery:status', onDeliveryStatus);
    socket.on('delivery:rescheduled', onDeliveryRescheduled);
    socket.on('store:toggled', onStoreToggled);

    socket.on('connect', () => {
      queueDashboardRefresh();
    });

    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('bulk_inquiry:new', onBulkInquiry);
      socket.off('order:updated', onOrderUpdated);
      socket.off('order:cancelled', onOrderCancelled);
      socket.off('delivery:status', onDeliveryStatus);
      socket.off('delivery:rescheduled', onDeliveryRescheduled);
      socket.off('store:toggled', onStoreToggled);
      socket.off('connect');
    };
  }, [token, dashboard, refreshDashboardAndActivity]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="order" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="bank-account" />
        <Stack.Screen name="store-hours" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="delete-account" />
      </Stack>
      {showSplash && (
        <AnimatedSplash onFinish={() => setShowSplash(false)} />
      )}
      <PartnerOrderAlertHost />
      <Toast />
    </>
  );
}
