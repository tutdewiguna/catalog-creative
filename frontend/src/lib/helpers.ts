export function clsx(...a: (string | false | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

export const USD_TO_IDR_RATE = 15000;

export function convertUsdToIdr(amountUsd: number) {
  return amountUsd * USD_TO_IDR_RATE;
}

export function formatRupiah(amountIdr: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amountIdr);
}

export function formatUsdToRupiah(amountUsd: number) {
  return formatRupiah(convertUsdToIdr(amountUsd));
}

const orderStatusLabelMap: Record<string, string> = {
  awaiting_confirmation: "Awaiting Confirmation",
  payment_invalid: "Payment Invalid",
  cancelled_by_user: "Cancelled",
  cancelled_by_admin: "Cancelled by System",
  done: "Done",
  refund_pending: "Refund Pending",
  refund_rejected: "Refund Rejected",
  refunded: "Refunded",
};

export function formatOrderStatus(status: string | null | undefined) {
  if (!status) return "";
  const normalized = status.toLowerCase();
  const mapped = orderStatusLabelMap[normalized];
  if (mapped) return mapped;
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

