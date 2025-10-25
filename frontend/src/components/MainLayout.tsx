"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageBreadcrumb from "./PageBreadcrumb";
import { useAnalyticsTracker } from "@/lib/analytics";
import { hydrateUserSession } from "@/store/userSession";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');
  const isHomePage = pathname === "/";
  const heroBreadcrumbPaths = ["/gallery"];
  const suppressBreadcrumb = heroBreadcrumbPaths.includes(pathname);
  useAnalyticsTracker({ disabled: isAdminPage });

  useEffect(() => {
    hydrateUserSession();
  }, []);

  useEffect(() => {
    const locale = isAdminPage ? "id" : "en";
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [isAdminPage]);

  if (isAdminPage) {
    return <div className="overflow-x-hidden">{children}</div>;
  }

  return (
    <div className="relative flex flex-col min-h-screen overflow-x-hidden bg-light text-dark">
      <Navbar />
      <div className={`${isHomePage ? "pt-0" : "pt-16"} flex-1 flex flex-col`}>
        {!isHomePage && !suppressBreadcrumb && <PageBreadcrumb />}
        <main className="relative z-0 flex-grow bg-light text-dark pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
