"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/auth";

export default function AdminPage() {
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.push("/admin/dashboard");
    } else {
      router.push("/admin/login");
    }
  }, [token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-light">
      <p className="text-muted">Mengalihkan...</p>
    </div>
  );
}
