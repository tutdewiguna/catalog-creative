"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Table from '@/components/Table';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import Alert from '@/components/Alert';
import ConfirmDialog from '@/components/ConfirmDialog';
import AdminSearchActions from '@/components/AdminSearchActions';
import AdminPageHeader from '@/components/AdminPageHeader';
import { useAuthStore } from '@/store/auth';
import { Edit, Plus, Trash2 } from 'lucide-react';
import PaginationControls from '@/components/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/Dialog";

type AddOn = {
  name: string;
  price: number;
};

type Highlight = {
  title: string;
  description: string;
  icon: string;
};

type Service = {
  id: number;
  title: string;
  slug: string;
  price: number;
  category: string;
  category_id?: number;
  summary?: string;
  description?: string;
  thumbnail?: string;
  gallery_images?: string[];
  add_ons?: AddOn[];
  highlights?: Highlight[];
};

type Category = {
  id: number;
  name: string;
  slug: string;
};

const USD_TO_IDR_RATE = 15000;

const formatToRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
};

const HIGHLIGHT_ICON_OPTIONS: { value: string; label: string }[] = [
    { value: "sparkles", label: "Sparkles" },
    { value: "message-circle", label: "Message Circle" },
    { value: "clock", label: "Clock" },
    { value: "shield-check", label: "Shield Check" },
    { value: "briefcase", label: "Briefcase" },
    { value: "target", label: "Target" },
    { value: "lightbulb", label: "Lightbulb" },
    { value: "palette", label: "Palette" },
];

const DEFAULT_HIGHLIGHT_ICON = HIGHLIGHT_ICON_OPTIONS[0]?.value || "sparkles";

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

