import { useEffect, useRef } from "react";
import { useAuthStore } from "store/authStore";
import api from "services/api";
import {
  getPushTokenLocally,
  registerForPushNotifications,
} from "services/pushNotificationService";

/**
 * Syncs the device push token with the backend whenever the user is authenticated.
 * Uses PUT /user/push-token (same endpoint as customer app — works for store_admin Users).
 */
export function useSyncPushToken() {
  const mounted = useRef(true);
  const { token: authToken } = useAuthStore();

  useEffect(() => {
    mounted.current = true;

    async function syncPushToken() {
      try {
        let token = await getPushTokenLocally();
        if (!token) token = await registerForPushNotifications();
        if (!token || !mounted.current) return;

        await api.put("/user/push-token", { push_token: token });
        console.log("✅ Store push token synced");
      } catch (err) {
        console.error("❌ Push token sync failed:", err);
      }
    }

    if (authToken) {
      const timeout = setTimeout(syncPushToken, 1500);
      return () => {
        mounted.current = false;
        clearTimeout(timeout);
      };
    }
  }, [authToken]);
}
