"use client";

import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(items: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setCurrentPage(0);
  }, [items, pageSize]);

  useEffect(() => {
    setCurrentPage((prev) => {
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      return Math.min(prev, maxPage);
    });
  }, [items.length, pageSize]);

  const totalPages = Math.ceil(items.length / pageSize);

  const paginatedItems = useMemo(() => {
    if (items.length === 0) {
      return [] as T[];
    }
    const start = currentPage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const goToNext = () => {
    setCurrentPage((prev) => {
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      return Math.min(prev + 1, maxPage);
    });
  };

  const goToPage = (page: number) => {
    setCurrentPage(() => {
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      const nextPage = Number.isFinite(page) ? page : 0;
      return Math.min(Math.max(nextPage, 0), maxPage);
    });
  };

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems: items.length,
    paginatedItems,
    goToPrevious,
    goToNext,
    goToPage,
  };
}

export type UsePaginationReturn<T> = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  paginatedItems: T[];
  goToPrevious: () => void;
  goToNext: () => void;
  goToPage: (page: number) => void;
};
