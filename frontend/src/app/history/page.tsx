"use client";

import { useEffect, useState, useCallback } from "react";
import { getOrders, getOrderById } from "@/lib/api";
import { Loader, ServerCrash, Inbox, Star } from "lucide-react";
import OrderDetailModal from "@/components/OrderDetailModal";
import DatePicker from "@/components/DatePicker";
import { cn } from "@/lib/utils";
import { formatOrderStatus } from "@/lib/helpers";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Button from "@/components/Button";

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
  latest_transaction?: {
    id: number;
    method: string;
    status: string;
    channel?: string;
    virtual_account_number?: string;
    qr_code_url?: string;
    qr_string?: string;
    expires_at?: string;
  };
};

type StatusFilter = {
  key: string;
  label: string;
  statuses?: string[];
  predicate?: (order: Order) => boolean;
};

const statusFilters: StatusFilter[] = [
  { key: "All", label: "All" },
  { key: "pending", label: "Pending", statuses: ["pending"] },
  { key: "awaiting", label: "Awaiting", statuses: ["awaiting_confirmation"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "paid"] },
  { key: "done", label: "Done", statuses: ["done"] },
  {
    key: "cancelled",
    label: "Cancelled",
    statuses: ["cancelled", "cancelled_by_user", "cancelled_by_admin", "payment_invalid"],
  },
  {
    key: "refund",
    label: "Refund",
    predicate: (order) => order.status.startsWith("refund") || Boolean(order.refund_status),
  },
];

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders();
      const normalizedOrders = Array.isArray(data)
        ? data
            .map((order: Order) => ({
              ...order,
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];
      setOrders(normalizedOrders);
    } catch (err) {
      setError("Failed to fetch order history.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleActionSuccess = () => {
    fetchOrders();
    setSelectedOrder(null);
  };

  const handleRatingUpdate = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order))
    );
    setSelectedOrder(updatedOrder);
  };

  const handleViewDetails = useCallback(async (order: Order) => {
    let finalOrderData = order;
    setError(null);
    try {
      const detail = await getOrderById(order.id.toString());
      if (detail && typeof detail === 'object' && detail.id) {
        finalOrderData = detail;
      } else {
         console.warn("Received invalid detail object for order:", order.id, detail);
         setError("Could not load full order details at the moment. Displaying summary.");
      }
    } catch (err: any) {
      console.error("Failed to load order detail for order ID:", order.id, (err instanceof Error ? err.message : String(err)), err);
      if (err.response && err.response.status === 403) {
        setError("You do not have permission to view the details of this order. Displaying summary.");
      } else {
        setError("Failed to load full order details. Displaying summary.");
      }
    } finally {
       setSelectedOrder(finalOrderData);
    }
  }, [setError]);

  const activeFilter = statusFilters.find((filter) => filter.key === activeStatus);

  const getEffectiveStatus = (order: Order) => {
    const normalizedStatus = order.status?.toLowerCase() ?? "";
    const paymentStatus = order.payment_status || order.latest_transaction?.status;
    const normalizedPaymentStatus = paymentStatus?.toLowerCase() ?? "";
    const expiresAt = order.latest_transaction?.expires_at ?? order.payment_expires_at;

    if (!expiresAt) {
      return normalizedStatus;
    }

    if (["paid", "completed", "success"].includes(normalizedPaymentStatus)) {
      return normalizedStatus;
    }

    if (
      [
        "done",
        "cancelled",
        "cancelled_by_user",
        "cancelled_by_admin",
        "payment_invalid",
        "refunded",
        "refund_pending",
        "refund_rejected",
      ].includes(normalizedStatus)
    ) {
      return normalizedStatus;
    }

    const expiresAtTime = new Date(expiresAt).getTime();
    if (!Number.isNaN(expiresAtTime) && expiresAtTime <= Date.now()) {
      if (["pending", "awaiting_confirmation"].includes(normalizedStatus)) {
        return "cancelled_by_admin";
      }
    }

    return normalizedStatus;
  };

  const filteredOrders = !activeFilter || activeFilter.key === "All"
    ? orders
    : orders.filter((order) => {
        const normalizedStatus = getEffectiveStatus(order);
        if (activeFilter.predicate) {
          return activeFilter.predicate({ ...order, status: normalizedStatus });
        }
        if (activeFilter.statuses) {
          return activeFilter.statuses.some((status) => status.toLowerCase() === normalizedStatus);
        }
        return normalizedStatus === activeFilter.key.toLowerCase();
      });

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount * 15000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const statusInfo: { [key: string]: { text: string, color: string } } = {
    pending: { text: "Pending", color: "text-warning" },
    awaiting_confirmation: { text: "Awaiting Confirmation", color: "text-accent" },
    confirmed: { text: "Confirmed", color: "text-success" },
    paid: { text: "Paid", color: "text-success" },
    done: { text: "Done", color: "text-primary" },
    cancelled: { text: "Cancelled", color: "text-danger" },
    cancelled_by_user: { text: "Cancelled", color: "text-danger" },
    cancelled_by_admin: { text: "Cancelled by System", color: "text-danger" },
    payment_invalid: { text: "Payment Invalid", color: "text-danger" },
    refund_pending: { text: "Refund Pending", color: "text-warning" },
    refund_rejected: { text: "Refund Rejected", color: "text-danger" },
    refunded: { text: "Refunded", color: "text-primary" },
  };

  const getOrderQuantity = (order: Order) => {
    if (typeof order.quantity === "number" && order.quantity > 0) {
      return order.quantity;
    }
    const match = order.notes?.match(/qty\s*:?-?\s*(\d+)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      if (!Number.isNaN(value) && value > 0) {
        return value;
      }
    }
    return 1;
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-white rounded-2xl border border-accent/15 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-accent/10 gap-2">
        <div className="text-sm">
          <span className="font-bold text-dark">Order: #{order.id}</span>
          <span className="text-muted block sm:inline"> | Order Payment: {formatDate(order.created_at)}</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(order)} className="w-full sm:w-auto">View Details</Button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-start">
            <img
              src={`https://placehold.co/100x100/f0f0f0/333?text=${order.service.charAt(0)}`}
              alt={order.service}
              width={64}
              height={64}
              className="rounded-xl border bg-light object-cover flex-shrink-0 sm:w-[84px] sm:h-[84px]"
            />
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-base sm:text-lg text-dark line-clamp-2">{order.service}</h3>
              <p className="text-xs sm:text-sm text-muted">Qty: {getOrderQuantity(order)}</p>
              <p className="text-sm sm:text-base font-bold text-dark">{formatPrice(order.amount)}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:justify-end border-t border-accent/10 pt-4 mt-2 sm:border-t-0 sm:pt-0 sm:mt-0">
             <div className="space-y-1 text-sm sm:min-w-[140px]">
              <p className="text-muted text-xs sm:text-sm">Status</p>
              {(() => {
                const normalizedStatus = getEffectiveStatus(order);
                const info = statusInfo[normalizedStatus];
                return (
                  <p className={`font-semibold capitalize ${info?.color || 'text-dark'} text-sm sm:text-base`}>
                    {info?.text || formatOrderStatus(normalizedStatus)}
                  </p>
                );
              })()}
              {order.rating_value && order.rating_value > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted pt-1">
                  {Array.from({ length: 5 }, (_, index) => {
                    const filled = index < (order.rating_value ?? 0);
                    return (
                      <Star
                        key={index}
                        size={14}
                        className={filled ? "text-primary fill-primary" : "text-muted/30"}
                        fill="currentColor"
                      />
                    );
                  })}
                  <span>{order.rating_value}/5</span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-sm sm:min-w-[140px]">
              <p className="text-muted text-xs sm:text-sm">Order Date</p>
              <p className="font-semibold text-dark text-sm sm:text-base">{formatDate(order.created_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <main className="bg-white text-dark min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12">
          <div className="flex flex-col gap-4 pb-8 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-dark">Order History</h1>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-sm text-muted">
              <DatePicker />
              <span className="hidden sm:inline">To</span>
              <DatePicker />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="mb-8 border-b border-accent/15 overflow-hidden">
            <div className="flex items-center space-x-6 sm:space-x-8 overflow-x-auto whitespace-nowrap pb-px scrollbar-hide">
                {statusFilters.map((status) => (
                    <button
                        key={status.key}
                        onClick={() => setActiveStatus(status.key)}
                        className={cn(
                        "relative py-3 text-sm font-semibold transition-colors focus:outline-none shrink-0",
                        activeStatus === status.key ? "text-primary" : "text-muted hover:text-dark"
                        )}
                    >
                        {status.label}
                        {activeStatus === status.key && (
                            <motion.div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" layoutId="underline" />
                        )}
                    </button>
                ))}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-20"><Loader className="animate-spin text-primary" size={48} /></div>
          ) : error && !selectedOrder ? (
            <div className="flex flex-col items-center justify-center py-20 text-danger bg-white rounded-2xl border border-red-200"><ServerCrash size={48} /><p className="mt-4 font-semibold">{error}</p></div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white rounded-2xl border border-accent/15">
                    <Inbox size={48} className="mx-auto text-muted/50"/>
                    <h2 className="text-xl font-bold mt-6 text-dark">No Orders Found</h2>
                    <p className="text-muted mt-2">There are no orders with the selected status.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      {error && selectedOrder && (
         <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               className="bg-red-100 border border-red-300 text-red-800 text-sm rounded-lg p-4 shadow-lg flex items-start gap-3"
             >
                <ServerCrash className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto -mr-1 -mt-1 p-1 rounded-full hover:bg-red-200">✕</button>
             </motion.div>
         </div>
       )}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => { setSelectedOrder(null); setError(null); }}
        onActionSuccess={handleActionSuccess}
        onRatingUpdate={handleRatingUpdate}
      />
    </>
  );
}