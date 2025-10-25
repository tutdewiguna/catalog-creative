"use client";

import React, { useState } from "react";
import Button from "@/components/Button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoogleAuthButtonProps {
  nextPath?: string;
  className?: string;
  children?: React.ReactNode;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_NEXT = "/history";

function buildRedirectPath(nextPath?: string) {
  const target = typeof nextPath === "string" && nextPath.startsWith("/")
    ? nextPath
    : DEFAULT_NEXT;
  const successPath = "/auth/google/success";
  const params = new URLSearchParams({ next: target });
  return `${successPath}?${params.toString()}`;
}

export default function GoogleAuthButton({
  nextPath,
  className,
  children,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (loading) return;
    setLoading(true);
    const redirectPath = buildRedirectPath(nextPath);
    const params = new URLSearchParams({ redirect: redirectPath });
    const url = `${API_BASE}/api/auth/google/login?${params.toString()}`;
    window.location.href = url;
  };

  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      onClick={handleClick}
      disabled={loading}
      className={cn("flex items-center justify-center gap-3", className)}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <GoogleLogo aria-hidden="true" />
      )}
      <span>{children ?? "Sign in with Google"}</span>
    </Button>
  );
}

function GoogleLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M21.35 11.1H12v2.8h5.35c-.35 1.8-2.02 3.1-4.35 3.1a4.77 4.77 0 0 1-4.78-4.8 4.77 4.77 0 0 1 4.78-4.8c1.1 0 2.1.4 2.86 1.04l2-2.04A8.02 8.02 0 0 0 13 4a8 8 0 1 0 0 16c4.6 0 7.97-3.22 7.97-7.8 0-.52-.06-1-.17-1.5Z"
        fill="#D4AF37"
      />
    </svg>
  );
}
