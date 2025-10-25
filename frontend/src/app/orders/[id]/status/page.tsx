import { redirect } from "next/navigation";

export default function PaymentStatusRedirect({ params }: { params: { id: string } }) {
  redirect(`/checkout/payment/${params.id}`);
}
