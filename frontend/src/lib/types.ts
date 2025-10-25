export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type AddOn = {
  name: string;
  price: number;
};

export type ServiceHighlight = {
  title: string;
  description: string;
  icon: string;
};

export type Service = {
  id: number;
  title: string;
  slug: string;
  price: number;
  category_id: number;
  category: string;
  category_slug: string;
  thumbnail: string;
  summary: string;
  description: string;
  average_rating?: number;
  rating_count?: number;
  completed_count?: number;
  add_ons?: AddOn[];
  highlights?: ServiceHighlight[];
  gallery_images?: string[];
};

export type GalleryAsset = {
  url: string;
  caption?: string;
  type: "image" | "pdf";
};

export type GalleryItem = {
  id: number;
  section: "photography" | "videography" | "design" | "web";
  title: string;
  subtitle: string;
  thumbnail: string;
  filters?: string[];
  display_mode?: "gallery" | "pdf";
  assets?: GalleryAsset[];
  video_url?: string;
  link_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Experience = {
  id: number;
  period: string;
  title: string;
  company?: string;
  description: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type PaymentTransaction = {
  id: number;
  order_id: number;
  method: string;
  channel?: string;
  status: string;
  amount: number;
  currency?: string;
  reference: string;
  external_id?: string;
  xendit_id: string;
  invoice_url?: string;
  checkout_url?: string;
  qr_code_url?: string;
  qr_string?: string;
  virtual_account_number?: string;
  bank_code?: string;
  payment_code?: string;
  expires_at?: string;
  raw_response?: unknown;
  created_at: string;
  updated_at: string;
};

export type PaymentChannelStatus = {
  category: string;
  channel: string;
  available: boolean;
  message?: string;
  updated_at: string;
};
