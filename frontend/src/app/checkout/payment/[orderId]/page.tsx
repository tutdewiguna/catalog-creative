"use client";

import { useEffect, useMemo, useState, type ComponentType, type FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building,
  Clock,
  CreditCard,
  Loader2,
  QrCode,
  Store,
  Wallet,
} from "lucide-react";
import Alert from "@/components/Alert";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";
import { chargeOrderCard, getOrderById } from "@/lib/api";
import type { PaymentTransaction } from "@/lib/types";
import { createCardToken } from "@/lib/payments";
import PaymentInstructions from "@/components/PaymentInstructions";

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Math.max(amount, 0) * 15000);

const methodIcon: Record<string, ComponentType<{ className?: string }>> = {
  QRIS: QrCode,
  VIRTUAL_ACCOUNT: Building,
  BANK_TRANSFER: Building,
  EWALLET: Wallet,
  RETAIL_OUTLET: Store,
  PAYLATER: Wallet,
  CARD: CreditCard,
};

type OrderDetail = {
  id: number;
  status: string;
  amount: number;
  payment_status?: string;
  payment_method?: string;
  payment_reference?: string;
  payment_expires_at?: string;
  customer_name: string;
  customer_email: string;
  latest_transaction?: PaymentTransaction;
};

const formatStatus = (status?: string) => {
  if (!status) return "Awaiting Payment";
  switch (status.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
    case "SUCCESS":
    case "SETTLED":
      return "Payment Completed";
    case "PENDING":
    case "UNPAID":
      return "Awaiting Payment";
    case "EXPIRED":
      return "Payment Expired";
    case "FAILED":
    case "CANCELLED":
      return "Payment Failed";
    default:
      return status;
  }
};

const SUCCESS_STATUSES = new Set(["PAID", "COMPLETED", "SUCCESS", "SETTLED"]);

const isSuccessfulStatus = (status?: string | null) => {
  if (!status) return false;
  return SUCCESS_STATUSES.has(status.toUpperCase());
};

const isClosedStatus = (status?: string | null) => {
  if (!status) return false;
  const upper = status.toUpperCase();
  if (
    upper === "PENDING" ||
    upper === "UNPAID" ||
    upper === "NEEDS_ACTION" ||
    upper === "REQUIRES_ACTION" ||
    upper === "AWAITING_PAYMENT" ||
    upper === "IN_PROGRESS"
  ) {
    return false;
  }
  return (
    upper.includes("CANCEL") ||
    upper.includes("EXPIRE") ||
    upper.includes("FAIL") ||
    upper.includes("VOID") ||
    upper.includes("REFUND")
  );
};

const hasPaymentExpired = (
  order?: Pick<OrderDetail, "payment_expires_at"> | null,
  transaction?: Pick<PaymentTransaction, "expires_at"> | null,
) => {
  const expiry = transaction?.expires_at ?? order?.payment_expires_at;
  if (!expiry) return false;
  const timestamp = new Date(expiry).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp <= Date.now();
};

const isPaid = (order?: OrderDetail | null) => {
  if (!order) return false;
  const status = order.status?.toUpperCase();
  const paymentStatus = order.payment_status?.toUpperCase();
  const transactionStatus = order.latest_transaction?.status?.toUpperCase();
  return (
    SUCCESS_STATUSES.has(status ?? "") ||
    SUCCESS_STATUSES.has(paymentStatus ?? "") ||
    SUCCESS_STATUSES.has(transactionStatus ?? "")
  );
};

const isOrderClosed = (
  order?: OrderDetail | null,
  transaction?: PaymentTransaction | null,
) => {
  if (!order) return false;
  const statuses = [
    order.status,
    order.payment_status,
    transaction?.status ?? order.latest_transaction?.status,
  ];
  const hasSuccessful = statuses.some(isSuccessfulStatus);
  if (hasSuccessful) return false;
  if (statuses.some(isClosedStatus)) return true;
  if (hasPaymentExpired(order, transaction ?? order.latest_transaction)) return true;
  return false;
};

