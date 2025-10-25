"use client";

import { useEffect, useMemo, useState } from "react";
import Table from "@/components/Table";
import Button from "@/components/Button";
import Alert from "@/components/Alert";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminSearchActions from "@/components/AdminSearchActions";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Edit, Trash2 } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/Dialog";
import FormInput from "@/components/FormInput";

type PromoCode = {
  id: number;
  code: string;
  discount_percent: number;
  max_usage: number;
  used_count: number;
  valid_from?: string;
  valid_until?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [form, setForm] = useState({
    code: "",
    discountPercent: "",
    maxUsage: "",
    validFrom: "",
    validUntil: "",
    active: true,
  });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromoCode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("adm_token"));
    }
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const fetchList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/promocodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPromos(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch promo codes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchList();
    }
  }, [token]);

  const startAdd = () => {
    setEditing(null);
    setAutoGenerate(true);
    setForm({ code: "", discountPercent: "", maxUsage: "", validFrom: "", validUntil: "", active: true });
    setShowForm(true);
  };

  const startEdit = (promo: PromoCode) => {
    setEditing(promo);
    setAutoGenerate(false);
    setForm({
      code: promo.code,
      discountPercent: promo.discount_percent.toString(),
      maxUsage: promo.max_usage ? promo.max_usage.toString() : "",
      validFrom: toInputValue(promo.valid_from),
      validUntil: toInputValue(promo.valid_until),
      active: promo.active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setAutoGenerate(true);
    setForm({ code: "", discountPercent: "", maxUsage: "", validFrom: "", validUntil: "", active: true });
  };

  const submit = async () => {
    if (!token) return;
    const discountPercent = Number(form.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      setFeedback({ type: "error", message: "Discount must be greater than 0%." });
      return;
    }
    const maxUsage = form.maxUsage ? Number(form.maxUsage) : 0;
    if (Number.isNaN(maxUsage) || maxUsage < 0) {
      setFeedback({ type: "error", message: "Usage limit is invalid." });
      return;
    }
    const validFromISO = form.validFrom ? new Date(form.validFrom).toISOString() : "";
    const validUntilISO = form.validUntil ? new Date(form.validUntil).toISOString() : "";
    if (validFromISO && validUntilISO && new Date(validUntilISO) < new Date(validFromISO)) {
      setFeedback({ type: "error", message: "End date must be after the start date." });
      return;
    }

    const payload: Record<string, unknown> = {
      discount_percent: discountPercent,
      max_usage: maxUsage,
      valid_from: validFromISO,
      valid_until: validUntilISO,
      active: form.active,
    };

    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/promocodes`;
    let method: "POST" | "PUT" = "POST";

    if (editing) {
      method = "PUT";
      url = `${url}/${editing.id}`;
      const trimmedCode = form.code.trim();
      if (!trimmedCode) {
        setFeedback({ type: "error", message: "Promo code is required." });
        return;
      }
      payload.code = trimmedCode;
    } else if (autoGenerate) {
      payload.auto_generate = true;
    } else {
      const trimmedCode = form.code.trim();
      if (!trimmedCode) {
        setFeedback({ type: "error", message: "Promo code is required." });
        return;
      }
      payload.code = trimmedCode;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = editing ? "Failed to update promo." : "Failed to create promo.";
        try {
          const err = await res.json();
          if (err?.detail) message = err.detail;
        } catch (error) {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      setFeedback({
        type: "success",
        message: editing ? "Promo updated successfully." : "New promo created successfully.",
      });
      resetForm();
      await fetchList();
    } catch (error) {
      console.error("Failed to save promo:", error);
      setFeedback({
        type: "error",
        message: editing ? "Failed to update promo." : "Failed to create promo.",
      });
    }
  };

  const requestDelete = (promo: PromoCode) => {
    setPendingDelete(promo);
  };

  const confirmDelete = async () => {
    if (!token || !pendingDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/promocodes/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        let message = "Failed to delete promo.";
        try {
          const err = await res.json();
          if (err?.detail) message = err.detail;
        } catch (error) {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      setFeedback({ type: "success", message: `Promo ${pendingDelete.code} was deleted successfully.` });
      setPendingDelete(null);
      await fetchList();
    } catch (error) {
      console.error("Failed to delete promo:", error);
      setFeedback({ type: "error", message: "Failed to delete promo." });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredPromos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return promos;
    return promos.filter((promo) => {
      return (
        promo.code.toLowerCase().includes(term) ||
        promo.discount_percent.toString().includes(term) ||
        (promo.max_usage ? promo.max_usage.toString() : "unlimited").includes(term)
      );
    });
  }, [promos, searchTerm]);

  const pagination = usePagination(filteredPromos, PAGE_SIZE);
  const paginatedPromos = pagination.paginatedItems;

  const tableData = paginatedPromos.map((promo) => [
    <span key={`code-${promo.id}`} className="font-semibold text-dark">
      {promo.code}
    </span>,
    `${promo.discount_percent}%`,
    promo.max_usage > 0 ? `${promo.used_count}/${promo.max_usage}` : `${promo.used_count} / ∞`,
    formatDateTime(promo.valid_from),
    formatDateTime(promo.valid_until),
    <span key={`status-${promo.id}`} className={promo.active ? "text-success" : "text-danger"}>
      {promo.active ? "Active" : "Inactive"}
    </span>,
    <div key={`actions-${promo.id}`} className="flex gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => startEdit(promo)}
        title={`Edit ${promo.code}`}
        aria-label={`Edit ${promo.code}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="danger"
        className="h-8 w-8"
        onClick={() => requestDelete(promo)}
        title={`Delete ${promo.code}`}
        aria-label={`Delete ${promo.code}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>,
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Promo Codes"
        description="Manage promo codes and discount configurations for clients."
        actions={
          <AdminSearchActions
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search promo code"
            onAdd={startAdd}
            addButtonLabel=""
            addButtonAriaLabel="Add promo code"
            addDisabled={loading}
          />
        }
      />

      {feedback && (
        <Alert variant={feedback.type} className="max-w-xl">
          {feedback.message}
        </Alert>
      )}

      <Dialog open={showForm} onOpenChange={resetForm}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>
                    {editing ? `Edit Promo ${editing.code}` : "Add New Promo"}
                </DialogTitle>
            </DialogHeader>
            <div className="py-4 grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Promo Code</label>
                    <input
                        type="text"
                        value={form.code}
                        onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                        className="form-input"
                        placeholder="DVRXXXXXX"
                        disabled={editing ? false : autoGenerate}
                    />
                    {!editing && (
                        <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                            type="checkbox"
                            checked={autoGenerate}
                            onChange={(event) => setAutoGenerate(event.target.checked)}
                        />
                        Generate code automatically
                        </label>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Discount (%)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.discountPercent}
                        onChange={(event) => setForm((prev) => ({ ...prev, discountPercent: event.target.value }))}
                        className="form-input"
                        placeholder="Example: 10"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Usage Limit</label>
                    <input
                        type="number"
                        min="0"
                        value={form.maxUsage}
                        onChange={(event) => setForm((prev) => ({ ...prev, maxUsage: event.target.value }))}
                        className="form-input"
                        placeholder="0 for unlimited"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Status</label>
                    <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                        />
                        Active
                    </label>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Valid From</label>
                    <input
                        type="datetime-local"
                        value={form.validFrom}
                        onChange={(event) => setForm((prev) => ({ ...prev, validFrom: event.target.value }))}
                        className="form-input"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-dark">Valid Until</label>
                    <input
                        type="datetime-local"
                        value={form.validUntil}
                        onChange={(event) => setForm((prev) => ({ ...prev, validUntil: event.target.value }))}
                        className="form-input"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                    Cancel
                </Button>
                <Button onClick={submit}>
                    {editing ? "Save Changes" : "Save Promo"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-dark">Promo List</h2>
          {loading && <span className="text-sm text-muted">Loading data...</span>}
        </div>

        {loading ? (
          <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
            Loading promos...
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
            {searchTerm
              ? "No promos match your search."
              : "No promo data available yet."}
          </div>
        ) : (
          <>
            <Table
              headers={["Code", "Discount", "Usage", "Start", "End", "Status", "Actions"]}
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete Promo ${pendingDelete.code}` : "Delete Promo"}
        description="This action will permanently remove the promo."
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}