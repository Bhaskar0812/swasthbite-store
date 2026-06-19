import { create } from "zustand";
import { storeService } from "services/storeService";
import { syncOngoingNextOrderActivity } from "services/ongoingOrderActivityService";
import type { DashboardData, MenuItem, Package } from "types";

const unwrapData = <T>(payload: any): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T;
  }
  return payload as T;
};

type StoreState = {
  dashboard: DashboardData | null;
  menuItems: MenuItem[];
  packages: Package[];
  isOnline: boolean;
  loading: boolean;

  fetchDashboard: () => Promise<void>;
  refreshDashboardAndActivity: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchPackages: () => Promise<void>;
  toggleOnline: () => Promise<void>;
  toggleItemStock: (itemId: string, available: boolean) => Promise<void>;
  toggleItemInstantAvailability: (
    itemId: string,
    available: boolean,
  ) => Promise<void>;
  togglePackage: (packageId: string) => Promise<void>;
};

export const useStoreStore = create<StoreState>((set, get) => ({
  dashboard: null,
  menuItems: [],
  packages: [],
  isOnline: false,
  loading: false,

  fetchDashboard: async () => {
    set({ loading: true });
    try {
      const res = await storeService.getDashboard();
      const dashboardData = unwrapData<DashboardData | null>(res) || null;
      set({
        dashboard: dashboardData,
        isOnline: dashboardData?.is_online ?? false,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  refreshDashboardAndActivity: async () => {
    await get().fetchDashboard();
    const dashboard = get().dashboard;
    if (!dashboard) return;
    await syncOngoingNextOrderActivity(dashboard, {
      playSound: false,
      isOnline: dashboard.is_online ?? false,
    });
  },

  fetchMenuItems: async () => {
    try {
      const res = await storeService.getMenuItems();
      set({ menuItems: unwrapData<MenuItem[]>(res) || [] });
    } catch {}
  },

  fetchPackages: async () => {
    try {
      const res = await storeService.getPackages();
      set({ packages: unwrapData<Package[]>(res) || [] });
    } catch {}
  },

  toggleOnline: async () => {
    try {
      const res = await storeService.toggleOnline();
      const data = unwrapData<{ is_online?: boolean }>(res);
      set({ isOnline: data?.is_online ?? !get().isOnline });
      await get().refreshDashboardAndActivity();
    } catch {}
  },

  toggleItemStock: async (itemId, available) => {
    await storeService.updateMenuItem(itemId, { is_available: available });
    await get().fetchMenuItems();
  },

  toggleItemInstantAvailability: async (itemId, available) => {
    await storeService.updateMenuItem(itemId, {
      is_instant_available: available,
    });
    await get().fetchMenuItems();
  },

  togglePackage: async (packageId) => {
    await storeService.togglePackage(packageId);
    await get().fetchPackages();
  },
}));