const formatCountdown = (expiresAt?: string) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "Expired";
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
  return `${hours}:${minutes}:${seconds}`;
};

const cardBrandLogos: Record<string, string> = {
  VISA: "/images/payment-logos/visa.svg",
  MASTERCARD: "/images/payment-logos/mastercard.svg",
  JCB: "/images/payment-logos/jcb.svg",
  AMEX: "/images/payment-logos/amex.svg",
};

type PaymentPageProps = {
  params: Promise<{ orderId: string }>;
};

export default function PaymentPage({ params: paramsPromise }: PaymentPageProps) {
  const params = use(paramsPromise);
  const { orderId } = params;
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [cardRedirectUrl, setCardRedirectUrl] = useState<string | null>(null);
  const [detectedCardBrand, setDetectedCardBrand] = useState<string>("");

  const fetchOrder = async (silent = false): Promise<OrderDetail | null> => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const data = await getOrderById(String(orderId));
      setOrder(data);
      setTransaction(data?.latest_transaction ?? null);
      setError(null);
      setClosedReason(null);
      return data ?? null;
    } catch (err: any) {
      const status = err?.response?.status;
      const responseMessage: string | undefined = err?.response?.data?.error;
      const closedMessage =
        responseMessage ?? "This order is no longer available for payment because it has been cancelled or expired.";
      if (status === 410 || status === 403) {
        setOrder(null);
        setTransaction(null);
        setClosedReason(closedMessage);
        setError(null);
        return null;
      }
      if (status === 404) {
        setOrder(null);
        setTransaction(null);
        setError("We couldn't find this order. Please check your payment link or create a new order.");
        setClosedReason(null);
        return null;
      }
      const message = responseMessage ?? err?.message ?? "Failed to load payment details.";
      setError(message);
      setClosedReason(null);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (!transaction?.expires_at) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(formatCountdown(transaction.expires_at));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [transaction?.expires_at]);

  const paymentMethodLabel = useMemo(() => {
    const method = transaction?.method?.toUpperCase() ?? "";
    const channel = transaction?.channel?.toUpperCase() ?? "";
    if (!method) return "";
    switch (method) {
      case "VIRTUAL_ACCOUNT":
      case "BANK_TRANSFER":
        return channel ? `Virtual Account ${channel}` : "Virtual Account";
      case "EWALLET":
        return channel ? `${channel} E-Wallet` : "E-Wallet";
      case "QRIS":
        return "Dynamic QRIS";
      case "RETAIL_OUTLET":
        return channel ? `${channel} Payment Code` : "Retail Outlet";
      case "PAYLATER":
        return channel ? `${channel} PayLater` : "PayLater";
      case "CARD":
        return "Credit / Debit Card";
      default:
        return method;
    }
  }, [transaction?.method, transaction?.channel]);

  const Icon = useMemo(() => {
    const key = transaction?.method?.toUpperCase() ?? "";
    return methodIcon[key] ?? CreditCard;
  }, [transaction?.method]);

  const expiresAt = transaction?.expires_at ?? order?.payment_expires_at;

  useEffect(() => {
    if (transaction?.method?.toUpperCase() === "CARD" && transaction.checkout_url) {
      setCardRedirectUrl(transaction.checkout_url);
    } else if (transaction?.method?.toUpperCase() !== "CARD") {
      setCardRedirectUrl(null);
    }
  }, [transaction?.checkout_url, transaction?.method]);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const detectCardBrand = (digits: string): string => {
    if (/^4/.test(digits)) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(digits)) return "MASTERCARD";
    if (/^3[47]/.test(digits)) return "AMEX";
    if (/^35/.test(digits)) return "JCB";
    return "";
  };

  const brandLogoSrc = detectedCardBrand ? cardBrandLogos[detectedCardBrand] : "";

  const handleCardNumberChange = (value: string) => {
    setCardError(null);
    setCardSuccess(null);
    const formatted = formatCardNumber(value);
    setCardNumber(formatted);
    const digits = formatted.replace(/\D/g, "");
    setDetectedCardBrand(detectCardBrand(digits));
  };

  const handleCardExpiryChange = (value: string) => {
    setCardError(null);
    setCardSuccess(null);
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) {
      setCardExpiry(digits);
      return;
    }
    setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
  };

  const handleCardCvvChange = (value: string) => {
    setCardError(null);
    setCardSuccess(null);
    setCardCvv(value.replace(/\D/g, "").slice(0, 4));
  };

  const validateCardForm = () => {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) {
      setCardError("The card number looks invalid.");
      return false;
    }
    const expiryDigits = cardExpiry.replace(/\D/g, "");
    if (expiryDigits.length < 4) {
      setCardError("The card expiry date must use the MM/YY format.");
      return false;
    }
    const month = parseInt(expiryDigits.slice(0, 2), 10);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      setCardError("The card expiry month is not valid.");
      return false;
    }
    const yearDigits = expiryDigits.slice(2);
    const year = parseInt(yearDigits.length === 2 ? `20${yearDigits}` : yearDigits, 10);
    if (Number.isNaN(year)) {
      setCardError("The card expiry year is not valid.");
      return false;
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      setCardError("This card has already expired.");
      return false;
    }
    const cvvDigits = cardCvv.replace(/\D/g, "");
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      setCardError("The CVV code must be 3 or 4 digits.");
      return false;
    }
    return {
      digits,
      expMonth: String(month).padStart(2, "0"),
      expYear: String(year),
      cvvDigits,
    };
  };

  const handleCardSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cardProcessing) return;
    setCardError(null);
    setCardSuccess(null);
    if (!order) {
      setCardError("We could not find the order details.");
      return;
    }
    const validated = validateCardForm();
    if (!validated) return;
    try {
      setCardProcessing(true);
      const amount = Math.max(Math.round(transaction?.amount ?? order.amount ?? 0), 1);
      const token = await createCardToken({
        cardNumber: validated.digits,
        expMonth: validated.expMonth,
        expYear: validated.expYear,
        cvn: validated.cvvDigits,
        amount,
        cardholderName: cardholderName.trim() || undefined,
        email: order.customer_email,
      });
      const brandToSend =
        detectedCardBrand ||
        token.card_brand?.toUpperCase() ||
        token.card_info?.brand?.toUpperCase() ||
        "UNKNOWN";
      const chargeResponse = await chargeOrderCard(orderId, {
        tokenId: token.id,
        cardBrand: brandToSend,
      });
      if (chargeResponse?.transaction) setTransaction(chargeResponse.transaction);
      if (chargeResponse?.order) setOrder(chargeResponse.order);
      const latestOrder = await fetchOrder(true);
      const resolvedOrder = latestOrder ?? chargeResponse?.order ?? order;
      const latestTx = chargeResponse?.transaction ?? latestOrder?.latest_transaction ?? null;
      const latestStatus = latestTx?.status?.toUpperCase();
      const redirectUrl =
        latestTx?.checkout_url ?? chargeResponse?.transaction?.checkout_url ?? null;
      if (latestStatus === "REQUIRES_ACTION") {
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        } else {
          setCardError("Additional authentication is required, but we couldn't redirect you to your bank. Please try again.");
        }
      }
      if (isPaid(resolvedOrder) || isSuccessfulStatus(latestStatus)) {
        setCardSuccess("Your card payment has been confirmed. Thank you!");
        setCardError(null);
        return;
      }
      setCardSuccess("Your card details were submitted. We are waiting for confirmation from your bank.");
    } catch (err: any) {
      const message = err?.message ?? "Something went wrong while processing your card.";
      setCardError(message);
    } finally {
      setCardProcessing(false);
    }
  };

  const renderCardLogos = () => {
    if (detectedCardBrand) {
      const src = cardBrandLogos[detectedCardBrand];
      return (
        <AnimatePresence>
          <motion.div
            key={detectedCardBrand}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.25 }}
            className="h-6 w-10 relative"
          >
            <Image src={src} alt={detectedCardBrand} fill className="object-contain" />
          </motion.div>
        </AnimatePresence>
      );
    }
    const brands = Object.keys(cardBrandLogos);
    return (
      <AnimatePresence>
        {brands.map((b) => (
          <motion.div
            key={b}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.7, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="h-5 w-8 relative"
          >
            <Image src={cardBrandLogos[b]} alt={b} fill className="object-contain" />
          </motion.div>
        ))}
      </AnimatePresence>
    );
  };

  const renderPaymentDetails = () => {
    if (!transaction) return null;
    const method = transaction.method?.toUpperCase();
    switch (method) {
      case "QRIS":
        return (
          <div className="space-y-4">
            {transaction.qr_code_url ? (
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col items-center">
                <img src={transaction.qr_code_url} alt="QRIS Code" className="w-48 h-48 object-contain" />
                {transaction.qr_string && (
                  <code className="mt-3 text-xs break-all text-muted">{transaction.qr_string}</code>
                )}
              </div>
            ) : (
              <Alert variant="info">Open your preferred payment app and scan the QR code provided by Xendit.</Alert>
            )}
            <ol className="list-decimal list-inside text-sm text-muted space-y-1">
              <li>Open a QRIS-compatible payment application.</li>
              <li>Select the Scan option and point your camera at the QR code above.</li>
              <li>Confirm that the amount matches ({formatPrice(order?.amount ?? 0)}) and authorize the payment.</li>
            </ol>
          </div>
        );
      case "VIRTUAL_ACCOUNT":
      case "BANK_TRANSFER":
        return (
          <PaymentInstructions
            bankCode={transaction.bank_code}
            virtualAccountNumber={transaction.virtual_account_number}
            amount={transaction.amount}
          />
        );
      case "EWALLET":
        return (
          <div className="space-y-3">
            {transaction.checkout_url && (
              <Button variant="primary" onClick={() => window.open(transaction.checkout_url!, "_blank")} className="w-full">
                Continue to E-Wallet Checkout
              </Button>
            )}
            <Alert variant="info">You will be redirected to the {transaction.channel} app or website to complete the payment.</Alert>
          </div>
        );
      case "RETAIL_OUTLET":
        return (
          <div className="space-y-3">
            <Alert variant="info">Show the payment code at the cashier and pay the exact amount.</Alert>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-muted">Payment Code</p>
              <p className="text-lg font-semibold text-dark mt-1">{transaction.payment_code}</p>
            </div>
          </div>
        );
      case "PAYLATER":
        return (
          <div className="space-y-3">
            {transaction.checkout_url && (
              <Button variant="primary" onClick={() => window.open(transaction.checkout_url!, "_blank")} className="w-full">
                Continue to PayLater
              </Button>
            )}
            <Alert variant="info">You will be redirected to your PayLater provider to authorize the payment.</Alert>
          </div>
        );
      case "CARD":
        return (
          <div className="space-y-4">
            {cardError && <Alert variant="error">{cardError}</Alert>}
            {cardSuccess && <Alert variant="success">{cardSuccess}</Alert>}
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <FormInput
                label="Cardholder Name"
                placeholder="e.g. John Smith"
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(event) => {
                  setCardError(null);
                  setCardSuccess(null);
                  setCardholderName(event.target.value);
                }}
              />
              <div className="relative">
                <FormInput
                  label="Card Number"
                  placeholder="1234 5678 9012 3456"
                  autoComplete="cc-number"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(event) => handleCardNumberChange(event.target.value)}
                  maxLength={23}
                  className="pr-20"
                />
                <div className="absolute right-3 top-[calc(50%+4px)] -translate-y-1/2 flex items-center gap-1 h-6">
                  {renderCardLogos()}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput
                  label="Expiry"
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  value={cardExpiry}
                  onChange={(event) => handleCardExpiryChange(event.target.value)}
                  maxLength={7}
                />
                <FormInput
                  label="CVV"
                  placeholder="123"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  value={cardCvv}
                  onChange={(event) => handleCardCvvChange(event.target.value)}
                  maxLength={4}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={cardProcessing} className="sm:w-auto">
                  {cardProcessing ? "Processing Payment..." : "Pay Now"}
                </Button>
                {cardRedirectUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (window.location.href = cardRedirectUrl)}
                    className="sm:w-auto"
                  >
                    Complete Authentication
                  </Button>
                )}
              </div>
              <div className="space-y-2 text-xs text-muted">
                <p><strong>Pay Now</strong> submits your card details and attempts to charge your bank immediately.</p>
                <p>If additional authentication is required, you'll be redirected to your bank's secure 3D Secure page automatically.</p>
                <p>Your card data is encrypted and processed securely by our payment provider.</p>
              </div>
            </form>
          </div>
        );
      default:
        return <Alert variant="info">Follow the instructions provided by your payment application.</Alert>;
    }
  };

  const handleConfirm = async () => {
    setInfoMessage(null);
    const latestOrder = await fetchOrder(true);
    const resolvedOrder = latestOrder ?? order;
    if (isPaid(resolvedOrder)) {
      setInfoMessage("Payment confirmed. Redirecting you back to Devara Creative...");
      setTimeout(() => {
        const targetOrder = latestOrder ?? order;
        const redirectId = String(targetOrder?.id ?? orderId);
        window.location.href = `/orders/${redirectId}/confirmation?status=success`;
      }, 1200);
    } else {
      setInfoMessage("We have not detected the payment yet. If you have already paid, please wait a moment and try again.");
    }
  };

  if (loading && !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted">Loading payment instructions.</p>
      </div>
    );
  }

  if (closedReason) {
    return (
      <div className="max-w-xl mx-auto mt-16 space-y-6">
        <Alert variant="warning" title="Payment Unavailable">{closedReason}</Alert>
        <Button onClick={() => router.push("/checkout")} className="w-full">Back to Checkout</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16">
        <Alert variant="error" title="Something Went Wrong">{error}</Alert>
        <Button className="mt-6" onClick={() => void fetchOrder()}>Try Again</Button>
      </div>
    );
  }

  if (order && isOrderClosed(order, transaction)) {
    return (
      <div className="max-w-xl mx-auto mt-16 space-y-6">
        <Alert variant="warning" title="Payment Unavailable">
          This order is no longer available for payment because it has been cancelled or expired. If you
          believe this is a mistake, please create a new order or contact our team for assistance.
        </Alert>
        <Button onClick={() => router.push("/checkout")} className="w-full">Back to Checkout</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/checkout" className="inline-flex items-center gap-2 text-accent">
          <ArrowLeft className="w-4 h-4" />
          Back to Checkout
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Payment Instructions</h1>
      </div>
      <p className="text-sm text-muted">
        Order #{order?.id} • {paymentMethodLabel}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <section className="p-0 bg-transparent border-none rounded-none shadow-none">
          {renderPaymentDetails()}
        </section>
        <aside className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm h-fit space-y-4">
          <div>
            <p className="text-sm text-muted">Payment Status</p>
            <p className="text-lg font-semibold text-dark flex items-center gap-2">
              {formatStatus(order?.payment_status ?? order?.status)}
              {refreshing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Amount Due</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(order?.amount ?? 0)}</p>
          </div>
          {transaction?.reference && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-muted">Reference Number</p>
              <p className="text-sm font-semibold text-dark mt-1">{transaction.reference}</p>
            </div>
          )}
          {expiresAt && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <Clock className="w-4 h-4" />
              <span>{countdown ? `Deadline: ${countdown}` : "Waiting for payment"}</span>
            </div>
          )}
          {transaction?.checkout_url && transaction.method?.toUpperCase() !== "CARD" && (
            <Button variant="outline" onClick={() => window.open(transaction.checkout_url!, "_blank")} className="w-full">
              Open Payment Link
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={refreshing || isPaid(order)} className="w-full">
            {refreshing ? "Checking..." : "Confirm Payment"}
          </Button>
          {infoMessage && <p className="text-xs text-muted">{infoMessage}</p>}
        </aside>
      </div>
    </div>
  );
}
