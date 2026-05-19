import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from 'store/authStore';
import { connectSocket, disconnectSocket, getSocket } from 'services/socket';
import { useNotificationStore } from 'store/notificationStore';
import { useStoreStore } from 'store/storeStore';
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
  const fetchDashboard = useStoreStore((s) => s.fetchDashboard);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);

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
    if (token) {
      connectSocket(token);
      fetchUnreadCount();
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [token]);

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

    const onNewOrder = (payload: any) => {
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
    socket.on('delivery:updated', onOrderUpdated);
    socket.on('store:toggled', onStoreToggled);

    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('order:updated', onOrderUpdated);
      socket.off('delivery:updated', onOrderUpdated);
      socket.off('store:toggled', onStoreToggled);
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
