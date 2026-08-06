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
  menuItemIds: string[];
  isOnline: boolean;
  loading: boolean;

  fetchDashboard: () => Promise<void>;
  refreshDashboardAndActivity: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchPackages: () => Promise<void>;
  fetchMenuStatus: () => Promise<void>;
  toggleOnline: () => Promise<void>;
  toggleItemStock: (itemId: string, available: boolean) => Promise<void>;
  toggleItemInstantAvailability: (
    itemId: string,
    available: boolean,
  ) => Promise<void>;
  togglePackage: (packageId: string) => Promise<void>;
  updateItemPrice: (
    itemId: string,
    storePrice: number | null,
    storeMrp?: number | null,
  ) => Promise<void>;
  addMenuItems: (itemIds: string[]) => Promise<void>;
  removeMenuItems: (itemIds: string[]) => Promise<void>;
};

export const useStoreStore = create<StoreState>((set, get) => ({
  dashboard: null,
  menuItems: [],
  packages: [],
  menuItemIds: [],
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

  fetchMenuStatus: async () => {
    try {
      const res = await storeService.getMenuStatus();
      const data = unwrapData<any>(res) || {};
      const ids = (data.menu_item_ids || []).map((id: any) => String(id));
      set({ menuItemIds: ids });
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
    const previous = get().menuItems;
    set({
      menuItems: previous.map((item) =>
        item._id === itemId
          ? {
              ...item,
              store_available: available,
              available_for_instant: available
                ? item.available_for_instant
                : false,
            }
          : item,
      ),
    });
    try {
      await storeService.toggleItemStock(itemId, available);
    } catch (err) {
      set({ menuItems: previous });
      throw err;
    }
  },

  toggleItemInstantAvailability: async (itemId, available) => {
    const previous = get().menuItems;
    set({
      menuItems: previous.map((item) =>
        item._id === itemId
          ? { ...item, available_for_instant: available }
          : item,
      ),
    });
    try {
      await storeService.toggleItemInstantAvailability(itemId, available);
    } catch (err) {
      set({ menuItems: previous });
      throw err;
    }
  },

  togglePackage: async (packageId) => {
    const previous = get().packages;
    set({
      packages: previous.map((pkg) =>
        pkg._id === packageId
          ? { ...pkg, store_selected: !pkg.store_selected }
          : pkg,
      ),
    });
    try {
      await storeService.togglePackage(packageId);
    } catch (err) {
      set({ packages: previous });
      throw err;
    }
  },

  updateItemPrice: async (itemId, storePrice, storeMrp = null) => {
    const previous = get().menuItems;
    set({
      menuItems: previous.map((item) =>
        item._id === itemId
          ? {
              ...item,
              store_price: storePrice,
              store_mrp: storeMrp,
            }
          : item,
      ),
    });
    try {
      const res = await storeService.updateItemPrice(itemId, storePrice, storeMrp);
      const data = unwrapData<any>(res);
      if (data) {
        set({
          menuItems: get().menuItems.map((item) =>
            item._id === itemId
              ? {
                  ...item,
                  store_price:
                    data.store_price != null ? Number(data.store_price) : null,
                  store_mrp:
                    data.store_mrp != null ? Number(data.store_mrp) : null,
                }
              : item,
          ),
        });
      }
    } catch (err) {
      set({ menuItems: previous });
      throw err;
    }
  },

  addMenuItems: async (itemIds) => {
    await storeService.addMenuItems(itemIds);
    const next = new Set(get().menuItemIds.map(String));
    itemIds.forEach((id) => next.add(String(id)));
    set({ menuItemIds: Array.from(next) });
  },

  removeMenuItems: async (itemIds) => {
    const removeSet = new Set(itemIds.map(String));
    await storeService.removeMenuItems(itemIds);
    set({
      menuItemIds: get().menuItemIds.filter((id) => !removeSet.has(String(id))),
    });
  },
}));
