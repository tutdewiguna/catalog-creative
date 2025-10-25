"use client";

import Button from "@/components/Button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const hasItems = totalItems > 0;
  const startItem = hasItems ? currentPage * pageSize + 1 : 0;
  const endItem = hasItems
    ? Math.min((currentPage + 1) * pageSize, totalItems)
    : 0;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index);
  const shouldShowPagination = hasItems && totalPages > 1;
  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <div
      className={cn(
        "mt-4 flex flex-col items-center gap-2 text-center",
        className
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {hasItems
          ? `Showing ${startItem}-${endItem} of ${totalItems}`
          : "No data available"}
      </span>
      {shouldShowPagination && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            shape="circle"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageNumbers.map((pageIndex) => {
            const pageNumber = pageIndex + 1;
            const isActive = pageIndex === currentPage;

            return (
              <Button
                key={pageNumber}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageIndex)}
                aria-current={isActive ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="icon"
            shape="circle"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
