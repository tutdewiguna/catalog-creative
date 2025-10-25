"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  User,
  Mail,
  Phone,
  Info,
  ArrowRight,
  RefreshCw,
  Trash2,
  CreditCard,
  Star,
} from "lucide-react";
import Button from "./Button";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import RequestActionModal from "./RequestActionModal";
import { cancelOrder, requestRefund, submitOrderRating } from "@/lib/api";
import { formatOrderStatus } from "@/lib/helpers";
import Portal from "./Portal";
import type { PaymentTransaction } from "@/lib/types";

type Order = {
  id: number;
  service: string;
  amount: number;
  status: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string;
  quantity?: number;
  payment_method?: string;
  payment_status?: string;
  payment_reference?: string;
  payment_expires_at?: string;
  refund_status?: string;
  rating_value?: number;
  rating_review?: string;
  rated_at?: string;
  latest_transaction?: PaymentTransaction;
};

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

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onActionSuccess: () => void;
  onRatingUpdate?: (order: Order) => void;
}

export default function OrderDetailModal({ order, onClose, onActionSuccess, onRatingUpdate }: OrderDetailModalProps) {
  const [showActionModal, setShowActionModal] = useState<"cancel" | "refund" | null>(null);
  const [loading, setLoading] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [paymentCountdown, setPaymentCountdown] = useState<string | null>(null);

  const paymentExpiresAt = useMemo(() => {
    if (!order) return null;
    return order.latest_transaction?.expires_at ?? order.payment_expires_at ?? null;
  }, [order]);

  const paymentMethodInfo = useMemo(() => {
    if (!order) {
      return { label: "Not specified", logos: [] as PaymentLogo[] };
    }

    return {
      label: buildPaymentMethodLabel(order),
      logos: collectPaymentMethodLogos(order),
    };
  }, [order]);

  const transaction = order?.latest_transaction;
  const paymentStatus = order?.payment_status || transaction?.status;
  const normalizedPaymentStatus = paymentStatus?.toLowerCase() ?? "";
  const normalizedOrderStatus = order?.status?.toLowerCase() ?? "";
  const isCriticalPaymentState = paymentCountdown === "Expired" || paymentCountdown === "Cancelled";

  const effectiveStatus = normalizedOrderStatus;

  useEffect(() => {
    if (!order) return;
    setRatingValue(order.rating_value || 0);
    setRatingReview(order.rating_review || "");
    setRatingError("");
  }, [order]);

  useEffect(() => {
    if (!order) {
      setPaymentCountdown(null);
      return;
    }

    const normalizedOrderStatus = order.status?.toLowerCase() ?? "";
    if (["cancelled", "cancelled_by_user", "cancelled_by_admin"].includes(normalizedOrderStatus)) {
      setPaymentCountdown("Cancelled");
      return;
    }

    const transaction = order.latest_transaction;
    const rawStatus = order.payment_status || transaction?.status;
    const normalizedStatus = rawStatus?.toLowerCase() ?? "";
    if (["paid", "completed", "success"].includes(normalizedStatus)) {
      setPaymentCountdown(null);
      return;
    }

    if (normalizedStatus === "cancelled") {
      setPaymentCountdown("Cancelled");
      return;
    }

    if (!paymentExpiresAt) {
      setPaymentCountdown(null);
      return;
    }

    const expiresAt = new Date(paymentExpiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      setPaymentCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setPaymentCountdown("Expired");
        return true;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600)
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor((totalSeconds % 3600) / 60)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor(totalSeconds % 60)
        .toString()
        .padStart(2, "0");
      setPaymentCountdown(`${hours}:${minutes}:${seconds}`);
      return false;
    };

    const expiredImmediately = updateCountdown();
    if (expiredImmediately) {
      return;
    }

    const interval = window.setInterval(() => {
      const shouldStop = updateCountdown();
      if (shouldStop) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [order, paymentExpiresAt]);

  useEffect(() => {
    if (!order) return;

    const { style } = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      overflow: style.overflow,
      width: style.width,
    };

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.overflow = "hidden";
    style.width = "100%";

    return () => {
      style.position = previous.position;
      style.top = previous.top;
      style.left = previous.left;
      style.right = previous.right;
      style.overflow = previous.overflow;
      style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [order]);

  if (!order) return null;

  const handleActionSubmit = async (reason: string) => {
    setLoading(true);
    try {
      if (showActionModal === 'cancel') {
        await cancelOrder(order.id, reason);
      } else if (showActionModal === 'refund') {
        await requestRefund(order.id, reason);
      }
      onActionSuccess();
    } catch (error) {
      console.error("Action failed:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
      setShowActionModal(null);
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
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" };
    return new Date(dateString).toLocaleDateString("id-ID", options);
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

    if (method === "qris") {
      return "QRIS";
    }

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

    if (target.payment_method) {
      return formatPaymentMethod(target.payment_method);
    }

    if (transaction?.channel) {
      return formatPaymentMethod(transaction.channel);
    }

    if (transaction?.method) {
      return formatPaymentMethod(transaction.method);
    }

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
      if (method === "qris") {
        addLogo("qris");
      }
    }

    if ((target.payment_method || "").toLowerCase().includes("qris")) {
      addLogo("qris");
    }

    return logos;
  }
  
  const statusStyles: { [key: string]: string } = {
    pending: "bg-light text-muted",
    awaiting_confirmation: "bg-accent/10 text-accent",
    confirmed: "bg-success/15 text-success",
    done: "bg-primary/15 text-primary",
    payment_invalid: "bg-danger/15 text-danger",
    cancelled: "bg-danger/15 text-danger",
    cancelled_by_user: "bg-danger/15 text-danger",
    cancelled_by_admin: "bg-danger/15 text-danger",
    refund_pending: "bg-warning/20 text-warning",
    refund_rejected: "bg-danger/20 text-danger",
    refunded: "bg-primary/15 text-primary",
  
  };

  const renderStaticStars = (value: number) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < value;
        return (
          <Star
            key={index}
            size={18}
            className={filled ? "text-primary fill-primary" : "text-muted/30"}
            fill="currentColor"
          />
        );
      })}
    </div>
  );

  const starOptions = [1, 2, 3, 4, 5];

  function formatStatusLabel(value?: string) {
    if (!value) return "";
    return formatOrderStatus(value);
  }

  function getRefundStatusInfo(status: string, detail?: string) {
    const normalizedStatus = status.toLowerCase();
    const hasRefundStatus = normalizedStatus.startsWith("refund");
    if (!hasRefundStatus) {
      return null;
    }

    const rawStatuses = [detail, status].filter(Boolean) as string[];
    if (rawStatuses.length === 0) return null;

    const mapped = rawStatuses.map((raw) => ({
      raw,
      normalized: raw.toLowerCase(),
    }));
    const findStatus = (...states: string[]) => {
      const targets = states.map((state) => state.toLowerCase());
      return mapped.find((item) => targets.includes(item.normalized));
    };
    const getLabel = (value?: string) =>
      formatStatusLabel(value || rawStatuses[0]);

    const rejected = findStatus("refund_rejected", "rejected");
    if (rejected) {
      return {
        containerClass: "bg-red-50 border-red-200",
        titleClass: "text-danger",
        textClass: "text-danger",
        description:
          "Your refund request was rejected. Contact support if you need more information.",
        statusLabel: getLabel(rejected.raw),
      };
    }

    const approved = findStatus(
      "refunded",
      "refund_completed",
      "accepted",
      "approved"
    );
    if (approved) {
      return {
        containerClass: "bg-success/15 border-success/30",
        titleClass: "text-success",
        textClass: "text-success",
        description:
          "Your refund has been approved. The funds will be processed shortly.",
        statusLabel: getLabel(approved.raw),
      };
    }

    const pending = findStatus("refund_pending", "pending_review", "pending");
    if (pending) {
      return {
        containerClass: "bg-warning/20 border-warning/30",
        titleClass: "text-warning",
        textClass: "text-warning",
        description:
          "Your refund request is under review. We'll notify you once it's updated.",
        statusLabel: getLabel(pending.raw),
      };
    }

    return {
      containerClass: "bg-accent/10 border-accent/20",
      titleClass: "text-accent",
      textClass: "text-accent/80",
      description: `Current refund status update.`,
      statusLabel: getLabel(),
    };
  }

  const statusChipClass = statusStyles[effectiveStatus] || "bg-light text-dark";
  const formattedStatus = formatStatusLabel(effectiveStatus);
  const refundInfo = order
    ? getRefundStatusInfo(effectiveStatus, order.refund_status)
    : null;

  const handleRatingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) return;
    if (ratingValue < 1) {
      setRatingError("Please select a rating before submitting.");
      return;
    }
    setSubmittingRating(true);
    setRatingError("");
    try {
      const updated = await submitOrderRating(order.id, ratingValue, ratingReview);
      setRatingValue(updated?.rating_value || ratingValue);
      setRatingReview(updated?.rating_review || ratingReview);
      if (onRatingUpdate && updated) {
        onRatingUpdate(updated);
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
      setRatingError("Failed to submit rating. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const quantity = extractOrderQuantity(order);

  return (
    <Portal>
      <AnimatePresence>
        {showActionModal && (
          <RequestActionModal
            actionType={showActionModal}
            onClose={() => setShowActionModal(null)}
            onSubmit={handleActionSubmit}
            loading={loading}
          />
        )}
      </AnimatePresence>

      <div className="fixed inset-0 bg-dark/70 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <header className="flex-shrink-0 flex justify-between items-center p-5 border-b border-accent/10">
            <h2 className="text-xl font-bold font-display text-dark">Order Detail</h2>
            <button onClick={onClose} className="p-2 rounded-full text-muted hover:bg-light hover:text-dark">
              <X size={22} />
            </button>
          </header>
          
          <main className="flex-grow p-6 overflow-y-auto space-y-6">
            <section className="p-5 bg-light rounded-xl border border-accent/15 space-y-4">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <p className="text-sm text-muted">Order ID #{order.id}</p>
                  <h3 className="text-2xl font-semibold text-dark mt-1">{order.service}</h3>
                </div>
                <div className={`px-3 py-1 text-xs font-semibold capitalize rounded-full ${statusChipClass}`}>
                  {formattedStatus}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-accent/15 text-sm text-dark">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Info size={16} className="text-primary/70" />
                    <span className="text-dark font-medium">Qty: {quantity}</span>
                  </div>
                  <span className="font-semibold text-dark text-lg">{formatPrice(order.amount)}</span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-5">
              <div className="p-5 rounded-xl border border-accent/15 bg-white space-y-4">
                <h4 className="font-semibold text-dark">Customer Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <User size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-muted">Name</p>
                      <p className="text-dark font-medium">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-muted">Email</p>
                      <p className="text-dark font-medium">{order.customer_email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-muted">Phone</p>
                      <p className="text-dark font-medium">{order.customer_phone || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 rounded-xl border border-accent/15 bg-white space-y-4">
                <h4 className="font-semibold text-dark">Payment Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CreditCard size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-muted">Payment Method</p>
                        <p className="text-dark font-semibold">{paymentMethodInfo.label}</p>
                      </div>
                      {paymentMethodInfo.logos.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {paymentMethodInfo.logos.map((logo) => (
                            <div key={logo.src} className="flex h-8 items-center">
                              <Image
                                src={logo.src}
                                alt={logo.alt}
                                width={64}
                                height={32}
                                className="h-8 w-auto object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {paymentStatus && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-muted">Payment Status</p>
                        <p className="text-dark font-medium">{formatPaymentStatus(paymentStatus)}</p>
                      </div>
                    </div>
                  )}
                  {order.payment_reference && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-muted">Reference</p>
                        <p className="text-dark font-medium">{order.payment_reference}</p>
                      </div>
                    </div>
                  )}
                  {transaction?.channel && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-muted">Channel</p>
                        <p className="text-dark font-medium">{formatPaymentMethod(transaction.channel)}</p>
                      </div>
                    </div>
                  )}
                  {transaction?.virtual_account_number && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-muted">Virtual Account</p>
                        <p className="text-dark font-medium font-mono">{transaction.virtual_account_number}</p>
                      </div>
                    </div>
                  )}
                  {(paymentExpiresAt || paymentCountdown === "Cancelled") && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-muted">Payment Expires</p>
                        <p className={`font-semibold ${isCriticalPaymentState ? "text-danger" : "text-dark"}`}>
                          {paymentCountdown ?? (paymentExpiresAt ? formatDate(paymentExpiresAt) : "-")}
                        </p>
                        {paymentCountdown &&
                          paymentExpiresAt &&
                          !["Expired", "Cancelled"].includes(paymentCountdown) && (
                            <p className="text-xs text-muted">Expires at {formatDate(paymentExpiresAt)}</p>
                        )}
                        {paymentCountdown === "Expired" && paymentExpiresAt && (
                          <p className="text-xs text-muted">Expired at {formatDate(paymentExpiresAt)}</p>
                        )}
                        {paymentCountdown === "Cancelled" && (
                          <p className="text-xs text-muted">Payment was cancelled and can no longer be completed.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {transaction?.invoice_url && (
                    <div className="flex items-start gap-3">
                      <Info size={16} className="mt-1 text-primary/70 flex-shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium text-muted">Invoice</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                window.open(transaction.invoice_url ?? "", "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            Open Invoice
                          </Button>
                          <a
                            href={transaction.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary underline"
                          >
                            View in new tab
                          </a>
                        </div>
                        <p className="text-xs text-muted break-all">{transaction.invoice_url}</p>
                      </div>
                    </div>
                  )}
                  {!transaction?.invoice_url && !transaction?.virtual_account_number && (
                    <p className="text-sm text-muted p-3 bg-light rounded-lg border">
                      The payment invoice is not available yet. Use the refresh button to load the latest status.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {order.notes && (
              <section className="p-5 rounded-xl border border-accent/15 bg-white">
                <h4 className="font-semibold text-dark">Notes</h4>
                <p className="text-sm text-dark mt-3 leading-relaxed">{order.notes}</p>
              </section>
            )}

            {effectiveStatus === "done" && (
              <section className="p-4 rounded-lg border border-accent/15 bg-light">
                <h4 className="font-semibold text-dark">Service Rating</h4>
                {order.rating_value && order.rating_value > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {renderStaticStars(order.rating_value)}
                      <span className="text-sm font-semibold text-dark">
                        {order.rating_value}/5
                      </span>
                    </div>
                    {order.rating_review && (
                      <p className="text-sm text-muted">{order.rating_review}</p>
                    )}
                  </div>
                ) : (
                  <form className="mt-3 space-y-3" onSubmit={handleRatingSubmit}>
                    <div className="flex items-center gap-2">
                      {starOptions.map((value) => {
                        const filled = value <= ratingValue;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRatingValue(value)}
                            disabled={submittingRating}
                            className="p-1 transition focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
                            aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                          >
                            <Star
                              size={26}
                              className={filled ? "text-primary fill-primary" : "text-muted/30"}
                              fill="currentColor"
                            />
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      rows={3}
                      className="w-full form-input"
                      placeholder="Tell us about your experience (optional)"
                      value={ratingReview}
                      onChange={(e) => setRatingReview(e.target.value)}
                      disabled={submittingRating}
                    />
                    {ratingError && <p className="text-sm text-danger">{ratingError}</p>}
                    <Button type="submit" disabled={submittingRating || ratingValue === 0}>
                      {submittingRating ? "Submitting..." : "Submit Rating"}
                    </Button>
                  </form>
                )}
              </section>
            )}
            
            {refundInfo && (
              <section className={`p-4 rounded-lg border ${refundInfo.containerClass}`}>
                <h4 className={`font-semibold ${refundInfo.titleClass}`}>Refund Status</h4>
                <p className={`text-sm mt-1 ${refundInfo.textClass}`}>
                  {refundInfo.description}
                  {refundInfo.statusLabel && (
                    <>
                      {" "}
                      Current status:{" "}
                      <span className="font-semibold">
                        {refundInfo.statusLabel}
                      </span>
                      .
                    </>
                  )}
                </p>
              </section>
            )}
          </main>
          
          {(effectiveStatus === "pending" || effectiveStatus === "awaiting_confirmation") && (
            <footer className="flex-shrink-0 p-4 bg-white flex items-center gap-3">
              {effectiveStatus === "pending" && (
                <>
                  <Button variant="danger" className="flex-1" onClick={() => setShowActionModal('cancel')}>
                      <Trash2 size={16} className="mr-2"/> Cancel Order
                  </Button>
                  <Link
                    href={`/checkout/payment/${order.id}`}
                    className="flex-1"
                    onClick={onClose}
                  >
                      <Button fullWidth>
                          Continue Payment Process <ArrowRight size={18} className="ml-2"/>
                      </Button>
                  </Link>
                </>
              )}
              {effectiveStatus === "awaiting_confirmation" && (
                <Button variant="outline" fullWidth onClick={() => setShowActionModal('refund')}>
                    <RefreshCw size={16} className="mr-2"/> Request Refund
                </Button>
              )}
            </footer>
          )}
        </motion.div>
      </div>
    </Portal>
  );
}