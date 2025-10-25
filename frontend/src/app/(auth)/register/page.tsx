"use client";

import { useState, type FormEvent } from "react";
import type { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";

import FormInput from "@/components/FormInput";
import Button from "@/components/Button";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { registerUser } from "@/lib/api";
import { useUserSession } from "@/store/userSession";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useUserSession((state) => state.setSession);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const payload = await registerUser({
        name: fullName,
        email,
        password,
      });
      setSession(payload.user, payload.access_token);
      router.replace("/history");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message =
        axiosErr.response?.data?.detail ||
        "We couldn't create your account. Please review your details and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg p-6 sm:p-10 bg-white rounded-lg sm:rounded-xl">
      <div className="mb-10 text-left">
        <h1 className="text-4xl font-display font-bold text-dark">
          Create an Account
        </h1>
        <p className="mt-3 text-muted">
          Join our creative community to manage your orders and get exclusive
          updates.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <FormInput
          label="Full Name"
          placeholder="John Doe"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <FormInput
          label="Email Address"
          type="email"
          inputMode="email"
          placeholder="john.doe@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <FormInput
          label="Password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className="text-sm text-danger font-medium" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </Button>
        <div className="flex items-center gap-3 text-sm text-muted/80">
          <span className="h-px flex-1 bg-dark/10" aria-hidden="true" />
          <span>or</span>
          <span className="h-px flex-1 bg-dark/10" aria-hidden="true" />
        </div>
        <GoogleAuthButton nextPath="/history">
          Sign up with Google
        </GoogleAuthButton>
      </form>

      <p className="text-center text-muted mt-8">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:text-accent"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}