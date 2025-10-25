"use client";

import React, { useEffect, useMemo, useState } from "react";
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

type Category = { id: number; name: string; slug: string };

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Category>>({ name: "", slug: "" });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
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

  const handleNameChange = (value: string) => {
    setForm((prev) => {
      const updated = { ...prev, name: value };
      if (!slugManuallyEdited) {
        updated.slug = slugify(value);
      }
      return updated;
    });
  };

  const handleSlugChange = (value: string) => {
    if (!value) {
      setSlugManuallyEdited(false);
      setForm((prev) => ({ ...prev, slug: "" }));
      return;
    }
    setSlugManuallyEdited(true);
    setForm((prev) => ({ ...prev, slug: value }));
  };

  async function fetchList() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Fetch categories failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchList();
  }, [token]);

  function startAdd() {
    setEditing(null);
    setForm({ name: "", slug: "" });
    setSlugManuallyEdited(false);
    setShowForm(true);
  }

  function startEdit(category: Category) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug });
    setSlugManuallyEdited(true);
    setShowForm(true);
  }

  const resetForm = () => {
    setEditing(null);
    setShowForm(false);
    setForm({ name: "", slug: "" });
    setSlugManuallyEdited(false);
  };

  async function submit() {
    if (!token) return;
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories/${editing.id}`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name || ""),
        }),
      });

      if (!res.ok) {
        let message = "Failed to save category.";
        try {
          const err = await res.json();
          if (err?.detail) message = err.detail;
        } catch {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      resetForm();
      setFeedback({
        type: "success",
        message: editing
          ? "Category updated successfully."
          : "New category added successfully.",
      });
      await fetchList();
    } catch (error) {
      console.error("Failed to save category:", error);
      setFeedback({
        type: "error",
        message: editing
          ? "Failed to update category. Please try again."
          : "Failed to add category. Please try again.",
      });
    }
  }

  const requestDelete = (category: Category) => {
    setPendingDelete(category);
  };

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        let message = "Failed to delete category.";
        try {
          const err = await res.json();
          if (err?.detail) message = err.detail;
        } catch {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      setFeedback({
        type: "success",
        message: `Category "${pendingDelete.name}" was deleted successfully.`,
      });
      setPendingDelete(null);
      await fetchList();
    } catch (error) {
      console.error("Failed to delete category:", error);
      setFeedback({
        type: "error",
        message: "Failed to delete category. Please try again.",
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((c) => {
      const values = [c.id?.toString() ?? "", c.name ?? "", c.slug ?? ""];
      return values.some((value) => value.toLowerCase().includes(term));
    });
  }, [categories, searchTerm]);

  const pagination = usePagination(filteredCategories, PAGE_SIZE);
  const paginatedCategories = pagination.paginatedItems;

  const tableData = paginatedCategories.map((c) => [
    c.id,
    c.name,
    c.slug,
    <div key={c.id} className="flex gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => startEdit(c)}
        title={`Edit ${c.name}`}
        aria-label={`Edit ${c.name}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="danger"
        className="h-8 w-8"
        onClick={() => requestDelete(c)}
        title={`Delete ${c.name}`}
        aria-label={`Delete ${c.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>,
  ]);

  return (
    <>
      <div className="space-y-8">
        <AdminPageHeader
          title="Manage Categories"
          description="Organize service categories to simplify grouping your offerings."
          actions={
            <AdminSearchActions
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search category..."
              onAdd={startAdd}
              addButtonLabel=""
              addButtonAriaLabel="Add category"
            />
          }
        />

        {feedback && (
          <Alert
            variant={feedback.type}
            title={feedback.type === "success" ? "Success" : "An error occurred"}
          >
            {feedback.message}
          </Alert>
        )}

        <Dialog open={showForm} onOpenChange={resetForm}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editing ? "Edit Category" : "Add New Category"}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <FormInput
                        label="Name"
                        placeholder="Name"
                        value={form.name || ""}
                        onChange={(e) => handleNameChange(e.target.value)}
                    />
                    <FormInput
                        label="Slug"
                        placeholder="Slug"
                        value={form.slug || ""}
                        onChange={(e) => handleSlugChange(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={resetForm}
                    >
                        Cancel
                    </Button>
                    <Button onClick={submit}>{editing ? "Update" : "Create"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {loading ? (
          <p>Loading...</p>
        ) : filteredCategories.length === 0 ? (
          <div className="p-6 rounded-xl border border-accent/15 bg-white text-center text-muted shadow-sm">
            {searchTerm
              ? "No categories match your search."
              : "No categories available yet."}
          </div>
        ) : (
          <>
            <Table
              headers={["ID", "Name", "Slug", "Actions"]}
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
        open={!!pendingDelete}
        title="Delete Category"
        description={
          pendingDelete
            ? `Are you sure you want to delete the category "${pendingDelete.name}"?`
            : "Are you sure you want to delete this category?"
        }
        confirmText="Yes, delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleteLoading) setPendingDelete(null);
        }}
      />
    </>
  );
}