"use client";

import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  Banknote,
  Building,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  QrCode,
  ShoppingBag,
  Smartphone,
  Store,
  User,
  Wallet,
} from "lucide-react";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";
import Alert from "@/components/Alert";
import Textarea from "@/components/Textarea";
import { useCartStore } from "@/store/cart";
import { createOrder, getPaymentAvailability } from "@/lib/api";
import type { PaymentChannelStatus } from "@/lib/types";

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Math.max(amount, 0) * 15000);

type PaymentChannelOption = {
  id: string;
  label: string;
  description?: string;
  logoSrc?: string;
};

type PaymentCategoryOption = {
  id: PaymentCategory;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  channels: PaymentChannelOption[];
};

type PaymentCategory =
  | "VIRTUAL_ACCOUNT"
  | "EWALLET"
  | "QRIS"
  | "RETAIL_OUTLET"
  | "PAYLATER"
  | "CARD";

const getCollapsedState = (): Record<PaymentCategory, boolean> => ({
  VIRTUAL_ACCOUNT: false,
  EWALLET: false,
  QRIS: false,
  RETAIL_OUTLET: false,
  PAYLATER: false,
  CARD: false,
});

const INITIAL_EXPANDED: Record<PaymentCategory, boolean> = {
  ...getCollapsedState(),
  VIRTUAL_ACCOUNT: true,
};

const PAYMENT_OPTIONS: PaymentCategoryOption[] = [
  {
    id: "VIRTUAL_ACCOUNT",
    title: "Virtual Account",
    description: "Automatic bank transfer using your preferred bank.",
    icon: Building,
    channels: [
      { id: "BCA", label: "BCA", logoSrc: "/images/payment-logos/bca.svg" },
      { id: "BNI", label: "BNI", logoSrc: "/images/payment-logos/bni.svg" },
      { id: "BRI", label: "BRI", logoSrc: "/images/payment-logos/bri.svg" },
      {
        id: "MANDIRI",
        label: "Mandiri",
        logoSrc: "/images/payment-logos/mandiri.svg",
      },
      {
        id: "PERMATA",
        label: "Permata",
        logoSrc: "/images/payment-logos/permata.svg",
      },
      {
        id: "CIMB",
        label: "CIMB Niaga",
        logoSrc: "/images/payment-logos/cimb.svg",
      },
      { id: "BSI", label: "BSI", logoSrc: "/images/payment-logos/bsi.svg" },
      { id: "BJB", label: "BJB", logoSrc: "/images/payment-logos/bjb.svg" },
      {
        id: "BSS",
        label: "Bank Sahabat Sampoerna",
        logoSrc: "/images/payment-logos/bss.svg",
      },
    ],
  },
  {
    id: "EWALLET",
    title: "E-Wallet",
    description: "Instant payment using your favourite digital wallet.",
    icon: Wallet,
    channels: [
      { id: "OVO", label: "OVO", logoSrc: "/images/payment-logos/ovo.svg" },
      { id: "DANA", label: "DANA", logoSrc: "/images/payment-logos/dana.svg" },
      {
        id: "SHOPEEPAY",
        label: "ShopeePay",
        logoSrc: "/images/payment-logos/shopeepay.svg",
      },
      {
        id: "LINKAJA",
        label: "LinkAja",
        logoSrc: "/images/payment-logos/linkaja.svg",
      },
      {
        id: "ASTRAPAY",
        label: "AstraPay",
        logoSrc: "/images/payment-logos/astrapay.svg",
      },
    ],
  },
  {
    id: "QRIS",
    title: "QRIS",
    description: "Scan a dynamic QR and pay from any supported app.",
    icon: QrCode,
    channels: [
      {
        id: "QRIS",
        label: "QRIS Dinamis",
        logoSrc: "/images/payment-logos/qris.svg",
      },
    ],
  },
  {
    id: "RETAIL_OUTLET",
    title: "Retail Store",
    description: "Pay through nearby stores such as Alfamart/Indomaret.",
    icon: Store,
    channels: [
      {
        id: "ALFAMART",
        label: "Alfamart",
        logoSrc: "/images/payment-logos/alfamart.svg",
      },
      {
        id: "INDOMARET",
        label: "Indomaret",
        logoSrc: "/images/payment-logos/indomaret.svg",
      },
    ],
  },
  {
    id: "PAYLATER",
    title: "PayLater",
    description: "Use your Kredivo or Akulaku PayLater limit.",
    icon: Smartphone,
    channels: [
      {
        id: "KREDIVO",
        label: "Kredivo",
        logoSrc: "/images/payment-logos/kredivo.svg",
      },
      {
        id: "AKULAKU",
        label: "Akulaku",
        logoSrc: "/images/payment-logos/akulaku.svg",
      },
    ],
  },
  {
    id: "CARD",
    title: "Credit / Debit Card",
    description: "Enter your card details securely.",
    icon: CreditCard,
    channels: [
      { id: "CARD", label: "Pay with Card", logoSrc: "/images/payment-logos/visa.svg" },
    ],
  },
];

