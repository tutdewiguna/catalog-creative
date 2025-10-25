"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getAdminExperiences,
  createAdminExperience,
  updateAdminExperience,
  deleteAdminExperience,
} from "@/lib/api";
import type { Experience } from "@/lib/types";
import Table from "@/components/Table";
import Button from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/Dialog";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Alert from "@/components/Alert";
import AdminSearchActions from "@/components/AdminSearchActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Edit, Loader2, Trash2 } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const EMPTY_FORM = {
  period: "",
  title: "",
  company: "",
  description: "",
  order: "0",
} as const;

type ExperienceFormValues = typeof EMPTY_FORM;
type ExperienceFormErrors = Partial<Record<keyof ExperienceFormValues, string>>;
type FeedbackState = { type: "success" | "error"; message: string } | null;

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const PAGE_SIZE = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [formValues, setFormValues] = useState<ExperienceFormValues>(EMPTY_FORM);
  const [initialValues, setInitialValues] = useState<ExperienceFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<ExperienceFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeExperienceId, setActiveExperienceId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchExperiences();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const fetchExperiences = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminExperiences();
      setExperiences(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch experiences", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Failed to load experiences: ${error.message}`
            : "Failed to load experiences.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (experience?: Experience) => {
    if (experience) {
      const defaults: ExperienceFormValues = {
        period: experience.period ?? "",
        title: experience.title ?? "",
        company: experience.company ?? "",
        description: experience.description ?? "",
        order: experience.order != null ? String(experience.order) : "0",
      };
      setActiveExperienceId(experience.id);
      setFormValues(defaults);
      setInitialValues(defaults);
    } else {
      setActiveExperienceId(null);
      setFormValues(EMPTY_FORM);
      setInitialValues(EMPTY_FORM);
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setActiveExperienceId(null);
    setFormValues(EMPTY_FORM);
    setInitialValues(EMPTY_FORM);
    setFormErrors({});
  };

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting) return;
    if (!open) {
      const isDirty = JSON.stringify(formValues) !== JSON.stringify(initialValues);
      if (isDirty) {
        const confirmClose = window.confirm(
          "Close the form? Unsaved changes will be lost."
        );
        if (!confirmClose) {
          return;
        }
      }
      closeModal();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: name === "order" ? value.replace(/[^0-9]/g, "") : value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = (values: ExperienceFormValues) => {
    const errors: ExperienceFormErrors = {};
    const trimmedPeriod = values.period.trim();
    const trimmedTitle = values.title.trim();
    const trimmedCompany = values.company.trim();
    const trimmedDescription = values.description.trim();

    if (!trimmedPeriod) {
      errors.period = "Period is required.";
    } else if (trimmedPeriod.length > 64) {
      errors.period = "Period is too long (max 64 characters).";
    }

    if (!trimmedTitle) {
      errors.title = "Title is required.";
    } else if (trimmedTitle.length > 160) {
      errors.title = "Title is too long (max 160 characters).";
    }

    if (trimmedCompany.length > 160) {
      errors.company = "Company name is too long (max 160 characters).";
    }

    if (!trimmedDescription) {
      errors.description = "Description is required.";
    } else if (trimmedDescription.length > 2000) {
      errors.description = "Description is too long (max 2000 characters).";
    }

    const parsedOrder = values.order ? Number(values.order) : 0;
    if (!Number.isFinite(parsedOrder) || !Number.isInteger(parsedOrder)) {
      errors.order = "Order must be a number.";
    } else if (parsedOrder < 0) {
      errors.order = "Order cannot be negative.";
    }

    return errors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedValues: ExperienceFormValues = {
      period: formValues.period.trim(),
      title: formValues.title.trim(),
      company: formValues.company.trim(),
      description: formValues.description.trim(),
      order: formValues.order.trim() || "0",
    };

    const errors = validateForm(trimmedValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormValues((prev) => ({ ...prev, ...trimmedValues }));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        period: trimmedValues.period,
        title: trimmedValues.title,
        company: trimmedValues.company ? trimmedValues.company : undefined,
        description: trimmedValues.description,
        order: Number(trimmedValues.order || "0"),
      };

      if (activeExperienceId) {
        await updateAdminExperience(activeExperienceId, payload);
        setFeedback({
          type: "success",
          message: "Experience updated successfully.",
        });
      } else {
        await createAdminExperience(payload);
        setFeedback({
          type: "success",
          message: "New experience saved successfully.",
        });
      }

      closeModal();
      await fetchExperiences();
    } catch (error) {
      console.error("Failed to save experience", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Failed to save data: ${error.message}`
            : "Failed to save experience data.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteAdminExperience(id);
      setFeedback({
        type: "success",
        message: "Experience deleted successfully.",
      });
      setDeleteConfirm(null);
      await fetchExperiences();
    } catch (error) {
      console.error("Failed to delete experience", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Failed to delete data: ${error.message}`
            : "Failed to delete experience data.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const filteredExperiences = useMemo(() => {
    if (!filter) return experiences;
    const lowerFilter = filter.toLowerCase();
    return experiences.filter((exp) =>
      [
        exp.title,
        exp.company,
        exp.description,
        exp.period,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(lowerFilter))
    );
  }, [experiences, filter]);

  const pagination = usePagination(filteredExperiences, PAGE_SIZE);
  const paginatedExperiences = pagination.paginatedItems;

  const tableHeaders = [
    "Period",
    "Title",
    "Company",
    "Description",
    "Order",
    "Actions",
  ];

  const tableData = paginatedExperiences.map((exp) => [
    <span className="font-medium" key="period">
      {exp.period}
    </span>,
    exp.title,
    exp.company || "-",
    <p className="line-clamp-2" key="description">
      {exp.description}
    </p>,
    exp.order,
    <div className="flex gap-2" key="actions">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => openModal(exp)}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="danger"
        size="icon"
        className="h-8 w-8"
        onClick={() => setDeleteConfirm(exp.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>,
  ]);

  const isFormDirty = JSON.stringify(formValues) !== JSON.stringify(initialValues);
  const isEditMode = activeExperienceId !== null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Manage Experiences"
        description="Maintain professional experiences shown on the About page."
        actions={
          <AdminSearchActions
            searchValue={filter}
            onSearchChange={setFilter}
            onAdd={() => openModal()}
            addButtonLabel=""
            addButtonAriaLabel="Add experience"
            placeholder="Search by title, company..."
          />
        }
      />

      {feedback && (
        <Alert
          variant={feedback.type === "success" ? "success" : "error"}
          title={feedback.type === "success" ? "Success" : "An error occurred"}
        >
          {feedback.message}
        </Alert>
      )}

      {isLoading ? (
        <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
          <div className="flex justify-center items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading experiences...
          </div>
        </div>
      ) : filteredExperiences.length === 0 ? (
        <div className="p-8 bg-white border border-accent/15 rounded-2xl text-center text-muted shadow-sm">
          {filter
            ? "No experiences match your search."
            : "No experience data available yet."}
        </div>
      ) : (
        <>
          <Table headers={tableHeaders} data={tableData} />
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.goToPage}
          />
        </>
      )}

      <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Experience" : "Add New Experience"}
            </DialogTitle>
            <DialogDescription>
              Provide experience details. These appear on the About page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-dark" htmlFor="period">
                  Period
                </label>
                <Input
                  id="period"
                  name="period"
                  placeholder="Example: 2020 - 2022"
                  value={formValues.period}
                  onChange={handleFieldChange}
                  disabled={isSubmitting}
                />
                {formErrors.period && (
                  <p className="text-sm text-danger">{formErrors.period}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dark" htmlFor="order">
                  Order
                </label>
                <Input
                  id="order"
                  name="order"
                  type="number"
                  min={0}
                  value={formValues.order}
                  onChange={handleFieldChange}
                  disabled={isSubmitting}
                />
                {formErrors.order && (
                  <p className="text-sm text-danger">{formErrors.order}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-dark" htmlFor="title">
                  Title / Role
                </label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Example: Web Developer"
                value={formValues.title}
                onChange={handleFieldChange}
                disabled={isSubmitting}
              />
              {formErrors.title && (
                <p className="text-sm text-danger">{formErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-dark" htmlFor="company">
                  Company (Optional)
                </label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Example: Aurora Studio"
                value={formValues.company}
                onChange={handleFieldChange}
                disabled={isSubmitting}
              />
              {formErrors.company && (
                <p className="text-sm text-danger">{formErrors.company}</p>
              )}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-dark" htmlFor="description">
                  Description
                </label>
                <Textarea
                  id="description"
                  name="description"
                  rows={5}
                  placeholder="Describe your role or key achievements..."
                value={formValues.description}
                onChange={handleFieldChange}
                disabled={isSubmitting}
              />
              {formErrors.description && (
                <p className="text-sm text-danger">{formErrors.description}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !isFormDirty}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Experience"
        description="This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        loading={isDeleting}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onClose={() => {
          if (!isDeleting) setDeleteConfirm(null);
        }}
      />
    </div>
  );
}