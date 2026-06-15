import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from 'store/authStore';
import { connectSocket, disconnectSocket, getSocket } from 'services/socket';
import { useNotificationStore } from 'store/notificationStore';
import { useStoreStore } from 'store/storeStore';
import { clearOngoingNextOrderActivity, tickOngoingOrderActivity } from 'services/ongoingOrderActivityService';
import {
  ensurePartnerNotificationSetup,
  handlePartnerNotificationResponse,
} from 'services/partnerNotificationActions';
import {
  alertIncomingOrder,
  clearIncomingOrderAlert,
  handleIncomingOrderStatusChange,
  normalizeIncomingOrderPayload,
  prepareIncomingOrderNotifications,
} from 'services/incomingOrderAlertService';
import { useSyncPushToken } from 'hooks/useSyncPushToken';
import { registerForPushNotifications } from 'services/pushNotificationService';
import AnimatedSplash from 'components/AnimatedSplash';
import Toast from 'react-native-toast-message';
import { debouncedDashboardRefresh } from 'utils/dashboardRefresh';
import '../global.css';

const handledOrderAlertAt = new Map<string, number>();
const ORDER_ALERT_DEDUPE_MS = 10000;

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data as Record<string, any> | undefined;
    const type = String(data?.type || '').toLowerCase();
    const isSilentSticky = type === 'ongoing_next_order' || data?.silent === true;

    return {
      shouldShowAlert: !isSilentSticky,
      shouldPlaySound: !isSilentSticky,
      shouldSetBadge: true,
      shouldShowBanner: !isSilentSticky,
      shouldShowList: true,
    };
  },
});

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchDashboard = useStoreStore((s) => s.fetchDashboard);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const dashboard = useStoreStore((s) => s.dashboard);
  const isOnline = useStoreStore((s) => s.isOnline);
  const appStateRef = useRef(AppState.currentState);

  const queueDashboardRefresh = () => {
    debouncedDashboardRefresh(() => fetchDashboard(), 800);
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
      fetchUnreadCount();
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
          fetchUnreadCount().catch(() => null);
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
        fetchUnreadCount().catch(() => null);
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
  }, [dashboard, fetchDashboard, fetchUnreadCount]);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket();
    if (!socket) return;

    const refreshStoreState = async (title: string, message: string) => {
      if (appStateRef.current === 'active') {
        Toast.show({
          type: 'success',
          text1: title,
          text2: message,
          position: 'top',
        });
      }
      queueDashboardRefresh();
      fetchUnreadCount().catch(() => null);
    };

    const onNewOrder = (payload: any) => {
      const isBulkOrder =
        String(payload?.type || '').toLowerCase() === 'bulk_order' ||
        payload?.subscription?.is_bulk_order === true;

      if (isBulkOrder) {
        const sub = payload?.subscription || {};
        const customerName =
          payload?.user?.name || sub?.user?.name || 'Customer';
        const deliveryDate = sub?.delivery_dates?.[0]?.date;
        const dateLabel = deliveryDate
          ? new Date(deliveryDate).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
          : 'Date TBD';
        refreshStoreState(
          'Bulk order confirmed',
          `${customerName} · ${dateLabel} · Check Bulk tab`,
        );
        return;
      }

      const normalized = normalizeIncomingOrderPayload(payload);
      const orderId = normalized?.orderId || '';
      if (!shouldHandleOrderAlert(orderId)) {
        queueDashboardRefresh();
        return;
      }

      alertIncomingOrder(payload, dashboard).catch((error) => {
        console.error('Failed to present new order notification', error);
      });

      refreshStoreState(
        normalized?.deliveryMode === 'instant' ? 'Instant order received' : 'New order received',
        normalized
          ? `Order #${normalized.orderId.slice(-6).toUpperCase()} • ${normalized.packageName}`
          : 'A new order has arrived',
      );
    };

    const onOrderUpdated = (payload: any) => {
      handleIncomingOrderStatusChange(payload, dashboard).catch(() => null);

      refreshStoreState(
        'Order updated',
        payload?.status ? `Status changed to ${String(payload.status).replaceAll('_', ' ')}` : 'An order changed',
      );
    };

    const onOrderCancelled = (payload: any) => {
      handleIncomingOrderStatusChange({
        ...payload,
        status: 'cancelled',
      }, dashboard).catch(() => null);

      refreshStoreState(
        'Order cancelled',
        payload?.subscription_id ? `Order #${String(payload.subscription_id).slice(-6).toUpperCase()} was cancelled` : 'An order was cancelled',
      );
    };

    const onDeliveryRescheduled = (payload: any) => {
      refreshStoreState(
        'Delivery rescheduled',
        payload?.subscription_id ? `Delivery updated for ${String(payload.subscription_id).slice(-6).toUpperCase()}` : 'A delivery was rescheduled',
      );
    };

    const onDeliveryStatus = (payload: any) => {
      handleIncomingOrderStatusChange(payload, dashboard).catch(() => null);
      refreshStoreState(
        'Delivery updated',
        payload?.status
          ? `Delivery is now ${String(payload.status).replaceAll('_', ' ')}`
          : 'Delivery status changed',
      );
    };

    const onStoreToggled = (payload: any) => {
      Toast.show({
        type: payload?.is_online ? 'success' : 'info',
        text1: payload?.is_online ? 'Store is online' : 'Store is offline',
        text2: payload?.status ? `Current status: ${payload.status}` : undefined,
        position: 'top',
      });
    };

    const onBulkInquiry = (payload: any) => {
      refreshStoreState(
        'New bulk inquiry',
        payload?.inquiry_number
          ? `${payload.inquiry_number} · ${payload.headcount || '?'} people`
          : 'A customer submitted a custom bulk request',
      );
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
  }, [token, dashboard, fetchDashboard, fetchUnreadCount]);

  useEffect(() => {
    if (!token) return;

    const intervalId = setInterval(() => {
      fetchDashboard();
    }, 20000);

    return () => {
      clearInterval(intervalId);
    };
  }, [token, fetchDashboard]);

  useEffect(() => {
    if (!token || !dashboard) return;

    const timerId = setInterval(() => {
      tickOngoingOrderActivity(dashboard, { isOnline }).catch(() => null);
    }, 1000);

    return () => clearInterval(timerId);
  }, [token, dashboard, isOnline]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
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
      <Toast />
    </>
  );
}