const DEFAULT_UNAVAILABLE_MESSAGE =
  "Payment temporarily unavailable — please try again later.";

type SelectedPayment = {
  category: PaymentCategory | null;
  channel: string | null;
};

const categoryBackground: Record<PaymentCategory, string> = {
  VIRTUAL_ACCOUNT: "bg-blue-50 border-blue-200",
  EWALLET: "bg-purple-50 border-purple-200",
  QRIS: "bg-orange-50 border-orange-200",
  RETAIL_OUTLET: "bg-emerald-50 border-emerald-200",
  PAYLATER: "bg-amber-50 border-amber-200",
  CARD: "bg-sky-50 border-sky-200",
};

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items: cartItems,
    promoCode,
    promoDiscountPercent,
    clearCart,
    clearPromo,
  } = useCartStore();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SelectedPayment>({
    category: null,
    channel: null,
  });
  const [expanded, setExpanded] =
    useState<Record<PaymentCategory, boolean>>(INITIAL_EXPANDED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentAvailability, setPaymentAvailability] =
    useState<Record<string, PaymentChannelStatus>>({});

  const buildAvailabilityKey = useCallback(
    (category: string, channel?: string | null) => {
      const normalizedCategory = category.toUpperCase();
      const normalizedChannel = (channel ?? normalizedCategory).toUpperCase();
      return `${normalizedCategory}::${normalizedChannel}`;
    },
    [],
  );

  const fetchAvailability = useCallback(async () => {
    try {
      const response = await getPaymentAvailability();
      const statuses = Array.isArray(response?.statuses)
        ? response.statuses
        : [];
      const map: Record<string, PaymentChannelStatus> = {};
      statuses.forEach((status) => {
        if (!status?.category) {
          return;
        }
        const key = buildAvailabilityKey(
          status.category,
          status.channel ?? status.category,
        );
        map[key] = {
          ...status,
          category: status.category.toUpperCase(),
          channel: (status.channel ?? status.category).toUpperCase(),
        };
      });
      setPaymentAvailability(map);
    } catch (err) {
      console.error("Failed to load payment availability", err);
    }
  }, [buildAvailabilityKey]);

  const getChannelStatus = useCallback(
    (category: PaymentCategory, channel: string | null) => {
      const specificKey = buildAvailabilityKey(category, channel);
      const categoryKey = buildAvailabilityKey(category);
      return (
        paymentAvailability[specificKey] ?? paymentAvailability[categoryKey]
      );
    },
    [buildAvailabilityKey, paymentAvailability],
  );

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    if (!selectedPayment.category || !selectedPayment.channel) {
      return;
    }
    const status = getChannelStatus(
      selectedPayment.category,
      selectedPayment.channel,
    );
    if (status && status.available === false) {
      setSelectedPayment({ category: null, channel: null });
    }
  }, [
    getChannelStatus,
    selectedPayment.category,
    selectedPayment.channel,
  ]);

  const calculateItemTotal = (item: (typeof cartItems)[number]) => {
    const addonsTotal =
      item.selectedAddOns?.reduce((sum, addon) => sum + addon.price, 0) ?? 0;
    return roundCurrency((item.price + addonsTotal) * item.quantity);
  };

  const subtotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + calculateItemTotal(item), 0),
    [cartItems],
  );

  const discountAmount = promoCode
    ? roundCurrency(subtotal * ((promoDiscountPercent ?? 0) / 100))
    : 0;

  const total = roundCurrency(Math.max(subtotal - discountAmount, 0));
  const hasCartItems = cartItems.length > 0;
  const selectedPaymentOption = selectedPayment.category
    ? PAYMENT_OPTIONS.find((opt) => opt.id === selectedPayment.category)
    : undefined;
  const selectedChannel = selectedPaymentOption?.channels.find(
    (channel) => channel.id === selectedPayment.channel,
  );
  const selectedChannelLabel = selectedChannel?.label ?? selectedPayment.channel;
  const selectedPaymentSummary =
    selectedPayment.category === "QRIS" || selectedPayment.category === "CARD"
      ? selectedPaymentOption?.title ?? selectedChannelLabel
      : [selectedPaymentOption?.title, selectedChannelLabel]
          .filter(Boolean)
          .join(" • ");

  const handleSelectCategory = (category: PaymentCategory, channel: string) => {
    const status = getChannelStatus(category, channel);
    if (status && status.available === false) {
      return;
    }
    setSelectedPayment({ category, channel });
    setExpanded(() => {
      const base = getCollapsedState();
      base[category] = true;
      return base;
    });
  };

  const toggleCategory = (category: PaymentCategory) => {
    setExpanded((prev) => {
      const shouldExpand = !prev[category];
      const base = getCollapsedState();
      if (shouldExpand) {
        base[category] = true;
      }
      return base;
    });
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.match(/\.(pdf|docx?|PDF|DOCX?)$/)) {
      setBriefFile(droppedFile);
    }
    event.dataTransfer.clearData();
  };

  const handleFileInput = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = files[0];
    if (selected.name.match(/\.(pdf|docx?|PDF|DOCX?)$/)) {
      setBriefFile(selected);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setSuccessMessage(null);

    if (!hasCartItems) {
      setError("Your cart is still empty.");
      return;
    }
    if (!customerName || !customerEmail) {
      setError("Name and email are required before continuing to payment.");
      return;
    }
    if (!selectedPayment.category || !selectedPayment.channel) {
      setError("Please choose a payment method first.");
      return;
    }

    const availability = getChannelStatus(
      selectedPayment.category,
      selectedPayment.channel,
    );
    if (availability && availability.available === false) {
      setError(availability.message ?? DEFAULT_UNAVAILABLE_MESSAGE);
      return;
    }

    const primaryItem = cartItems[0];
    if (!primaryItem) {
      setError("No services were found in the cart.");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        service_slug: primaryItem.slug,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        notes,
        payment_category: selectedPayment.category,
        payment_channel: selectedPayment.channel,
      };
      if (promoCode) {
        payload.promo_code = promoCode;
      }

      const response = await createOrder(payload);
      const createdOrder = response?.order ?? response;
      const orderId = createdOrder?.id;

      if (!orderId) {
        throw new Error("Failed to create the order.");
      }

      clearCart();
      clearPromo();
      setSuccessMessage(
        "Order created successfully. Redirecting to the payment page...",
      );
      router.push(`/checkout/payment/${orderId}`);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ??
        err?.message ??
        "Failed to process the payment.";
      setError(message);
      void fetchAvailability();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 lg:py-16">
      <div className="mb-10">
        <Link
          href="/services"
          className="inline-flex items-center text-accent hover:text-primary transition"
        >
          <ChevronDown className="rotate-90 w-5 h-5 mr-1" />
          Back to Services
        </Link>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-4 text-dark">
          Checkout & Payment
        </h1>
        <p className="text-muted mt-2 max-w-2xl">
          Complete your order details and choose your preferred payment method.
          All transactions are securely processed via Xendit.
        </p>
      </div>

      {!hasCartItems && (
        <Alert variant="warning" title="Empty cart" className="mb-8">
          Please add at least one service before proceeding to checkout.
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" className="mb-6" icon>
          {successMessage}
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <section className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBag className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-dark">Cart Summary</h2>
            </div>
            <div className="space-y-4">
              {cartItems.length ? (
                cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-dark">{item.title}</p>
                        <p className="text-sm text-muted">Qty {item.quantity}</p>
                      </div>
                      <span className="font-semibold text-primary">
                        {formatPrice(calculateItemTotal(item))}
                      </span>
                    </div>
                    {item.selectedAddOns?.length ? (
                      <ul className="mt-3 space-y-1 text-sm text-muted">
                        {item.selectedAddOns.map((addon) => (
                          <li key={addon.name} className="flex justify-between">
                            <span>+ {addon.name}</span>
                            <span>{formatPrice(addon.price)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Your cart is empty. Please add a service to continue.
                </p>
              )}
            </div>
          </section>

          <section className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-dark">Customer Details</h2>
            </div>
            <div className="flex flex-col gap-4">
              <FormInput
                label="Full Name"
                placeholder="Name as shown on ID"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
              <FormInput
                label="Email"
                placeholder="email@domain.com"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
              <FormInput
                label="Phone Number"
                placeholder="08xxxxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark">Additional Notes</label>
                <Textarea
                  placeholder="Share any specific requests, ideas, or brief details for our team."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[160px] text-base"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-dark">
                  Upload Project Brief (Optional)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleFileDrop}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    isDraggingFile
                      ? "border-primary bg-primary/5"
                      : "border-accent/30 bg-light"
                  }`}
                >
                  <p className="text-sm font-medium text-dark">
                    Drag & drop your PDF or DOC file here
                  </p>
                  <p className="text-xs text-muted">
                    Maximum size 10MB. Accepted formats: .pdf, .doc, .docx
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => handleFileInput(event.target.files)}
                  />
                  {briefFile ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-dark shadow-sm">
                      <span className="font-medium truncate max-w-[200px]">
                        {briefFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBriefFile(null)}
                        className="text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-dark">Payment Methods</h2>
            </div>
            <p className="text-sm text-muted mb-6">
              Choose one of the payment methods below. You will be redirected to
              the payment page according to your selection.
            </p>
            <div className="space-y-4">
              {PAYMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isExpanded = expanded[option.id];
                const isSelected = selectedPayment.category === option.id;
                const isDirectSelection = option.id === "QRIS" || option.id === "CARD";
                const background = categoryBackground[option.id];
                const defaultChannelId = option.channels[0]?.id ?? option.id;
                const directStatus = getChannelStatus(
                  option.id,
                  defaultChannelId,
                );
                const disabledStatuses = option.channels
                  .map((channel) => getChannelStatus(option.id, channel.id))
                  .filter(
                    (status): status is PaymentChannelStatus =>
                      Boolean(status && status.available === false),
                  );
                const allChannelsDisabled =
                  option.channels.length > 0 &&
                  disabledStatuses.length === option.channels.length;
                const categoryDisabled =
                  isDirectSelection && directStatus?.available === false;
                const shouldDisableCategory = isDirectSelection
                  ? categoryDisabled
                  : allChannelsDisabled;
                const categoryTooltip = shouldDisableCategory
                  ? (isDirectSelection
                      ? directStatus?.message
                      : disabledStatuses[0]?.message) ?? DEFAULT_UNAVAILABLE_MESSAGE
                  : undefined;
                return (
                  <div
                    key={option.id}
                    className={`border rounded-2xl transition ${
                      isSelected ? background : "bg-slate-50 border-slate-200"
                    } ${shouldDisableCategory ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      disabled={shouldDisableCategory}
                      className={`w-full flex items-center justify-between px-4 py-3 ${
                        shouldDisableCategory ? "cursor-not-allowed" : ""
                      }`}
                      onClick={() => {
                        if (shouldDisableCategory) {
                          return;
                        }
                        if (isDirectSelection) {
                          const defaultChannel =
                            option.channels[0]?.id ?? option.id;
                          handleSelectCategory(option.id, defaultChannel);
                        } else {
                          toggleCategory(option.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-4 text-left">
                        <div
                          className={`p-2.5 rounded-xl ${isSelected ? "bg-white/70" : "bg-white"}`}
                        >
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-dark flex items-center gap-2">
                            {option.title}
                            {shouldDisableCategory && (
                              <span
                                className="inline-flex items-center text-amber-600"
                                title={categoryTooltip}
                                aria-label="Payment method unavailable"
                              >
                                <AlertTriangle className="w-4 h-4" aria-hidden />
                              </span>
                            )}
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </h3>
                          <p className="text-xs text-muted mt-1">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      {!isDirectSelection && (
                        isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted" />
                        )
                      )}
                    </button>
                    {!isDirectSelection && isExpanded && (
                      <div className="px-4 pb-4 grid gap-2 sm:grid-cols-2">
                        {option.channels.map((channel) => {
                          const channelSelected =
                            isSelected &&
                            selectedPayment.channel === channel.id;
                          const channelStatus = getChannelStatus(
                            option.id,
                            channel.id,
                          );
                          const channelDisabled =
                            channelStatus?.available === false;
                          const channelTooltip =
                            channelStatus?.message ?? DEFAULT_UNAVAILABLE_MESSAGE;
                          return (
                            <button
                              key={channel.id}
                              type="button"
                              disabled={channelDisabled}
                              onClick={() => {
                                if (channelDisabled) return;
                                handleSelectCategory(option.id, channel.id);
                              }}
                              className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                                channelDisabled
                                  ? "border-slate-200 bg-slate-100 cursor-not-allowed opacity-60"
                                  : channelSelected
                                  ? "border-primary bg-white text-primary shadow"
                                  : "border-slate-200 bg-white hover:border-primary/60"
                              }`}
                              aria-disabled={channelDisabled}
                            >
                              <div className="flex items-center gap-3">
                                {channel.logoSrc ? (
                                  <div className="relative w-6 h-6">
                                    <Image
                                      src={channel.logoSrc}
                                      alt={`${channel.label} logo`}
                                      fill
                                      sizes="40px"
                                      className="object-contain"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                                    {channel.label.slice(0, 3).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm font-medium flex items-center gap-2">
                                  {channel.label}
                                  {channelDisabled && (
                                    <span
                                      className="inline-flex items-center text-amber-600"
                                      title={channelTooltip}
                                      aria-label="Payment channel unavailable"
                                    >
                                      <AlertTriangle className="w-4 h-4" aria-hidden />
                                    </span>
                                  )}
                                </span>
                              </div>
                              {channelSelected && !channelDisabled && (
                                <CheckCircle className="w-4 h-4 text-primary" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white h-fit">
            <div className="flex items-center gap-3 mb-4">
              <Banknote className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-dark">Payment Details</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {promoCode && (
                <div className="flex justify-between text-success">
                  <span>Discount ({promoCode})</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-3">
                <span className="font-semibold text-dark">Amount Due</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {selectedPayment.category && (
              <div className="mt-6 p-4 border border-primary/40 rounded-xl bg-primary/5">
                <p className="text-sm text-dark font-medium">Selected method:</p>
                <p className="text-base font-semibold text-primary mt-1">
                  {selectedPaymentSummary}
                </p>
                <p className="text-xs text-muted mt-2">
                  You will be redirected to the payment page after clicking the
                  button below.
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !hasCartItems ||
                !selectedPayment.category ||
                !selectedPayment.channel
              }
              className="w-full mt-6"
            >
              {loading ? "Processing..." : "Proceed to Payment"}
            </Button>

            <p className="text-xs text-muted mt-4">
              By continuing, you agree to Devara Creative's service policies.
              Payments are secured by Xendit and will expire if not completed in
              time.
            </p>
            <Link
              href="/privacy"
              className="mt-3 inline-flex items-center text-xs text-accent hover:text-primary transition"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View terms & privacy policy
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}