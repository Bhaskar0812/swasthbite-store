import { create } from "zustand";
import { storeService } from "services/storeService";
import { syncOngoingNextOrderActivity } from 'services/ongoingOrderActivityService';
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
      await syncOngoingNextOrderActivity(dashboardData);
    } catch {
      set({ loading: false });
    }
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
      const onlinePayload = unwrapData<{ is_online?: boolean } | null>(res);
      set({ isOnline: onlinePayload?.is_online ?? !get().isOnline });
    } catch {}
  },

  toggleItemStock: async (itemId, available) => {
    try {
      await storeService.toggleItemStock(itemId, available);
      set((s) => ({
        menuItems: s.menuItems.map((item) =>
          item._id === itemId ? { ...item, store_available: available } : item,
        ),
      }));
    } catch {}
  },

  toggleItemInstantAvailability: async (itemId, available) => {
    try {
      await storeService.toggleItemInstantAvailability(itemId, available);
      set((s) => ({
        menuItems: s.menuItems.map((item) =>
          item._id === itemId
            ? { ...item, available_for_instant: available }
            : item,
        ),
      }));
    } catch {}
  },

  togglePackage: async (packageId) => {
    try {
      await storeService.togglePackage(packageId);
      set((s) => ({
        packages: s.packages.map((pkg) =>
          pkg._id === packageId
            ? { ...pkg, store_selected: !pkg.store_selected }
            : pkg,
        ),
      }));
    } catch {}
  },
}));
