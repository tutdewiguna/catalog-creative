"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  User,
  Mail,
  Phone,
  Info,
  CreditCard,
  Star,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Button from "./Button";
import { useEffect, useState, useMemo } from "react";
import { updateOrderStatus } from "@/lib/api";
import { formatOrderStatus } from "@/lib/helpers";
import Portal from "./Portal";
import type { Order, PaymentTransaction } from "@/lib/types";
import Image from "next/image";

type OrderStatus =
  | "pending"
  | "awaiting_confirmation"
  | "confirmed"
  | "done"
  | "cancelled"
  | "cancelled_by_user"
  | "cancelled_by_admin"
  | "payment_invalid"
  | "refund_pending"
  | "refund_rejected"
  | "refunded";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "awaiting_confirmation", label: "Awaiting Confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
  { value: "cancelled_by_user", label: "Cancelled by User" },
  { value: "cancelled_by_admin", label: "Cancelled by Admin" },
  { value: "payment_invalid", label: "Payment Invalid" },
  { value: "refund_pending", label: "Refund Pending" },
  { value: "refund_rejected", label: "Refund Rejected" },
  { value: "refunded", label: "Refunded" },
];

const extractOrderQuantity = (order: { quantity?: number; notes?: string }) => {
  if (typeof order.quantity === "number" && order.quantity > 0) {
    return order.quantity;
  }
  if (order.notes) {
    const match = order.notes.match(/qty\s*:?-?\s*(\d+)/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 1;
};

type PaymentLogo = {
  src: string;
  alt: string;
};

const paymentLogoMap: Record<string, PaymentLogo> = {
  qris: { src: "/images/payment-logos/qris.svg", alt: "QRIS" },
  bca: { src: "/images/payment-logos/bca.svg", alt: "BCA" },
  mandiri: { src: "/images/payment-logos/mandiri.svg", alt: "Mandiri" },
  bri: { src: "/images/payment-logos/bri.svg", alt: "BRI" },
  bni: { src: "/images/payment-logos/bni.svg", alt: "BNI" },
  bsi: { src: "/images/payment-logos/bsi.svg", alt: "BSI" },
  permata: { src: "/images/payment-logos/permata.svg", alt: "Permata" },
  cimb: { src: "/images/payment-logos/cimb.svg", alt: "CIMB Niaga" },
  bjb: { src: "/images/payment-logos/bjb.svg", alt: "BJB" },
  ovo: { src: "/images/payment-logos/ovo.svg", alt: "OVO" },
  gopay: { src: "/images/payment-logos/gopay.svg", alt: "GoPay" },
  dana: { src: "/images/payment-logos/dana.svg", alt: "DANA" },
  shopeepay: { src: "/images/payment-logos/shopeepay.svg", alt: "ShopeePay" },
  linkaja: { src: "/images/payment-logos/linkaja.svg", alt: "LinkAja" },
  astrapay: { src: "/images/payment-logos/astrapay.svg", alt: "AstraPay" },
  visa: { src: "/images/payment-logos/visa.svg", alt: "VISA" },
  mastercard: { src: "/images/payment-logos/mastercard.svg", alt: "Mastercard" },
  alfamart: { src: "/images/payment-logos/alfamart.svg", alt: "Alfamart" },
  indomaret: { src: "/images/payment-logos/indomaret.svg", alt: "Indomaret" },
  akulaku: { src: "/images/payment-logos/akulaku.svg", alt: "Akulaku" },
  kredivo: { src: "/images/payment-logos/kredivo.svg", alt: "Kredivo" },
};

const normalizeLogoKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

interface AdminOrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onUpdate: (updatedOrder: Order) => void;
}

export default function AdminOrderDetailModal({ order, onClose, onUpdate }: AdminOrderDetailModalProps) {
  const [orderStatus, setOrderStatus] = useState(order?.status || "");
  const [paymentStatus, setPaymentStatus] = useState(order?.payment_status || "");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(
    (order?.status as OrderStatus) || "pending"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const paymentExpiresAt = useMemo(() => {
    if (!order) return null;
    return order.latest_transaction?.expires_at ?? order.payment_expires_at ?? null;
  }, [order]);

  const transaction = order?.latest_transaction;

  const paymentMethodInfo = useMemo(() => {
    if (!order) {
      return { label: "Not specified", logos: [] as PaymentLogo[] };
    }
    return {
      label: buildPaymentMethodLabel(order),
      logos: collectPaymentMethodLogos(order),
    };
  }, [order]);

  useEffect(() => {
    if (order) {
      setOrderStatus(order.status);
      setPaymentStatus(order.payment_status || "");
      setSelectedStatus(order.status as OrderStatus);
    }
  }, [order]);

  if (!order) return null;

  const handleStatusUpdate = async () => {
    if (selectedStatus === order.status) {
      setErrorMessage("Status is already set to this value.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const updatedOrder = await updateOrderStatus(order.id, selectedStatus);
      setOrderStatus(updatedOrder.status);
      setPaymentStatus(updatedOrder.payment_status || "");
      onUpdate(updatedOrder);
    } catch (error) {
      console.error("Failed to update status:", error);
      setErrorMessage("Failed to update status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount * 15000);
  };

  const formatPaymentMethod = (method?: string) => {
    if (!method) return "Not specified";
    const normalized = method.toLowerCase();
    const paymentMethodLabels: Record<string, string> = {
      bca: "Bank Transfer - BCA",
      mandiri: "Bank Transfer - Mandiri",
      bri: "Bank Transfer - BRI",
      bni: "Bank Transfer - BNI",
      qris: "QRIS",
      virtual_account: "Virtual Account",
      callback_virtual_account: "Virtual Account",
      ovo: "OVO",
      gopay: "GoPay",
      dana: "Dana",
      whatsapp: "Manual Confirmation - WhatsApp",
    };

    if (paymentMethodLabels[normalized]) {
      return paymentMethodLabels[normalized];
    }

    return method
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatPaymentStatus = (status?: string) => {
    if (!status) return "Unknown";
    const normalized = status.toLowerCase();
    const labels: Record<string, string> = {
      completed: "Paid",
      paid: "Paid",
      success: "Paid",
      settled: "Paid",
      pending: "Pending",
      active: "Active",
      expired: "Expired",
      failed: "Failed",
      cancelled: "Cancelled",
    };
    if (labels[normalized]) return labels[normalized];
    return normalized
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" };
    try {
      return new Date(dateString).toLocaleDateString("id-ID", options);
    } catch (e) {
      return dateString;
    }
  };

  function buildPaymentMethodLabel(target: Order) {
    const transaction = target.latest_transaction;
    const method = transaction?.method?.toLowerCase() || target.payment_method?.toLowerCase() || "";
    const channel = transaction?.channel?.toUpperCase();
    const bankCode = transaction?.bank_code?.toUpperCase();

    if (method === "virtual_account" || method === "bank_transfer") {
      if (bankCode) return `Virtual Account - ${bankCode}`;
      if (channel) return `Virtual Account - ${channel}`;
      return "Virtual Account";
    }
    if (method === "ewallet") {
      if (channel) return `E-Wallet - ${channel}`;
      return "E-Wallet";
    }
    if (method === "qris") return "QRIS";
    if (method === "retail_outlet") {
      if (channel) return `Retail Outlet - ${channel}`;
      return "Retail Outlet";
    }
    if (method === "paylater") {
      if (channel) return `PayLater - ${channel}`;
      return "PayLater";
    }
    if (method === "card") {
      if (channel) return `Card - ${channel}`;
      return "Credit/Debit Card";
    }
    if (target.payment_method) return formatPaymentMethod(target.payment_method);
    if (transaction?.channel) return formatPaymentMethod(transaction.channel);
    if (transaction?.method) return formatPaymentMethod(transaction.method);
    return "Not specified";
  }

  function collectPaymentMethodLogos(target: Order) {
    const transaction = target.latest_transaction;
    const seen = new Set<string>();
    const logos: PaymentLogo[] = [];

    const addLogo = (value?: string | null) => {
      if (!value) return;
      const key = normalizeLogoKey(value);
      if (!key) return;
      const logo = paymentLogoMap[key];
      if (logo && !seen.has(logo.src)) {
        seen.add(logo.src);
        logos.push(logo);
      }
    };

    const values = [
      target.payment_method,
      transaction?.method,
      transaction?.channel,
      transaction?.bank_code,
    ];

    values.forEach((value) => {
      if (!value) return;
      const normalized = value.toLowerCase();
      addLogo(normalized);
      normalized.split(/[^a-z0-9]+/).forEach((part) => addLogo(part));
    });

    if (transaction?.method) {
      const method = transaction.method.toLowerCase();
      if (method === "card") {
        addLogo("visa");
        addLogo("mastercard");
      }
      if (method === "virtual_account" || method === "bank_transfer") {
        addLogo(transaction?.bank_code);
        addLogo(transaction?.channel);
      }
      if (method === "ewallet" || method === "paylater" || method === "retail_outlet") {
        addLogo(transaction?.channel);
      }
      if (method === "qris") addLogo("qris");
    }
    if ((target.payment_method || "").toLowerCase().includes("qris")) addLogo("qris");
    return logos;
  }

  const statusStyles: { [key: string]: string } = {
    pending: "bg-gray-200 text-gray-700",
    awaiting_confirmation: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    done: "bg-green-100 text-green-700",
    payment_invalid: "bg-red-100 text-red-700",
    cancelled: "bg-red-100 text-red-700",
    cancelled_by_user: "bg-red-100 text-red-700",
    cancelled_by_admin: "bg-red-100 text-red-700",
    refund_pending: "bg-orange-100 text-orange-700",
    refund_rejected: "bg-red-200 text-red-800",
    refunded: "bg-indigo-100 text-indigo-700",
  };

  const renderStaticStars = (value: number) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < value;
        return (
          <Star
            key={index}
            size={18}
            className={filled ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}
            fill="currentColor"
          />
        );
      })}
    </div>
  );

  const statusChipClass = statusStyles[orderStatus] || "bg-gray-200 text-gray-700";
  const formattedStatus = formatOrderStatus(orderStatus);
  const quantity = extractOrderQuantity(order);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <header className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Order Detail <span className="text-gray-500 font-mono">#{order.id}</span>
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              <X size={22} />
            </button>
          </header>
          
          <main className="flex-grow p-6 overflow-y-auto space-y-6 bg-gray-50">
            <section className="p-5 bg-white rounded-xl border border-gray-200 space-y-4">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <p className="text-sm text-gray-500">Service</p>
                  <h3 className="text-2xl font-semibold text-gray-900 mt-1">{order.service_title || order.service}</h3>
                </div>
                <div
                  className={`px-3 py-1 text-xs font-semibold capitalize rounded-full ${statusChipClass}`}
                >
                  {formattedStatus}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-500" />
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info size={16} className="text-gray-500" />
                    <span className="text-gray-800 font-medium">Qty: {quantity}</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-lg">
                    {formatPrice(order.amount)}
                  </span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 rounded-xl border border-gray-200 bg-white space-y-4">
                <h4 className="font-semibold text-gray-900">Customer Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <User size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-500">Name</p>
                      <p className="text-gray-800 font-medium">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-500">Email</p>
                      <p className="text-gray-800 font-medium">{order.customer_email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-500">Phone</p>
                      <p className="text-gray-800 font-medium">{order.customer_phone || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 rounded-xl border border-gray-200 bg-white space-y-4">
                <h4 className="font-semibold text-gray-900">Payment Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CreditCard size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-gray-500">Payment Method</p>
                        <p className="text-gray-800 font-semibold">{paymentMethodInfo.label}</p>
                      </div>
                      {paymentMethodInfo.logos.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {paymentMethodInfo.logos.map((logo) => (
                            <div key={logo.src} className="flex h-6 items-center">
                              <Image
                                src={logo.src}
                                alt={logo.alt}
                                width={60}
                                height={24}
                                className="h-6 w-auto object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Info size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-500">Payment Status</p>
                      <p className="text-gray-800 font-medium capitalize">
                        {formatPaymentStatus(paymentStatus)}
                      </p>
                    </div>
                  </div>
                  {order.payment_reference && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-500">Reference</p>
                        <p className="text-gray-800 font-medium">{order.payment_reference}</p>
                      </div>
                    </div>
                  )}
                  {transaction?.invoice_url && (
                     <div className="flex items-start gap-3">
                      <ExternalLink size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-500">Payment Link</p>
                        <a 
                          href={transaction.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          View Invoice
                        </a>
                      </div>
                    </div>
                  )}
                  {paymentExpiresAt && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-500">Payment Expires</p>
                        <p className="text-gray-800 font-medium">
                          {formatDate(paymentExpiresAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {order.notes && (
              <section className="p-5 rounded-xl border border-gray-200 bg-white">
                <h4 className="font-semibold text-gray-900">Notes</h4>
                <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">
                  {order.notes}
                </p>
              </section>
            )}

            {order.rating_value && order.rating_value > 0 && (
              <section className="p-5 rounded-xl border border-gray-200 bg-white">
                <h4 className="font-semibold text-gray-900">Customer Rating</h4>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {renderStaticStars(order.rating_value)}
                    <span className="text-sm font-semibold text-gray-800">
                      {order.rating_value}/5
                    </span>
                  </div>
                  {order.rating_review && (
                    <p className="text-sm text-gray-600 italic">"{order.rating_review}"</p>
                  )}
                </div>
              </section>
            )}

            <section className="p-5 rounded-xl border border-gray-200 bg-white">
              <h4 className="font-semibold text-gray-900">Admin Actions</h4>
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Update Order Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    className="w-full form-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                    disabled={isLoading}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {errorMessage && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}
                <Button
                  fullWidth
                  onClick={handleStatusUpdate}
                  disabled={isLoading || selectedStatus === order.status}
                >
                  {isLoading ? (
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                  ) : (
                    <RefreshCw size={18} className="mr-2" />
                  )}
                  {isLoading ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </section>
          </main>
          
          <footer className="flex-shrink-0 p-4 bg-gray-100 border-t border-gray-200 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </footer>
        </motion.div>
      </div>
    </Portal>
  );
}