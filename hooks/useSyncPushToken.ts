import { useEffect, useRef } from "react";
import { AppState } from "react-native";
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
        // Always try refreshing first, then fall back to local cached token.
        let token = await registerForPushNotifications();
        if (!token) token = await getPushTokenLocally();
        if (!token || !mounted.current) return;

        await api.put("/user/push-token", { push_token: token });
        console.log("✅ Store push token synced");
      } catch (err) {
        console.error("❌ Push token sync failed:", err);
      }
    }

    if (authToken) {
      const timeout = setTimeout(syncPushToken, 1200);
      const interval = setInterval(syncPushToken, 5 * 60 * 1000);
      const appStateSub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          syncPushToken().catch(() => null);
        }
      });

      return () => {
        mounted.current = false;
        clearTimeout(timeout);
        clearInterval(interval);
        appStateSub.remove();
      };
    }
  }, [authToken]);
}
