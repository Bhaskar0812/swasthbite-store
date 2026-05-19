export type StoreUser = {
  _id: string;
  name: string;
  email: string;
  phone_number?: string;
  role: "store_admin" | "admin" | "super_admin";
  store_name?: string;
  store_photo?: string;
  is_active?: boolean;
  workplace?: {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
};

export type OnboardingStatus = {
  agreement_signed: boolean;
  agreement_signed_at?: string;
  onboarding_paid: boolean;
  onboarding_paid_at?: string;
  onboarding_payment_amount?: number;
  commission_rate?: number;
};

export type DashboardData = {
  onboarding: OnboardingStatus;
  bank_account_added: boolean;
  settlement_frequency: string | null;
  pending_penalty_amount: number;
  pending_settlement_amount: number;
  recent_settlements: Settlement[];
  today_orders: DashboardOrder[];
  tomorrow_orders: DashboardOrder[];
  weekly_revenue: number;
  monthly_revenue: number;
  total_revenue: number;
  total_orders: number;
  active_subscriptions: number;
};

export type DashboardOrder = {
  _id: string;
  date: string;
  slot: string;
  status: string;
  meal_name: string;
  user_name: string;
  user_phone: string;
  package_name?: string;
  package_image?: string;
  image?: string;
  meal_image?: string;
  delivery_mode?: "scheduled" | "instant";
  instant_deadline_at?: string | null;
  createdAt?: string;
  delivery_note?: string;
  delivery_address?: {
    label?: string;
    full_address?: string;
    address?: string;
    workplace_name?: string;
    workplace_type?: string;
    desk_number?: string;
    floor?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  address_snapshot?: {
    label?: string;
    full_address?: string;
    workplace_name?: string;
    workplace_type?: string;
    desk_number?: string;
    floor?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  order_id?: string;
  quantity?: number;
};

export type MenuItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  categories?: { _id: string; name: string; icon?: string }[];
  image?: string;
  store_available: boolean;
  is_veg?: boolean;
};

export type Package = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration_days?: number;
  meals_per_day?: number;
  image?: string;
  is_active: boolean;
  store_selected: boolean;
};

export type Settlement = {
  _id: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  total_amount: number;
  commission: number;
  penalties: number;
  net_amount: number;
  status: "pending" | "processing" | "completed";
  paid_at?: string;
};

export type Penalty = {
  _id: string;
  type: string;
  amount: number;
  reason: string;
  created_at: string;
  settlement?: string;
};

export type Expense = {
  _id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
};

export type BankAccount = {
  _id?: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string;
  branch_name?: string;
  settlement_frequency: "weekly" | "monthly";
  is_verified?: boolean;
};

export type Promotion = {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  per_user_limit?: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  applicable_to: "all" | "package" | "item";
};

export type ChatSession = {
  _id: string;
  customer: {
    _id: string;
    name: string;
    phone?: string;
  };
  status: "waiting" | "active" | "ended";
  created_at: string;
  last_message?: {
    content: string;
    sent_at: string;
    sender_type: "customer" | "store";
  };
};

export type ChatMessage = {
  _id: string;
  content: string;
  content_type: "text" | "image";
  image_url?: string;
  sender_type: "customer" | "store";
  sent_at: string;
};

export type Refund = {
  _id: string;
  customer: { _id: string; name: string };
  subscription: { _id: string };
  amount: number;
  reason: string;
  created_at: string;
};

export type StoreCharges = {
  delivery_per_km: number;
  packing_charge: number;
  handling_charge: number;
};

export type Notification = {
  _id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
};

export type LedgerEntry = {
  _id: string;
  type: "collection" | "settlement" | "penalty" | "expense";
  amount: number;
  description: string;
  date: string;
  balance_after: number;
};
