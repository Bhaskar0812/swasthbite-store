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
import { clearOngoingNextOrderActivity } from 'services/ongoingOrderActivityService';
import { useSyncPushToken } from 'hooks/useSyncPushToken';
import AnimatedSplash from 'components/AnimatedSplash';
import Toast from 'react-native-toast-message';
import '../global.css';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchDashboard = useStoreStore((s) => s.fetchDashboard);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const lastNotifiedOrderRef = useRef<string>('');
  const ringTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Sync push token with backend whenever authenticated
  useSyncPushToken();

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
      connectSocket(token, user._id);
      fetchUnreadCount();
    } else if (!token) {
      disconnectSocket();
      clearOngoingNextOrderActivity();
    }
    return () => {
      disconnectSocket();
    };
  }, [token, user?._id]);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      const orderId = String(data?.orderId || '').trim();
      if (!orderId) return;
      router.push(`/order/${orderId}` as any);
    });

    return () => {
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket();
    if (!socket) return;

    const refreshStoreState = async (title: string, message: string) => {
      Toast.show({
        type: 'success',
        text1: title,
        text2: message,
        position: 'top',
      });
      await Promise.all([fetchDashboard(), fetchUnreadCount()]);
    };

    const ensureOrdersChannel = async () => {
      if (Platform.OS !== 'android') return;
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 250, 400, 250, 400],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
    };

    const presentNewOrderNotification = async (payload: any) => {
      const orderId = String(payload?.order_id ?? payload?.subscription_id ?? '').trim();
      if (orderId && lastNotifiedOrderRef.current === orderId) return;
      if (orderId) lastNotifiedOrderRef.current = orderId;

      await ensureOrdersChannel();

      const message = payload?.subscription_id
        ? `Order #${String(payload.subscription_id).slice(-6).toUpperCase()} is waiting for acceptance`
        : 'A new order has arrived';

      const status = String(payload?.status || payload?.delivery_status || 'pending').replaceAll('_', ' ');
      const timerText = payload?.instant_deadline_at
        ? `Accept before ${new Date(payload.instant_deadline_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
        : 'Please accept and start preparing';

      const scheduleAlert = async (title: string, body: string) => {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            badge: 1,
            data: { orderId },
            ...(Platform.OS === 'android'
              ? {
                channelId: 'orders',
                priority: Notifications.AndroidNotificationPriority.MAX,
                sticky: true,
                autoDismiss: false,
              }
              : {}),
          },
          trigger: null,
        });
      };

      await scheduleAlert('New order received', `${message} • ${timerText}`);

      const repeatTimeout = setTimeout(() => {
        scheduleAlert('Reminder: New order', `Status: ${status}. ${timerText}`).catch(() => null);
      }, 3500);
      ringTimeoutsRef.current.push(repeatTimeout);
    };

    const onNewOrder = (payload: any) => {
      presentNewOrderNotification(payload).catch((error) => {
        console.error('Failed to present new order notification', error);
      });

      refreshStoreState(
        'New order received',
        payload?.subscription_id ? `Order #${String(payload.subscription_id).slice(-6).toUpperCase()} is ready` : 'A new order has arrived',
      );
    };

    const onOrderUpdated = (payload: any) => {
      refreshStoreState(
        'Order updated',
        payload?.status ? `Status changed to ${String(payload.status).replaceAll('_', ' ')}` : 'An order changed',
      );
    };

    const onOrderCancelled = (payload: any) => {
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

    const onStoreToggled = (payload: any) => {
      Toast.show({
        type: payload?.is_online ? 'success' : 'info',
        text1: payload?.is_online ? 'Store is online' : 'Store is offline',
        text2: payload?.status ? `Current status: ${payload.status}` : undefined,
        position: 'top',
      });
    };

    socket.on('order:new', onNewOrder);
    socket.on('order:updated', onOrderUpdated);
    socket.on('order:cancelled', onOrderCancelled);
    socket.on('delivery:updated', onOrderUpdated);
    socket.on('delivery:rescheduled', onDeliveryRescheduled);
    socket.on('store:toggled', onStoreToggled);

    socket.on('connect', () => {
      fetchDashboard();
    });

    return () => {
      ringTimeoutsRef.current.forEach((timerId) => clearTimeout(timerId));
      ringTimeoutsRef.current = [];
      socket.off('order:new', onNewOrder);
      socket.off('order:updated', onOrderUpdated);
      socket.off('order:cancelled', onOrderCancelled);
      socket.off('delivery:updated', onOrderUpdated);
      socket.off('delivery:rescheduled', onDeliveryRescheduled);
      socket.off('store:toggled', onStoreToggled);
      socket.off('connect');
    };
  }, [token, fetchDashboard, fetchUnreadCount]);

  useEffect(() => {
    Notifications.setBadgeCountAsync(0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') Notifications.setBadgeCountAsync(0);
    });
    return () => sub.remove();
  }, []);

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
