"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import Button from "@/components/Button";
import { useAuthStore } from "@/store/auth";

export default function AdminLogoutPage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    logout();

    const timeout = window.setTimeout(() => {
      router.replace("/admin/login");
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [logout, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-light text-dark font-sans p-6">
       <div className="w-full max-w-md text-center space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-accent/10">
         <Image
           src="/images/logo.svg"
           alt="Devara Creative Logo"
           width={60}
           height={60}
           className="mx-auto mb-4"
         />
         <div className="flex justify-center items-center gap-3 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg font-semibold tracking-wide">
             Logging Out Securely
            </span>
         </div>

         <div className="space-y-3">
           <h1 className="text-2xl font-display font-semibold text-dark">
             Closing your session...
           </h1>
           <p className="text-base text-muted">
             Please wait while we securely log you out. You'll be redirected back to the login page shortly.
           </p>
         </div>
       </div>
    </main>
  );
}