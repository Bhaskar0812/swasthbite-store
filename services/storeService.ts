import api from "./api";

export const storeService = {
  // Dashboard
  getDashboard: async () => {
    const res = await api.get("/store/dashboard");
    return res.data;
  },
  getOrderDetail: async (id: string) => {
    const res = await api.get(`/store/orders/${id}`);
    return res.data;
  },
  getStoreHours: async () => {
    const res = await api.get("/store/hours");
    return res.data;
  },
  updateStoreHours: async (data: {
    enabled: boolean;
    timezone?: string;
    weekly: Array<{
      day_index: number;
      label: string;
      is_open: boolean;
      open_time: string;
      close_time: string;
    }>;
  }) => {
    const res = await api.put("/store/hours", data);
    return res.data;
  },

  // Onboarding
  getOnboarding: async () => {
    const res = await api.get("/store/onboarding");
    return res.data;
  },
  getAgreement: async () => {
    const res = await api.get("/store/agreement");
    return res.data;
  },
  signAgreement: async () => {
    const res = await api.post("/store/agreement/sign");
    return res.data;
  },
  createOnboardingOrder: async () => {
    const res = await api.post("/store/onboarding/create-order");
    return res.data;
  },
  confirmOnboardingPayment: async (payment_id: string) => {
    const res = await api.post("/store/onboarding/payment", { payment_id });
    return res.data;
  },

  // Menu Items
  getMenuItems: async () => {
    const res = await api.get("/store/menu-items");
    return res.data;
  },
  toggleItemStock: async (itemId: string, is_available: boolean) => {
    const res = await api.put(`/store/menu-items/${itemId}/stock`, {
      is_available,
    });
    return res.data;
  },
  toggleItemInstantAvailability: async (
    itemId: string,
    available_for_instant: boolean,
  ) => {
    const res = await api.put(
      `/store/menu-items/${itemId}/instant-availability`,
      {
        available_for_instant,
      },
    );
    return res.data;
  },

  // Packages
  getPackages: async () => {
    const res = await api.get("/store/packages");
    return res.data;
  },
  togglePackage: async (packageId: string) => {
    const res = await api.put(`/store/packages/${packageId}/toggle`);
    return res.data;
  },

  // Store Online/Offline
  toggleOnline: async () => {
    const res = await api.put("/store/toggle-online");
    return res.data;
  },

  // Menu Status
  getMenuStatus: async () => {
    const res = await api.get("/store/menu/status");
    return res.data;
  },
  addMenuItems: async (item_ids: string[]) => {
    const res = await api.post("/store/menu/items/add", { item_ids });
    return res.data;
  },
  removeMenuItems: async (item_ids: string[]) => {
    const res = await api.delete("/store/menu/items/remove", {
      data: { item_ids },
    });
    return res.data;
  },
  addPackages: async (package_ids: string[]) => {
    const res = await api.post("/store/menu/packages/add", { package_ids });
    return res.data;
  },
  removePackages: async (package_ids: string[]) => {
    const res = await api.delete("/store/menu/packages/remove", {
      data: { package_ids },
    });
    return res.data;
  },

  // Settlements
  getSettlements: async () => {
    const res = await api.get("/store/settlements");
    return res.data;
  },

  // Penalties
  getPenalties: async () => {
    const res = await api.get("/store/penalties");
    return res.data;
  },

  // Bank Account
  getBankAccount: async () => {
    const res = await api.get("/store/bank-account");
    return res.data;
  },
  updateBankAccount: async (data: any) => {
    const res = await api.put("/store/bank-account", data);
    return res.data;
  },

  // IFSC Lookup
  lookupIFSC: async (ifsc: string) => {
    const res = await api.get(`/store/ifsc/${ifsc}`);
    return res.data;
  },

  // Ledger
  getLedger: async () => {
    const res = await api.get("/store/ledger");
    return res.data;
  },

  // Expenses
  getExpenses: async () => {
    const res = await api.get("/store/expenses");
    return res.data;
  },
  createExpense: async (data: any) => {
    const res = await api.post("/store/expenses", data);
    return res.data;
  },
  updateExpense: async (id: string, data: any) => {
    const res = await api.put(`/store/expenses/${id}`, data);
    return res.data;
  },
  deleteExpense: async (id: string) => {
    const res = await api.delete(`/store/expenses/${id}`);
    return res.data;
  },
  getExpenseSummary: async () => {
    const res = await api.get("/store/expense-summary");
    return res.data;
  },

  // Promotions
  getPromotions: async () => {
    const res = await api.get("/store/promotions");
    return res.data;
  },
  createPromotion: async (data: any) => {
    const res = await api.post("/store/promotions", data);
    return res.data;
  },
  updatePromotion: async (id: string, data: any) => {
    const res = await api.put(`/store/promotions/${id}`, data);
    return res.data;
  },
  deletePromotion: async (id: string) => {
    const res = await api.delete(`/store/promotions/${id}`);
    return res.data;
  },

  // Refunds
  getRefundableOrders: async () => {
    const res = await api.get("/store/refund-orders");
    return res.data;
  },
  issueRefund: async (data: {
    subscription_id: string;
    amount: number;
    reason: string;
  }) => {
    const res = await api.post("/store/refund", data);
    return res.data;
  },
  getRefunds: async () => {
    const res = await api.get("/store/refunds");
    return res.data;
  },

  // Store Charges
  getCharges: async () => {
    const res = await api.get("/store/charges");
    return res.data;
  },
  updateCharges: async (data: any) => {
    const res = await api.put("/store/charges", data);
    return res.data;
  },

  // Location Request
  requestLocationChange: async (data: FormData) => {
    const res = await api.post("/store/location-request", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  updateOrderDeliveryStatus: async (
    id: string,
    payload: { delivery_index: number; status: string },
  ) => {
    const res = await api.put(`/store/orders/${id}/delivery-status`, payload);
    return res.data;
  },
  requestOrderPayment: async (
    id: string,
    payload: { due_amount?: number; message?: string },
  ) => {
    const res = await api.post(`/store/orders/${id}/request-payment`, payload);
    return res.data;
  },
  updateOrderPaymentState: async (
    id: string,
    payload: {
      payment_status: string;
      paid_amount?: number;
      due_amount?: number;
    },
  ) => {
    const res = await api.post(`/store/orders/${id}/payment-state`, payload);
    return res.data;
  },
  cancelOrder: async (
    id: string,
    refund_option: "wallet" | "original" | "no_refund",
  ) => {
    const res = await api.post(`/store/orders/${id}/cancel`, { refund_option });
    return res.data;
  },
  getLocationRequests: async () => {
    const res = await api.get("/store/location-requests");
    return res.data;
  },
};
