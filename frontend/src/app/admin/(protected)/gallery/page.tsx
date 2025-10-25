"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Table from "@/components/Table";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";
import Alert from "@/components/Alert";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminSearchActions from "@/components/AdminSearchActions";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuthStore } from "@/store/auth";
import {
  getAdminGallery,
  createAdminGalleryItem,
  updateAdminGalleryItem,
  deleteAdminGalleryItem,
} from "@/lib/api";
import { GalleryAsset, GalleryItem } from "@/lib/types";
import { Edit, ExternalLink, Trash2 } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/Dialog";

type GalleryFormState = {
  section: GalleryItem["section"];
  title: string;
  subtitle: string;
  displayMode: "gallery" | "pdf" | "";
  videoUrl: string;
  linkUrl: string;
  description: string;
  thumbnailPreview: string;
};

const SECTION_OPTIONS: { value: GalleryItem["section"]; label: string }[] = [
  { value: "photography", label: "Photography" },
  { value: "videography", label: "Videography" },
  { value: "design", label: "Design" },
  { value: "web", label: "Web Development" },
];

const DISPLAY_MODES = [
  { value: "gallery", label: "Image Gallery" },
  { value: "pdf", label: "PDF Presentation" },
];

const defaultForm: GalleryFormState = {
  section: "photography",
  title: "",
  subtitle: "",
  displayMode: "gallery",
  videoUrl: "",
  linkUrl: "",
  description: "",
  thumbnailPreview: "",
};

