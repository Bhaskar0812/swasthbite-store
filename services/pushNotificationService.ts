import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const PUSH_TOKEN_KEY = "@store_push_token";

/**
 * Register for push notifications and return the Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const settings = await Notifications.getPermissionsAsync();

    if (settings.status === "undetermined") {
      const permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (permission.status !== "granted") return null;
    } else if (settings.status === "denied") {
      return null;
    }

    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("⚠️ EAS projectId not configured — push tokens unavailable");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    console.log("✅ Store push token:", token);

    // Create Android channels
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Orders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E23744",
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.error("❌ Push registration failed:", err);
    return null;
  }
}

export async function getPushTokenLocally(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}
