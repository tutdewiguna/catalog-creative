import axios from "axios";
import { useAuthStore } from "@/store/auth";
import type { Experience, PaymentChannelStatus } from "./types";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true,
});

api.defaults.withCredentials = true;

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = useAuthStore.getState().token;
    if (token && config.url?.includes("/admin")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const getOrderById = async (id: string) => {
  const { data } = await api.get(`/orders/${id}`);
  return data;
};

export type PaymentAvailabilityResponse = {
  statuses: PaymentChannelStatus[];
  generated_at?: string;
};

export const getPaymentAvailability = async () => {
  const { data } = await api.get<PaymentAvailabilityResponse>("/payments/status");
  return data;
};

export const chargeOrderCard = async (
  id: string | number,
  payload: { tokenId: string; cardBrand?: string | null },
) => {
  const { data } = await api.post(`/orders/${id}/card-charge`, {
    token_id: payload.tokenId,
    card_brand: payload.cardBrand,
  });
  return data;
};

export const getOrders = async () => {
  const { data } = await api.get("/orders");
  return data;
};

export const cancelOrder = async (id: number, reason: string) => {
  const { data } = await api.post(`/orders/${id}/request`, { action: "cancel", reason });
  return data;
};

export const requestRefund = async (id: number, reason: string) => {
  const { data } = await api.post(`/orders/${id}/request`, { action: "refund", reason });
  return data;
};

export const submitOrderRating = async (id: number, rating: number, review?: string) => {
  const { data } = await api.post(`/orders/${id}/rating`, { rating, review });
  return data;
};

export const loginAdmin = async (payload: any) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
};

export const registerUser = async (payload: {
  name: string;
  email: string;
  password: string;
}) => {
  const { data } = await api.post("/auth/register", payload);
  return data;
};

export const loginUser = async (payload: { email: string; password: string }) => {
  const { data } = await api.post("/auth/user/login", payload);
  return data;
};

export const getUserSession = async () => {
  const { data } = await api.get("/auth/session");
  return data;
};

export const logoutUser = async () => {
  await api.post("/auth/logout");
};

export const getServices = async (categorySlug?: string) => {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  const { data } = await api.get(`/services${query}`);
  return data;
};

export const getGallery = async (section?: string) => {
  const query = section ? `?section=${encodeURIComponent(section)}` : "";
  const { data } = await api.get(`/gallery${query}`);
  return data;
};

export const getCategories = async () => {
  const { data } = await api.get("/categories");
  return data;
};

export const getServiceBySlug = async (slug: string) => {
  const { data } = await api.get(`/services/${slug}`);
  return data;
};

export const createOrder = async (payload: any) => {
  const { data } = await api.post("/orders", payload);
  return data;
};

export const validatePromoCode = async (payload: { code: string; total: number }) => {
  const { data } = await api.post("/promocode/validate", payload);
  return data;
};

export const sendMessage = async (payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) => {
  const { data } = await api.post("/contact", payload);
  return data;
};

export const getAdminStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data;
};

export const getAdminServices = async () => {
  const { data } = await api.get("/admin/services");
  return data;
};

export const getAdminGallery = async () => {
  const { data } = await api.get("/admin/gallery");
  return data;
};

export const createAdminGalleryItem = async (formData: FormData) => {
  const { data } = await api.post("/admin/gallery", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateAdminGalleryItem = async (id: number, formData: FormData) => {
  const { data } = await api.put(`/admin/gallery/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteAdminGalleryItem = async (id: number) => {
  const { data } = await api.delete(`/admin/gallery/${id}`);
  return data;
};

export const createAdminService = async (formData: FormData) => {
  const { data } = await api.post("/admin/services", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateAdminService = async (id: number, formData: FormData) => {
  const { data } = await api.put(`/admin/services/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteAdminService = async (id: number) => {
  const { data } = await api.delete(`/admin/services/${id}`);
  return data;
};

export const getAdminCategories = async () => {
  const { data } = await api.get("/admin/categories");
  return data;
};

export const createAdminCategory = async (payload: { name: string; slug?: string }) => {
  const { data } = await api.post("/admin/categories", payload);
  return data;
};

export const deleteAdminCategory = async (id: number) => {
  const { data } = await api.delete(`/admin/categories/${id}`);
  return data;
};

export const getAdminOrders = async () => {
  const { data } = await api.get("/admin/orders");
  return data;
};

export const updateOrderStatus = async (id: number, status: string) => {
  const { data } = await api.post(`/admin/orders/${id}/status`, { status });
  return data;
};

export const confirmAdminOrder = async (id: number) => {
  const { data } = await api.post(`/admin/orders/${id}/confirm`);
  return data;
};

export const getAdminMessages = async () => {
  const { data } = await api.get("/admin/messages");
  return data;
};

export const getAnalyticsSummary = async (params?: Record<string, any>) => {
  const { data } = await api.get("/admin/analytics/summary", { params });
  return data;
};

export const getAnalyticsEvents = async (params?: Record<string, any>) => {
  const { data } = await api.get("/admin/analytics/events", { params });
  return data;
};

export const getExperiences = async (): Promise<Experience[]> => {
  const { data } = await api.get<Experience[]>("/experiences");
  return data;
};

export const getAdminExperiences = async (): Promise<Experience[]> => {
  const { data } = await api.get<Experience[]>("/admin/experiences");
  return data;
};

export const createAdminExperience = async (payload: {
  period: string;
  title: string;
  company?: string;
  description: string;
  order?: number;
}) => {
  const { data } = await api.post("/admin/experiences", payload);
  return data;
};

export const updateAdminExperience = async (
  id: number,
  payload: {
    period?: string;
    title?: string;
    company?: string;
    description?: string;
    order?: number;
  }
) => {
  const { data } = await api.put(`/admin/experiences/${id}`, payload);
  return data;
};

export const deleteAdminExperience = async (id: number) => {
  const { data } = await api.delete(`/admin/experiences/${id}`);
  return data;
};