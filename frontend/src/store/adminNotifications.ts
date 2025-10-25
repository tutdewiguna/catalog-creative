"use client";

import { create } from "zustand";

type AdminNotificationState = {
  hasNewOrders: boolean;
  lastKnownOrderIds: number[];
  initialized: boolean;
  flagNewOrders: (orderIds: number[]) => void;
  clearNewOrders: () => void;
};

export const useAdminNotificationStore = create<AdminNotificationState>(
  (set, get) => ({
    hasNewOrders: false,
    lastKnownOrderIds: [],
    initialized: false,
    flagNewOrders: (orderIds: number[]) => {
      const sorted = [...orderIds].sort((a, b) => a - b);
      const state = get();
      if (!state.initialized) {
        set({
          initialized: true,
          lastKnownOrderIds: sorted,
          hasNewOrders: false,
        });
        return;
      }
      const prevSet = new Set(state.lastKnownOrderIds);
      const hasNew = sorted.some((id) => !prevSet.has(id));

      set({
        hasNewOrders: hasNew || state.hasNewOrders,
        lastKnownOrderIds: sorted,
      });
    },
    clearNewOrders: () =>
      set({
        hasNewOrders: false,
      }),
  })
);
