"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import Button from "./Button";

interface ProtectedGuardProps {
  isAllowed: boolean;
  children: React.ReactNode;
}

export default function ProtectedGuard({
  isAllowed,
  children,
}: ProtectedGuardProps) {
  const router = useRouter();

  if (isAllowed) return <>{children}</>;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
      <div className="flex flex-col items-center justify-center bg-light rounded-2xl p-10 shadow-soft border border-accent/10 max-w-lg">
        <ShieldAlert className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-2xl font-display font-semibold text-dark mb-2">
          Access Denied
        </h2>
        <p className="text-muted text-sm mb-6">
          You don't have permission to view this page. Please log in with the
          correct account or return to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => router.push("/")}
          >
            Go to Homepage
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => router.push("/login")}
          >
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}
