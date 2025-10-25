"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { use } from "react";

export default function ConfirmationPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  return (
    <div className="max-w-md mx-auto text-center py-20 px-4">
      {status === 'success' ? (
        <>
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold">Payment Successful!</h1>
          <p className="text-muted mt-2">Your order #{params.id} has been confirmed. We will process it shortly.</p>
        </>
      ) : (
        <>
          <AlertCircle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold">Awaiting Confirmation</h1>
          <p className="text-muted mt-2">Your order #{params.id} is awaiting payment confirmation. We will notify you via email once it's confirmed.</p>
        </>
      )}
      <Link href="/services" className="mt-8 inline-block text-primary font-semibold hover:underline">
        Back to Services
      </Link>
    </div>
  );
}




