"use client";

import React, { useState, useEffect } from "react";
import Table from "@/components/Table";
import Button from "@/components/Button";
import { useAuthStore } from "@/store/auth";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Mail } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

export default function MessagesPage() {
  const { token, role } = useAuthStore();
  const isAdmin = role === "admin";
  const PAGE_SIZE = 10;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const storedToken = localStorage.getItem("adm_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/messages`,
          { headers: { Authorization: `Bearer ${storedToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [token, role]);

  const pagination = usePagination(messages, PAGE_SIZE);
  const paginatedMessages = pagination.paginatedItems;

  const tableData = paginatedMessages.map((m) => [
    m.id,
    m.name,
    m.email,
    m.subject,
    <span
      key={`status-${m.id}`}
      className={`px-3 py-1 text-sm font-medium rounded-full ${
        m.is_read
          ? "bg-success/15 text-success"
          : "bg-warning/20 text-warning"
      }`}
    >
      {m.is_read ? "Read" : "Unread"}
    </span>,
    <div key={m.id} className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          window.location.href = `mailto:${m.email}?subject=Re: ${m.subject}`;
        }}
        title={`Reply to ${m.name}`}
        aria-label={`Reply to ${m.name}`}
      >
        <Mail className="h-4 w-4" />
      </Button>
    </div>,
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={isAdmin ? "Inbox" : "Team Chat Inbox"}
        description={
          isAdmin
            ? "Review and respond to customer conversations from one place."
            : "You have read-only access to monitor ongoing conversations."
        }
      />

      {loading ? (
        <p className="text-muted">Loading messages...</p>
      ) : messages.length === 0 ? (
        <div className="p-8 bg-light border border-accent/10 rounded-2xl text-center text-muted shadow-soft">
          No messages found.
        </div>
      ) : (
        <>
          <Table
            headers={["ID", "Name", "Email", "Subject", "Status", "Actions"]}
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
  );
}
