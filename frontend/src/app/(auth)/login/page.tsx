"use client";

import { useState, type FormEvent } from "react";
import type { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";

import FormInput from "@/components/FormInput";
import Button from "@/components/Button";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { loginUser } from "@/lib/api";
import { useUserSession } from "@/store/userSession";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useUserSession((state) => state.setSession);

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
      const payload = await loginUser({ email, password });
      setSession(payload.user, payload.access_token);
      router.replace("/history");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message =
        axiosErr.response?.data?.detail ||
        "The email or password you entered is incorrect. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg p-6 sm:p-10 bg-white rounded-lg sm:rounded-xl">
      <div className="mb-10 text-left">
        <h1 className="text-4xl font-display font-bold text-dark">
          Welcome Back
        </h1>
        <p className="mt-3 text-muted">
          Please enter your details to sign in to your account.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <FormInput
          label="Email Address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="john.doe@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-dark">Password</label>
            <Link
              href="#"
              className="text-sm font-semibold text-primary hover:text-accent"
            >
              Forgot password?
            </Link>
          </div>
          <FormInput
            type="password"
            placeholder="Enter your password"
            className="mt-1.5"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-danger font-medium" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
        <div className="flex items-center gap-3 text-sm text-muted/80">
          <span className="h-px flex-1 bg-dark/10" aria-hidden="true" />
          <span>or</span>
          <span className="h-px flex-1 bg-dark/10" aria-hidden="true" />
        </div>
        <GoogleAuthButton nextPath="/history">
          Sign in with Google
        </GoogleAuthButton>
      </form>

      <p className="text-center text-muted mt-8">
        Don't have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:text-accent"
        >
          Sign Up
        </Link>
      </p>
    </div>
  );
}