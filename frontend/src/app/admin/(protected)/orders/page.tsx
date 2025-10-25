"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Table from "@/components/Table";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/AdminPageHeader";
import AdminSearchActions from "@/components/AdminSearchActions";
import { useAuthStore } from "@/store/auth";
import AdminOrderDetailModal from "@/components/AdminOrderDetailModal";
import { formatUsdToRupiah, formatOrderStatus } from "@/lib/helpers";
import { Check, CheckCircle, Eye, Mail, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { useAdminNotificationStore } from "@/store/adminNotifications";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

type Order = {
  id: number;
  service: string;
  customer_name: string;
  customer_email: string;
  status: string;
  amount: number;
  [key: string]: any;
};

export default function OrdersPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "admin";
  const PAGE_SIZE = 10;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: number;
    status: string;
    title: string;
    description: string;
    confirmText: string;
    confirmVariant: "primary" | "outline" | "success" | "danger";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const flagNewOrders = useAdminNotificationStore((s) => s.flagNewOrders);
  const clearNewOrders = useAdminNotificationStore((s) => s.clearNewOrders);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadOrders() {
    setLoading(true);
    const storedToken = localStorage.getItem("adm_token");
    if (!storedToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = Array.isArray(data) ? data : [];
        setOrders(normalized);
        const ids = normalized.map((item: Order) => item.id);
        if (isAdmin) {
          flagNewOrders(ids);
        }
      }
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      clearNewOrders();
    }
    loadOrders();
  }, [isAdmin]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const values = [
        order.id?.toString() ?? "",
        order.service ?? "",
        order.customer_name ?? "",
        order.customer_email ?? "",
        order.status ?? "",
      ];
      return values.some((value) =>
        value.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

  const pagination = usePagination(filteredOrders, PAGE_SIZE);
  const paginatedOrders = pagination.paginatedItems;

  const openStatusConfirmation = (id: number, status: string) => {
    if (!isAdmin) {
      return;
    }
    const statusLabel = formatOrderStatus(status);
    const dangerousStatuses = [
      "cancelled_by_admin",
      "payment_invalid",
      "refund_rejected",
    ];
    const positiveStatuses = ["confirmed", "done", "refunded"];

    let confirmText = `Confirm`;
    if (status === "cancelled_by_admin") confirmText = "Yes, cancel order";
    else if (status === "payment_invalid")
      confirmText = "Mark as invalid payment";
    else if (status === "refund_rejected") confirmText = "Reject refund";
    else if (status === "refund_pending") confirmText = "Mark as pending";
    else if (status === "awaiting_confirmation")
      confirmText = "Await confirmation";
    else if (status === "refunded") confirmText = "Approve refund";
    else if (status === "done") confirmText = "Mark as completed";
    else if (status === "confirmed") confirmText = "Confirm order";

    const confirmVariant = dangerousStatuses.includes(status)
      ? "danger"
      : positiveStatuses.includes(status)
      ? "success"
      : "primary";

    setPendingAction({
      id,
      status,
      title: "Update Order Status",
      description: `Are you sure you want to update this order to "${statusLabel}"?`,
      confirmText,
      confirmVariant,
    });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || !isAdmin) return;
    const storedToken = localStorage.getItem("adm_token");
    if (!storedToken) return;
    setActionLoading(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/orders/${pendingAction.id}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${storedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: pendingAction.status }),
        }
      );
      setPendingAction(null);
      await loadOrders();
    } catch (error) {
      console.error(
        `Failed to update status to ${pendingAction.status}:`,
        error
      );
      alert("An error occurred. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    const statusStyles: { [key: string]: string } = {
        pending: "bg-light text-muted",
        awaiting_confirmation: "bg-accent/10 text-accent",
        confirmed: "bg-success/15 text-success",
        done: "bg-primary/15 text-primary",
        payment_invalid: "bg-danger/15 text-danger",
        cancelled_by_user: "bg-danger/15 text-danger",
        cancelled_by_admin: "bg-danger/15 text-danger",
        refund_pending: "bg-warning/20 text-warning",
        refund_rejected: "bg-danger/20 text-danger",
        refunded: "bg-primary/15 text-primary",
    };
    return (
        <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${statusStyles[status] || 'bg-light text-muted'}`}>
            {formatOrderStatus(status)}
        </span>
    );
  };

  const getActionButtons = (order: Order) => {
    const viewButton = (
      <Button
        key="view"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => setSelectedOrder(order)}
        title="View order details"
        aria-label="View order details"
      >
        <Eye className="h-4 w-4" />
      </Button>
    );

    if (!isAdmin) {
      return viewButton;
    }

    const cancelButton = (
      <Button
        key="cancel"
        size="icon"
        variant="danger"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "cancelled_by_admin")}
        title="Cancel order"
        aria-label="Cancel order"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );

    const rejectButton = (
      <Button
        key="reject"
        size="icon"
        variant="danger"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "payment_invalid")}
        title="Mark payment as invalid"
        aria-label="Mark payment as invalid"
      >
        <X className="h-4 w-4" />
      </Button>
    );

    const confirmButton = (
      <Button
        key="confirm"
        size="icon"
        variant="success"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "confirmed")}
        title="Confirm order"
        aria-label="Confirm order"
      >
        <Check className="h-4 w-4" />
      </Button>
    );

    const markDoneButton = (
      <Button
        key="done"
        size="icon"
        variant="success"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "done")}
        title="Mark as completed"
        aria-label="Mark as completed"
      >
        <CheckCircle className="h-4 w-4" />
      </Button>
    );

    const approveRefundButton = (
      <Button
        key="approve"
        size="icon"
        variant="success"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "refunded")}
        title="Setujui refund"
        aria-label="Setujui refund"
      >
        <CheckCircle className="h-4 w-4" />
      </Button>
    );

    const rejectRefundButton = (
      <Button
        key="reject-refund"
        size="icon"
        variant="danger"
        className="h-8 w-8"
        onClick={() => openStatusConfirmation(order.id, "refund_rejected")}
        title="Tolak refund"
        aria-label="Tolak refund"
      >
        <XCircle className="h-4 w-4" />
      </Button>
    );

    const emailButton = (
      <Button
        key="email"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => {
          window.location.href = `mailto:${order.customer_email}`;
        }}
        title="Email pelanggan"
        aria-label="Email pelanggan"
        type="button"
      >
        <Mail className="h-4 w-4" />
      </Button>
    );

    let buttons: ReactNode[] = [];

    switch (order.status) {
      case "pending":
        buttons = [cancelButton, viewButton, emailButton];
        break;
      case "awaiting_confirmation":
        buttons = [rejectButton, confirmButton];
        break;
      case "confirmed":
        buttons = [markDoneButton, viewButton];
        break;
      case "refund_pending":
        buttons = [rejectRefundButton, approveRefundButton];
        break;
      default:
        buttons = [viewButton];
        break;
    }

    return (
      <div className="flex gap-2" key={`actions-${order.id}`}>
        {buttons}
      </div>
    );
  };

  const tableData = paginatedOrders.map((o: Order) => [
    o.id,
    o.service,
    o.customer_name,
    o.customer_email,
    getStatusChip(o.status),
    formatUsdToRupiah(o.amount),
    getActionButtons(o),
  ]);

  const heading = isAdmin ? "Manage Orders" : "Orders Overview";
  const description = isAdmin
    ? "Manage customer orders, payments, and follow-up actions."
    : "Review incoming orders to plan your next steps.";

  return (
    <>
      <div className="space-y-8">
        <AdminPageHeader
          title={heading}
          description={description}
          actions={
            <AdminSearchActions
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search orders..."
              inputClassName="sm:w-64"
              actions={
                <Button
                  variant="outline"
                  onClick={loadOrders}
                  disabled={loading}
                  size="icon"
                  className="h-10 w-10"
                  title="Refresh orders"
                  aria-label="Refresh orders"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin text-primary" : ""}
                    aria-hidden="true"
                  />
                </Button>
              }
            />
          }
        />

        {loading ? (
          <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
            {searchTerm ? "No orders match your search." : "No orders found."}
          </div>
        ) : (
          <>
            <Table
              headers={[
                "ID",
                "Service",
                "Name",
                "Email",
                "Status",
                "Amount",
                "Action",
              ]}
              data={tableData}
            />
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.goToPage}
            />
          </>
        )}
      </div>
      <AdminOrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
      {isAdmin && (
        <ConfirmDialog
          open={!!pendingAction}
          title={pendingAction?.title ?? ""}
          description={pendingAction?.description}
          confirmText={pendingAction?.confirmText}
          confirmVariant={pendingAction?.confirmVariant}
          loading={actionLoading}
          onConfirm={handleConfirmAction}
          onClose={() => {
            if (!actionLoading) {
              setPendingAction(null);
            }
          }}
        />
      )}
    </>
  );
}



