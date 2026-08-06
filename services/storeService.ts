import api from "./api";

export const storeService = {
  // Dashboard
  getDashboard: async () => {
    const res = await api.get("/store/dashboard");
    return res.data;
  },
  getOrderDetail: async (id: string) => {
    try {
      const res = await api.get(`/store/orders/${id}`);
      return res.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 404) throw error;

      const dashboardRes = await api.get("/store/dashboard");
      const dashboardData = dashboardRes?.data?.data || dashboardRes?.data || {};
      const candidates = [
        ...(dashboardData?.today_orders || []),
        ...(dashboardData?.tomorrow_orders || []),
        ...(dashboardData?.missed_orders || []),
        ...(dashboardData?.delivered_orders || []),
      ];

      const normalizedId = String(id || "").trim();
      const matched = candidates.find((order: any) => {
        const ids = [
          order?._id,
          order?.subscription_id,
          order?.order_id,
          order?.id,
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        return ids.includes(normalizedId);
      });

      const fallbackId = String(
        matched?.order_id || matched?.subscription_id || matched?.id || matched?._id || "",
      ).trim();
      if (!fallbackId) throw error;

      const retryRes = await api.get(`/store/orders/${fallbackId}`);
      return retryRes.data;
    }
  },
  getStoreHours: async () => {
    const res = await api.get("/store/hours");
    return res.data;
  },
  updateStoreHours: async (data: {
    enabled: boolean;
    manual_mode_enabled: boolean;
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
  updateItemPrice: async (
    itemId: string,
    store_price: number | null,
    store_mrp: number | null = null,
  ) => {
    const res = await api.put(`/store/menu-items/${itemId}/store-price`, {
      store_price,
      store_mrp,
    });
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
  downloadSettlementPDF: async (settlementId: string) => {
    const res = await api.get(`/store/settlements/${settlementId}/pdf`, {
      responseType: "blob",
    });
    return res;
  },
  downloadSettlementExcel: async (settlementId: string) => {
    const res = await api.get(`/store/settlements/${settlementId}/excel`, {
      responseType: "blob",
    });
    return res;
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
    payload: { delivery_index: number; status: string; quantity?: number; delivered_quantity?: number },
  ) => {
    try {
      const res = await api.put(`/store/orders/${id}/delivery-status`, payload);
      return res.data;
    } catch (error: any) {
      // Compatibility fallback for deployments using the older status endpoint.
      const status = error?.response?.status;
      if (status === 404 || status === 405) {
        const res = await api.put(`/store/orders/${id}/status`, payload);
        return res.data;
      }
      throw error;
    }
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
  collectFromDeliveryPartner: async (id: string) => {
    const res = await api.post(`/store/orders/${id}/collect-from-delivery-partner`);
    return res.data;
  },
  cancelOrder: async (
    id: string,
    refund_option: "wallet" | "original" | "no_refund",
  ) => {
    const res = await api.post(`/store/orders/${id}/cancel`, { refund_option });
    return res.data;
  },
  markBulkOrderNoted: async (id: string) => {
    const res = await api.post(`/store/bulk-orders/${id}/noted`);
    return res.data;
  },
  getBulkOrders: async () => {
    const res = await api.get('/store/bulk-orders');
    return res.data;
  },
  getBulkInquiries: async () => {
    const res = await api.get('/store/bulk-inquiries');
    return res.data;
  },
  getBulkOrderDetail: async (id: string) => {
    const res = await api.get(`/store/bulk-orders/${id}`);
    return res.data;
  },
  quoteBulkInquiry: async (
    id: string,
    data: {
      line_items: Array<{
        name: string;
        description?: string;
        quantity: number;
        unit_price: number;
      }>;
      notes?: string;
    },
  ) => {
    const res = await api.post(`/store/bulk-inquiries/${id}/quote`, data);
    return res.data;
  },
  getLocationRequests: async () => {
    const res = await api.get("/store/location-requests");
    return res.data;
  },
  skipDelivery: async (
    orderId: string,
    payload: { date: string; slot?: string; skip_quantity?: number },
  ) => {
    const res = await api.put(`/store/orders/${orderId}/skip-delivery`, payload);
    return res.data;
  },
  rescheduleDelivery: async (
    orderId: string,
    payload: { date: string; slot?: string; new_date: string; new_slot?: string },
  ) => {
    const res = await api.put(`/store/orders/${orderId}/reschedule-delivery`, payload);
    return res.data;
  },
  markDeliveryDelivered: async (
    orderId: string,
    payload: { delivery_index?: number; date?: string; slot?: string },
  ) => {
    const res = await api.put(`/store/orders/${orderId}/mark-delivered`, payload);
    return res.data;
  },
  cancelDelivery: async (
    orderId: string,
    payload: { date: string; slot?: string },
  ) => {
    const res = await api.put(`/store/orders/${orderId}/cancel-delivery`, payload);
    return res.data;
  },
  getSubscriptions: async (status: string = "active") => {
    const res = await api.get("/store/subscriptions", { params: { status } });
    return res.data;
  },
  getManageDeliveries: async () => {
    const res = await api.get("/store/manage-deliveries");
    return res.data;
  },
  updateDeliveryQuantity: async (
    orderId: string,
    payload: { date: string; slot?: string; quantity: number },
  ) => {
    const res = await api.put(`/store/orders/${orderId}/update-quantity`, payload);
    return res.data;
  },
  addDelivery: async (
    orderId: string,
    payload: {
      date?: string;
      slot?: string;
      quantity?: number;
      meal_name?: string;
      at_end?: boolean;
    },
  ) => {
    const res = await api.post(`/store/orders/${orderId}/add-delivery`, payload);
    return res.data;
  },
};
