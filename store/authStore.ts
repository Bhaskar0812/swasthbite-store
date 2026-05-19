import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { StoreUser, OnboardingStatus } from "types";

type AuthState = {
  token: string | null;
  user: StoreUser | null;
  loginType: "store_admin" | "store_registration" | null;
  onboarding: OnboardingStatus | null;
  isLoading: boolean;
  login: (
    token: string,
    user: StoreUser,
    loginType: string,
    onboarding?: OnboardingStatus,
  ) => Promise<void>;
  setUser: (user: StoreUser) => void;
  setOnboarding: (onboarding: OnboardingStatus) => void;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loginType: null,
  onboarding: null,
  isLoading: true,

  login: async (token, user, loginType, onboarding) => {
    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    await SecureStore.setItemAsync("loginType", loginType);
    if (onboarding) {
      await SecureStore.setItemAsync("onboarding", JSON.stringify(onboarding));
    }
    set({
      token,
      user,
      loginType: loginType as any,
      onboarding: onboarding || null,
      isLoading: false,
    });
  },

  setUser: (user) => {
    set({ user });
    SecureStore.setItemAsync("user", JSON.stringify(user));
  },

  setOnboarding: (onboarding) => {
    set({ onboarding });
    SecureStore.setItemAsync("onboarding", JSON.stringify(onboarding));
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    await SecureStore.deleteItemAsync("loginType");
    await SecureStore.deleteItemAsync("onboarding");
    set({
      token: null,
      user: null,
      loginType: null,
      onboarding: null,
      isLoading: false,
    });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const userStr = await SecureStore.getItemAsync("user");
      const loginType = await SecureStore.getItemAsync("loginType");
      const onboardingStr = await SecureStore.getItemAsync("onboarding");
      const user = userStr ? JSON.parse(userStr) : null;
      const onboarding = onboardingStr ? JSON.parse(onboardingStr) : null;
      set({
        token,
        user,
        loginType: loginType as any,
        onboarding,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
