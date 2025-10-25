"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getUserSession } from "@/lib/api";
import { useUserSession } from "@/store/userSession";

const FALLBACK_REDIRECT = "/history";

export default function GoogleSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useUserSession((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const provided = searchParams.get("next") || "";
    if (!provided.startsWith("/")) {
      return FALLBACK_REDIRECT;
    }
    return provided;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const data = await getUserSession();
        if (cancelled) return;
        setSession(data.user, data.access_token);
        router.replace(nextPath);
      } catch (err) {
        console.error("Failed to finalize Google login:", err);
        if (cancelled) return;
        setError("We couldn't finish the Google sign-in. Please try again.");
        setTimeout(() => {
          router.replace("/login?error=google_auth_failed");
        }, 2500);
      }
    };

    const queryError = searchParams.get("error");
    if (queryError) {
      setError("Google OAuth was cancelled. Please try again.");
      const timer = setTimeout(() => {
        router.replace("/login?error=" + encodeURIComponent(queryError));
      }, 2000);
      return () => clearTimeout(timer);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, setSession, nextPath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-light px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-md p-8 text-center">
        <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" aria-hidden="true" />
        <h1 className="mt-6 text-2xl font-semibold text-dark">Linking your Google account…</h1>
        <p className="mt-3 text-sm text-muted">
          We're preparing your profile. You'll be redirected automatically.
        </p>
        {error && (
          <p className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}


