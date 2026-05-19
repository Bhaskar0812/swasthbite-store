import api from "./api";

export const authService = {
  // Store registration login (email + password)
  login: async (email: string, password: string) => {
    const res = await api.post("/store-registration/login", {
      email,
      password,
    });
    return res.data;
  },

  // Forgot password - sends OTP to email
  forgotPassword: async (email: string) => {
    const res = await api.post("/store-registration/forgot-password", {
      email,
    });
    return res.data;
  },

  // Reset password with OTP
  resetPassword: async (email: string, otp: string, new_password: string) => {
    const res = await api.post("/store-registration/reset-password", {
      email,
      otp,
      new_password,
    });
    return res.data;
  },

  // Get registration status
  getStatus: async (email: string) => {
    const res = await api.get(
      `/store-registration/status?email=${encodeURIComponent(email)}`,
    );
    return res.data;
  },

  // Get own registration details
  getMe: async () => {
    const res = await api.get("/store-registration/me");
    return res.data;
  },

  // Update profile
  updateProfile: async (data: FormData) => {
    const res = await api.put("/store-registration/me/profile", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // Request account deletion
  requestDeletion: async (data: { password: string; reason?: string }) => {
    const res = await api.post("/profile/request-deletion", data);
    return res.data;
  },
};