export default function AdminGalleryPage() {
  const { token } = useAuthStore();
  const PAGE_SIZE = 10;
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [form, setForm] = useState<GalleryFormState>(defaultForm);
  const [filters, setFilters] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState("");
  const [currentAssets, setCurrentAssets] = useState<GalleryAsset[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const thumbnailRef = useRef<HTMLInputElement>(null);
  const imageAssetsRef = useRef<HTMLInputElement>(null);
  const pdfAssetsRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm(defaultForm);
    setFilters([]);
    setCurrentAssets([]);
    setFilterInput("");
    setEditing(null);
    thumbnailRef.current && (thumbnailRef.current.value = "");
    imageAssetsRef.current && (imageAssetsRef.current.value = "");
    pdfAssetsRef.current && (pdfAssetsRef.current.value = "");
  };

  const fetchGallery = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getAdminGallery();
      let incoming: GalleryItem[] = [];
      if (Array.isArray(response)) {
        incoming = response;
      } else if (response && typeof response === "object" && Array.isArray((response as any).items)) {
        incoming = (response as any).items;
      }
      setItems(incoming);
    } catch (error) {
      console.error("Failed to fetch gallery:", error);
      setFeedback({ type: "error", message: "Failed to load gallery entries." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [token]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(term) ||
        item.subtitle.toLowerCase().includes(term) ||
        (item.filters ?? []).some((filter) => filter.toLowerCase().includes(term))
      );
    });
  }, [items, searchTerm]);

  const pagination = usePagination(filteredItems, PAGE_SIZE);
  const paginatedItems = pagination.paginatedItems;

  const handleAddFilter = () => {
    const trimmed = filterInput.trim();
    if (!trimmed) return;
    if (!filters.some((filter) => filter.toLowerCase() === trimmed.toLowerCase())) {
      setFilters((prev) => [...prev, trimmed]);
    }
    setFilterInput("");
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAsset = (index: number) => {
    setCurrentAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (item: GalleryItem) => {
    setShowForm(true);
    setEditing(item);
    setForm({
      section: item.section,
      title: item.title,
      subtitle: item.subtitle,
      displayMode: (item.display_mode as "gallery" | "pdf") || (item.section === "design" ? "gallery" : ""),
      videoUrl: item.video_url || "",
      linkUrl: item.link_url || "",
      description: item.description || "",
      thumbnailPreview: item.thumbnail || "",
    });
    setFilters(item.filters ?? []);
    setCurrentAssets(item.assets ?? []);
    setFilterInput("");
    thumbnailRef.current && (thumbnailRef.current.value = "");
    imageAssetsRef.current && (imageAssetsRef.current.value = "");
    pdfAssetsRef.current && (pdfAssetsRef.current.value = "");
  };

  const handleDelete = (item: GalleryItem) => {
    setPendingDelete(item);
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      setFeedback({ type: "error", message: "Title is required." });
      return;
    }
    if (!form.subtitle.trim()) {
      setFeedback({ type: "error", message: "Subtitle is required." });
      return;
    }
    if (!editing && !thumbnailRef.current?.files?.length) {
      setFeedback({ type: "error", message: "Please provide a thumbnail image." });
      return;
    }

    const formData = new FormData();
    formData.append("section", form.section);
    formData.append("title", form.title);
    formData.append("subtitle", form.subtitle);
    formData.append("display_mode", form.displayMode || "");
    formData.append("video_url", form.videoUrl || "");
    formData.append("link_url", form.linkUrl || "");
    formData.append("description", form.description || "");
    formData.append("existing_thumbnail", form.thumbnailPreview || "");
    filters.forEach((filter) => formData.append("filters", filter));
    formData.append(
      "existing_assets",
      JSON.stringify(
        currentAssets.map((asset) => ({
          url: asset.url,
          caption: asset.caption ?? "",
          type: asset.type ?? "image",
        }))
      )
    );

    if (thumbnailRef.current?.files?.length) {
      formData.append("thumbnail", thumbnailRef.current.files[0]);
    }
    if (imageAssetsRef.current?.files?.length) {
      Array.from(imageAssetsRef.current.files).forEach((file) =>
        formData.append("asset_images", file)
      );
    }
    if (pdfAssetsRef.current?.files?.length) {
      Array.from(pdfAssetsRef.current.files).forEach((file) =>
        formData.append("asset_pdfs", file)
      );
    }

    try {
      if (editing) {
        await updateAdminGalleryItem(editing.id, formData);
        setFeedback({ type: "success", message: "Gallery item updated." });
      } else {
        await createAdminGalleryItem(formData);
        setFeedback({ type: "success", message: "Gallery item created." });
      }
      setShowForm(false);
      resetForm();
      fetchGallery();
    } catch (error) {
      console.error("Failed to save gallery item:", error);
      setFeedback({
        type: "error",
        message: "Failed to save gallery item. Please check your inputs.",
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await deleteAdminGalleryItem(pendingDelete.id);
      setFeedback({ type: "success", message: "Gallery item deleted." });
      fetchGallery();
    } catch (error) {
      console.error("Failed to delete gallery item:", error);
      setFeedback({ type: "error", message: "Failed to delete gallery item." });
    } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const tableData = paginatedItems.map((item) => {
    const assetCount = item.assets?.length ?? 0;
    return [
      item.id,
      item.title,
      SECTION_OPTIONS.find((option) => option.value === item.section)?.label || item.section,
      assetCount,
      new Date(item.updated_at).toLocaleString(),
      <div className="flex gap-2" key={`actions-${item.id}`}>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleEdit(item)}
          title={`Edit ${item.title}`}
          aria-label={`Edit ${item.title}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="danger"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleDelete(item)}
          title={`Delete ${item.title}`}
          aria-label={`Delete ${item.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>,
    ];
  });

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleCloseModal = (open: boolean) => {
    if (!open) {
      setShowForm(false);
      resetForm();
    } else {
      setShowForm(true);
    }
  }

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Gallery Management"
        description="Curate photography, videography, design, and web portfolio entries."
        actions={
          <AdminSearchActions
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search gallery entries..."
            onAdd={startAdd}
            addButtonLabel=""
            addButtonAriaLabel="Add gallery entry"
          />
        }
      />

      {feedback && (
        <Alert
          type={feedback.type === "success" ? "success" : "error"}
          title={feedback.type === "success" ? "Success" : "Error"}
          description={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      <Dialog open={showForm} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-3xl max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Gallery Item" : "Create Gallery Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark">Section</label>
                <select
                  value={form.section}
                  onChange={(e) => {
                    const nextSection = e.target.value as GalleryItem["section"];
                    setForm((prev) => ({
                      ...prev,
                      section: nextSection,
                      displayMode: nextSection === "design" ? prev.displayMode || "gallery" : "",
                    }));
                  }}
                  className="form-input"
                >
                  {SECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <FormInput
                label="Title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <FormInput
                label="Subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              />
              {form.section === "videography" && (
                <FormInput
                  label="Google Drive Link"
                  placeholder="https://drive.google.com/file/d/..."
                  value={form.videoUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, videoUrl: e.target.value }))}
                  helperText="Use a share link; it will be converted to preview automatically."
                />
              )}
              {form.section === "web" && (
                <FormInput
                  label="Website URL"
                  placeholder="https://example.com"
                  value={form.linkUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                />
              )}
              {form.section === "design" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark">Display Mode</label>
                  <select
                    value={form.displayMode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        displayMode: e.target.value as "gallery" | "pdf",
                      }))
                    }
                    className="form-input"
                  >
                    {DISPLAY_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {form.section === "web" && (
              <div>
                <label className="text-sm font-medium text-dark">Project Overview</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="form-input mt-2"
                  placeholder="Describe the project focus, tech, and tone..."
                />
              </div>
            )}

            {(form.section === "photography" || form.section === "design") && form.displayMode !== "pdf" && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-dark">Filters / Tags</label>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter, index) => (
                    <span
                      key={filter}
                      className="inline-flex items-center gap-2 rounded-full bg-light px-3 py-1 text-sm text-dark"
                    >
                      {filter}
                      <button
                        type="button"
                        className="text-danger hover:text-dark"
                        onClick={() => handleRemoveFilter(index)}
                        aria-label={`Remove ${filter}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    className="form-input flex-1"
                    placeholder="Add a filter and press Add"
                  />
                  <Button variant="outline" onClick={handleAddFilter}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-dark">Thumbnail</label>
                <input ref={thumbnailRef} type="file" accept="image/*" className="form-input mt-2" />
                {form.thumbnailPreview && (
                  <div className="mt-3 h-32 w-40 overflow-hidden rounded-xl border border-accent/15">
                    <Image
                      src={form.thumbnailPreview}
                      alt="Thumbnail preview"
                      width={160}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {(form.section === "photography" || form.section === "design" || form.section === "web") && (
                  <div>
                    <label className="text-sm font-medium text-dark">Image Assets</label>
                    <input ref={imageAssetsRef} type="file" accept="image/*" multiple className="form-input mt-2" />
                  </div>
                )}
                {form.section === "design" && (
                  <div>
                    <label className="text-sm font-medium text-dark">PDF Assets</label>
                    <input ref={pdfAssetsRef} type="file" accept="application/pdf" multiple className="form-input mt-2" />
                  </div>
                )}
              </div>
            </div>

            {currentAssets.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-dark">Existing Assets</h3>
                <div className="flex flex-wrap gap-4">
                  {currentAssets.map((asset, index) => (
                    <div key={`${asset.url}-${index}`} className="relative flex h-32 w-32 flex-col overflow-hidden rounded-xl border border-accent/15">
                      {asset.type === "pdf" ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-light text-sm text-dark/70">
                          <span className="text-xs uppercase tracking-[0.2em]">PDF</span>
                          <ExternalLink size={16} />
                        </div>
                      ) : (
                        <Image src={asset.url} alt={asset.caption || "Asset"} fill className="object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset(index)}
                        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-danger shadow"
                        aria-label="Remove asset"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCloseModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitForm}>{editing ? "Update Gallery Item" : "Create Gallery Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p>Loading gallery entries...</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-accent/15 bg-white p-6 text-center text-muted shadow-sm">
          No gallery entries yet.
        </div>
      ) : (
        <>
          <Table
            headers={["ID", "Title", "Section", "Assets", "Updated", "Actions"]}
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete gallery item"
        description={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.title}" from the gallery?`
            : "Are you sure you want to delete this entry?"
        }
        confirmText="Yes, delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleteLoading) setPendingDelete(null);
        }}
      />
    </div>
  );
}