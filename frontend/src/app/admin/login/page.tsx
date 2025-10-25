"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { LogIn, User } from "lucide-react";

import FormInput from "@/components/FormInput";
import Button from "@/components/Button";
import Alert from "@/components/Alert";
import { cn } from "@/lib/utils";
import { registerUser, loginUser } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useUserSession } from "@/store/userSession";

type PortalTab = "admin" | "user";
type UserMode = "login" | "register";

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const setSession = useUserSession((state) => state.setSession);

  const [activePortal, setActivePortal] = useState<PortalTab>("admin");
  const [userMode, setUserMode] = useState<UserMode>("login");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userError, setUserError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  const handleAdminSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminLoading) return;

    setAdminError(null);
    setAdminLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword }),
        }
      );

      if (!response.ok) {
        throw new Error("Admin email or password is incorrect.");
      }

      const payload: { access_token: string } = await response.json();
      login(payload.access_token, "admin", { email: adminEmail.trim() });
      router.push("/admin/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        setAdminError(error.message);
      } else {
        setAdminError("Failed to sign in as admin. Please try again.");
      }
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (userLoading) return;

    setUserError(null);
    setUserLoading(true);

    const email = userEmail.trim();

    try {
      if (userMode === "register") {
        const payload = await registerUser({
          name: userName.trim(),
          email,
          password: userPassword,
        });
        setSession(payload.user, payload.access_token);
        login(payload.access_token, "user", {
          name: payload.user?.name,
          email: payload.user?.email,
        });
      } else {
        const payload = await loginUser({
          email,
          password: userPassword,
        });
        setSession(payload.user, payload.access_token);
        login(payload.access_token, "user", {
          name: payload.user?.name,
          email: payload.user?.email,
        });
      }

      router.push("/admin/dashboard");
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const message =
        axiosError.response?.data?.detail ||
        (userMode === "register"
          ? "Unable to create a new account. Please verify the information you entered."
          : "Email or password does not match.");
      setUserError(message);
    } finally {
      setUserLoading(false);
    }
  };

  const switchPortal = (tab: PortalTab) => {
    setActivePortal(tab);
    setAdminError(null);
    setUserError(null);
    if (tab === "admin") {
      setUserMode("login");
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-light font-sans">
      <div className="hidden lg:flex flex-col items-center justify-center bg-accent text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 -z-0">
        </div>
         <div className="relative z-10 text-center space-y-8 max-w-md">
           <Image
             src="/images/logo-white.svg"
             alt="Devara Creative Logo"
             width={80}
             height={80}
             className="mx-auto mb-6"
           />
           <h1 className="text-4xl font-display font-semibold leading-tight">
             Devara Creative Workspace
           </h1>
           <p className="text-lg text-white/70">
             Manage projects, orders, and client interactions seamlessly in one central hub.
           </p>
         </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:hidden mb-8">
                <Image
                    src="/images/logo.svg"
                    alt="Devara Creative Logo"
                    width={60}
                    height={60}
                    className="mx-auto mb-4"
                />
            </div>
          <div className="space-y-3 text-left">
            <h2 className="text-3xl font-display font-bold text-dark">
              Portal Access
            </h2>
            <p className="text-sm text-muted">
              Choose your role to sign in to the workspace.
            </p>
          </div>

          <div className="flex rounded-full bg-light border border-accent/10 p-1 text-sm font-semibold">
            {[
              { key: "admin", label: "Admin", icon: User },
              { key: "user", label: "User", icon: LogIn },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchPortal(tab.key as PortalTab)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 transition flex items-center justify-center gap-2",
                  activePortal === tab.key
                    ? "bg-primary text-dark shadow"
                    : "text-muted hover:text-dark hover:bg-accent/5"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-accent/10 bg-white p-6 sm:p-8 shadow-sm">
            {activePortal === "admin" ? (
              <form className="space-y-5" onSubmit={handleAdminSubmit}>
                {adminError && <Alert variant="error">{adminError}</Alert>}
                <FormInput
                  label="Admin Email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@devara.com"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  required
                />
                <FormInput
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                />
                <Button type="submit" fullWidth size="lg" disabled={adminLoading}>
                  {adminLoading ? "Signing in..." : "Sign in as Admin"}
                </Button>
                <p className="text-center text-xs text-muted/80">
                  Admin access requires manual setup. Contact the owner if you need credentials.
                </p>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex rounded-full bg-light border border-accent/10 p-1 text-sm font-semibold">
                  {[
                    { key: "login", label: "Sign In" },
                    { key: "register", label: "Sign Up" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setUserMode(item.key as UserMode);
                        setUserError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-full px-4 py-2 transition",
                        userMode === item.key
                          ? "bg-accent text-white shadow"
                          : "text-muted hover:text-dark hover:bg-accent/5"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <form className="space-y-5" onSubmit={handleUserSubmit}>
                  {userError && <Alert variant="error">{userError}</Alert>}

                  {userMode === "register" && (
                    <FormInput
                      label="Full Name"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      required
                    />
                  )}

                  <FormInput
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="team@example.com"
                    value={userEmail}
                    onChange={(event) => setUserEmail(event.target.value)}
                    required
                  />
                  <FormInput
                    label="Password"
                    type="password"
                    autoComplete={userMode === "register" ? "new-password" : "current-password"}
                    placeholder={userMode === "register" ? "Create a password" : "Enter your password"}
                    value={userPassword}
                    onChange={(event) => setUserPassword(event.target.value)}
                    required
                  />

                  <Button type="submit" fullWidth size="lg" disabled={userLoading}>
                    {userLoading
                      ? userMode === "register"
                        ? "Creating Account..."
                        : "Signing In..."
                      : userMode === "register"
                      ? "Create User Account"
                      : "Sign in as User"}
                  </Button>
                   <p className="text-center text-xs text-muted/80">
                     User accounts provide read-only access to relevant project details.
                   </p>
                </form>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted">
            Need to go back?{" "}
            <Link
              href="/"
              className="font-semibold text-primary hover:text-accent"
            >
              Return to Homepage
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}