export default function ServicesPage() {
    const { token } = useAuthStore();
    const PAGE_SIZE = 10;
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Service | null>(null);
    const [form, setForm] = useState<Partial<Service>>({});
    const [currentAddOns, setCurrentAddOns] = useState<AddOn[]>([]);
    const [newAddOn, setNewAddOn] = useState({ name: "", price: "" });
    const [currentHighlights, setCurrentHighlights] = useState<Highlight[]>([]);
    const [newHighlight, setNewHighlight] = useState<Highlight>({
        title: "",
        description: "",
        icon: DEFAULT_HIGHLIGHT_ICON,
    });
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const thumbnailRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    async function fetchData() {
        if (!token) return;
        setLoading(true);
        try {
            const [servicesRes, categoriesRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/services`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (servicesRes.ok) {
                const data = await servicesRes.json();
                setServices(Array.isArray(data) ? data : []);
            }
            if (categoriesRes.ok) {
                const data = await categoriesRes.json();
                setCategories(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    useEffect(() => {
        if (!feedback) return;
        const timer = window.setTimeout(() => setFeedback(null), 4000);
        return () => window.clearTimeout(timer);
    }, [feedback]);

    const handleTitleChange = (value: string) => {
        setForm(prev => {
            const updated = { ...prev, title: value };
            if (!slugManuallyEdited) {
                updated.slug = slugify(value);
            }
            return updated;
        });
    };

    const handleSlugChange = (value: string) => {
        if (value.length === 0) {
            setSlugManuallyEdited(false);
            setForm(prev => ({ ...prev, slug: "" }));
            return;
        }
        setSlugManuallyEdited(true);
        setForm(prev => ({ ...prev, slug: value }));
    };

    function startAdd() {
        setEditing(null);
        setSlugManuallyEdited(false);
        setForm({
            title: "",
            slug: "",
            price: 0,
            category_id: categories[0]?.id || 0,
            summary: "",
            description: "",
        });
        setCurrentAddOns([]);
        setCurrentHighlights([]);
        setNewAddOn({ name: "", price: "" });
        setNewHighlight({
            title: "",
            description: "",
            icon: HIGHLIGHT_ICON_OPTIONS[0]?.value || "sparkles",
        });
        if (thumbnailRef.current) {
            thumbnailRef.current.value = "";
        }
        if (galleryRef.current) {
            galleryRef.current.value = "";
        }
        setShowForm(true);
    }

    function startEdit(service: Service) {
        setEditing(service);
        setSlugManuallyEdited(false);
        const categoryId = service.category_id ?? categories.find(c => c.name === service.category)?.id;
        setForm({
            title: service.title,
            slug: service.slug,
            price: service.price * USD_TO_IDR_RATE,
            category_id: categoryId,
            summary: service.summary ?? "",
            description: service.description ?? "",
        });
        setCurrentAddOns(
            (service.add_ons || []).map(addon => ({
                ...addon,
                price: addon.price * USD_TO_IDR_RATE,
            }))
        );
        setCurrentHighlights((service.highlights || []).map(item => ({ ...item })));
        setNewAddOn({ name: "", price: "" });
        setNewHighlight({
            title: "",
            description: "",
            icon: HIGHLIGHT_ICON_OPTIONS[0]?.value || "sparkles",
        });
        if (thumbnailRef.current) {
            thumbnailRef.current.value = "";
        }
        if (galleryRef.current) {
            galleryRef.current.value = "";
        }
        setShowForm(true);
    }

    function handleAddOn() {
        if (newAddOn.name && newAddOn.price) {
            setCurrentAddOns([...currentAddOns, { name: newAddOn.name, price: parseFloat(newAddOn.price) }]);
            setNewAddOn({ name: "", price: "" });
        }
    }

    function removeAddOn(index: number) {
        setCurrentAddOns(currentAddOns.filter((_, i) => i !== index));
    }

    function handleAddHighlight() {
        if (newHighlight.title.trim() && newHighlight.description.trim()) {
            setCurrentHighlights([...currentHighlights, { ...newHighlight }]);
            setNewHighlight({
                title: "",
                description: "",
                icon: HIGHLIGHT_ICON_OPTIONS[0]?.value || "sparkles",
            });
        }
    }

    function updateHighlight(index: number, field: keyof Highlight, value: string) {
        setCurrentHighlights(prev =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    }

    function removeHighlight(index: number) {
        setCurrentHighlights(currentHighlights.filter((_, i) => i !== index));
    }

    async function submit() {
        if (!token) return;

        const addOnsInUSD = currentAddOns.map(addon => ({ ...addon, price: addon.price / USD_TO_IDR_RATE }));

        const formData = new FormData();
        formData.append('title', form.title || '');
        formData.append('slug', form.slug || '');
        formData.append('price', ((form.price || 0) / USD_TO_IDR_RATE).toString());
        formData.append('category_id', (form.category_id || 0).toString());
        formData.append('summary', form.summary || '');
        formData.append('description', form.description || '');
        formData.append('addons', JSON.stringify(addOnsInUSD));
        formData.append('highlights', JSON.stringify(currentHighlights));

        if (thumbnailRef.current?.files?.[0]) {
            formData.append('thumbnail', thumbnailRef.current.files[0]);
        }
        if (galleryRef.current?.files) {
            for (const file of Array.from(galleryRef.current.files)) {
                formData.append('gallery_images', file);
            }
        }

        const url = editing
            ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/services/${editing.id}`
            : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/services`;

        const method = editing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (!res.ok) {
                let message = "Failed to save the service. Please try again.";
                try {
                    const err = await res.json();
                    if (err?.detail) message = err.detail;
                } catch {
                    const text = await res.text();
                    if (text) message = text;
                }
                throw new Error(message);
            }

            setShowForm(false);
            setEditing(null);
            setForm({});
            setCurrentAddOns([]);
            setCurrentHighlights([]);
            if (thumbnailRef.current) thumbnailRef.current.value = "";
            if (galleryRef.current) galleryRef.current.value = "";
            setSlugManuallyEdited(false);

            setFeedback({
                type: "success",
                message: editing
                    ? "Service updated successfully."
                    : "New service added successfully.",
            });

            await fetchData();
        } catch (error) {
            console.error("Failed to save service:", error);
            setFeedback({
                type: "error",
                message: editing
                    ? "Failed to update the service. Please try again."
                    : "Failed to add the service. Please try again.",
            });
        }
    }

    const requestDelete = (service: Service) => {
        setPendingDelete(service);
    };

    const confirmDelete = async () => {
        if (!pendingDelete || !token) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/services/${pendingDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                let message = "Failed to delete this service.";
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
                message: `Service "${pendingDelete.title}" was deleted successfully.`,
            });
            setPendingDelete(null);
            await fetchData();
        } catch (error) {
            console.error("Failed to delete service:", error);
            setFeedback({
                type: "error",
                message: "Failed to delete the service. Please try again.",
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    const [searchTerm, setSearchTerm] = useState("");

    const filteredServices = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return services;
        return services.filter((s) => {
            const values = [
                s.id?.toString() ?? "",
                s.title ?? "",
                s.slug ?? "",
                s.category ?? "",
            ];
            return values.some((value) =>
                value.toLowerCase().includes(term)
            );
        });
    }, [services, searchTerm]);

    const pagination = usePagination(filteredServices, PAGE_SIZE);
    const paginatedServices = pagination.paginatedItems;

    const tableData = paginatedServices.map(s => [
        s.id,
        s.title,
        s.slug,
        s.category,
        formatToRupiah(s.price * USD_TO_IDR_RATE),
        <div key={s.id} className="flex gap-2">
            <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => startEdit(s)}
                title="Edit service"
                aria-label="Edit service"
            >
                <Edit className="h-4 w-4" />
            </Button>
            <Button
                size="icon"
                variant="danger"
                className="h-8 w-8"
                onClick={() => requestDelete(s)}
                title="Delete service"
                aria-label="Delete service"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    ]);

    const handleCloseModal = (open: boolean) => {
        if (!open) {
            setShowForm(false);
            setEditing(null);
            setSlugManuallyEdited(false);
        } else {
            setShowForm(true);
        }
    };

    return (
        <>
        <div className="space-y-8">
            <AdminPageHeader
                title="Manage Services"
                description="Configure primary offerings and supporting bundles for your catalog."
                actions={
                    <AdminSearchActions
                        searchValue={searchTerm}
                        onSearchChange={setSearchTerm}
                        placeholder="Search service..."
                        onAdd={startAdd}
                        addButtonLabel=""
                        addButtonAriaLabel="Add service"
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
            
            <Dialog open={showForm} onOpenChange={handleCloseModal}>
                <DialogContent className="max-w-3xl max-h-[90svh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Service" : "Add Service"}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <FormInput
                                label="Title"
                                value={form.title || ""}
                                onChange={(e) => handleTitleChange(e.target.value)}
                            />
                            <FormInput
                                label="Slug"
                                value={form.slug || ""}
                                onChange={(e) => handleSlugChange(e.target.value)}
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <FormInput label="Price (IDR)" type="number" value={form.price || ""} onChange={(e) => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))} />
                            <div>
                                <label className="text-sm font-medium text-dark mb-2 block">Category</label>
                                <select value={form.category_id || ''} onChange={(e) => setForm(f => ({...f, category_id: parseInt(e.target.value)}))} className="form-input">
                                    <option value="" disabled>Select a category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <FormInput label="Summary" value={form.summary || ""} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} />
                        <div>
                            <label className="text-sm font-medium text-dark mb-2 block">Description</label>
                            <textarea rows={5} className="form-input" value={form.description || ""} onChange={(e) => setForm(f => ({...f, description: e.target.value}))}></textarea>
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-lg mb-4">Add-ons</h3>
                            <div className="space-y-2 mb-4">
                                {currentAddOns.map((addon, index) => (
                                    <div key={index} className="flex items-center justify-between bg-light p-2 rounded-md">
                                        <span>{addon.name} - {formatToRupiah(addon.price)}</span>
                                        <Button size="sm" variant="danger" onClick={() => removeAddOn(index)}><Trash2 size={14} /></Button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-end gap-3">
                                <FormInput label="Add-on Name" value={newAddOn.name} onChange={(e) => setNewAddOn({...newAddOn, name: e.target.value})} />
                                <FormInput label="Add-on Price (IDR)" type="number" value={newAddOn.price} onChange={(e) => setNewAddOn({...newAddOn, price: e.target.value})} />
                                <Button variant="outline" onClick={handleAddOn} className="flex items-center gap-2">
                                    <Plus size={16} aria-hidden="true" />
                                    Add add-on
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-lg mb-2">What's Included</h3>
                            <p className="text-sm text-muted mb-4">
                                These highlight items appear in the service detail page under "What's Included".
                            </p>
                            <div className="space-y-4 mb-4">
                                {currentHighlights.length === 0 ? (
                                    <p className="text-sm text-muted">No highlight items yet.</p>
                                ) : (
                                    currentHighlights.map((highlight, index) => (
                                        <div key={index} className="space-y-3 rounded-lg border border-accent/15 bg-light p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-muted">Item #{index + 1}</span>
                                                <Button size="sm" variant="danger" onClick={() => removeHighlight(index)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                            <FormInput
                                                label="Highlight Title"
                                                value={highlight.title}
                                                onChange={(e) => updateHighlight(index, "title", e.target.value)}
                                            />
                                            <div>
                                                <label className="text-sm font-medium text-dark mb-2 block">Highlight Description</label>
                                                <textarea
                                                    rows={3}
                                                    className="form-input"
                                                    value={highlight.description}
                                                    onChange={(e) => updateHighlight(index, "description", e.target.value)}
                                                ></textarea>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-dark mb-2 block">Icon</label>
                                                <select
                                                    className="form-input"
                                                    value={highlight.icon}
                                                    onChange={(e) => updateHighlight(index, "icon", e.target.value)}
                                                >
                                                    {HIGHLIGHT_ICON_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                    {!HIGHLIGHT_ICON_OPTIONS.some(option => option.value === highlight.icon) && highlight.icon && (
                                                        <option value={highlight.icon}>{highlight.icon}</option>
                                                    )}
                                                </select>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="grid md:grid-cols-3 gap-3 items-end">
                                <FormInput
                                    label="New Title"
                                    value={newHighlight.title}
                                    onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })}
                                />
                                <div>
                                    <label className="text-sm font-medium text-dark mb-2 block">New Description</label>
                                    <textarea
                                        rows={3}
                                        className="form-input"
                                        value={newHighlight.description}
                                        onChange={(e) => setNewHighlight({ ...newHighlight, description: e.target.value })}
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-dark mb-2 block">Icon</label>
                                    <select
                                        className="form-input"
                                        value={newHighlight.icon}
                                        onChange={(e) => setNewHighlight({ ...newHighlight, icon: e.target.value })}
                                    >
                                        {HIGHLIGHT_ICON_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-3">
                                <Button variant="outline" onClick={handleAddHighlight} className="flex items-center gap-2">
                                    <Plus size={16} aria-hidden="true" />
                                    Add highlight
                                </Button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                                <label className="text-sm font-medium text-dark mb-2 block">Thumbnail (Main Image)</label>
                                <input type="file" ref={thumbnailRef} name="thumbnail" className="form-input" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-dark mb-2 block">Gallery Images (Multiple)</label>
                                <input type="file" ref={galleryRef} name="gallery_images" multiple className="form-input" />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => handleCloseModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={submit}>{editing ? "Update Service" : "Create Service"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {loading ? (
                <p>Loading services...</p>
            ) : filteredServices.length === 0 ? (
                <div className="p-6 rounded-xl border border-accent/15 bg-white text-center text-muted shadow-sm">
                    {searchTerm ? "No services match your search." : "No services available yet."}
                </div>
            ) : (
                <>
                    <Table
                        headers={['ID', 'Title', 'Slug', 'Category', 'Price', 'Actions']}
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
            title="Delete Service"
            description={
                pendingDelete
                    ? `Are you sure you want to delete the service "${pendingDelete.title}"?`
                    : "Are you sure you want to delete this service?"
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