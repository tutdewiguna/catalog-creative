"use client";

import { useUserSession } from "@/store/userSession";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Shield, Link as LinkIcon, LogOut, Loader2, Unlink } from "lucide-react";
import Button from "@/components/Button";
import Alert from "@/components/Alert";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AuthProvider = {
  provider: string;
  provider_id: string;
  email?: string;
  linked_at: string;
};

export default function AccountPage() {
  const { user, token, clearSession } = useUserSession();
  const router = useRouter();
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/login?next=/account");
      return;
    }

    const fetchProviders = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/account/providers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch providers");
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Could not load account connection data.");
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, [token, router]);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };
  
  const handleLinkGoogle = () => {
    window.location.href = `${API_BASE}/api/account/providers/google/link`;
  };
  
  const handleUnlinkGoogle = async () => {
    if (!confirm("Are you sure you want to unlink your Google account?")) return;
    try {
        const res = await fetch(`${API_BASE}/api/account/providers/google/unlink`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to unlink.");
        setProviders(providers.filter(p => p.provider !== 'google'));
    } catch (err) {
        setError("Could not unlink Google account.");
    }
  };

  const isGoogleLinked = providers.some(p => p.provider === 'google');

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-display font-bold">My Account</h1>
          <p className="mt-2 text-muted">Manage your profile, security, and connections.</p>
        </header>
        {error && <Alert variant="error" className="mb-6">{error}</Alert>}
        <div className="space-y-10">
          <div className="bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-2xl font-semibold flex items-center gap-3"><User /> Profile</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted">Full Name</label>
                <p className="font-semibold text-lg">{user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Email</label>
                <p className="font-semibold text-lg">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-2xl font-semibold flex items-center gap-3"><LinkIcon /> Connections</h2>
            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">Google</h3>
                  <p className="text-sm text-muted">{isGoogleLinked ? "Connected" : "Not Connected"}</p>
                </div>
                {isGoogleLinked ? (
                  <Button variant="danger" size="sm" onClick={handleUnlinkGoogle}><Unlink size={16} className="mr-2"/>Unlink</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleLinkGoogle}><LinkIcon size={16} className="mr-2"/>Link</Button>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut size={16} className="mr-2"/> Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
