"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Minus } from "lucide-react";
import Button from "@/components/Button";
import { validatePromoCode } from "@/lib/api";
import { useCartStore } from "@/store/cart";

type PromoValidationResponse = {
  code: string;
  discount_percent: number;
  discount_amount: number;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export default function CartPage() {
  const {
    items,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    promoCode,
    promoDiscountPercent,
    setPromo,
    clearPromo,
  } = useCartStore();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    if (promoCode) {
      setPromoInput(promoCode);
    } else {
      setPromoInput("");
    }
  }, [promoCode]);

  useEffect(() => {
    if (items.length === 0) {
      clearPromo();
      setPromoError("");
      setPromoSuccess("");
    }
  }, [items.length, clearPromo]);

  const calculateItemTotal = (item: any) => {
    const addOnsTotal = Array.isArray(item.selectedAddOns)
      ? item.selectedAddOns.reduce((acc: number, addon: any) => acc + addon.price, 0)
      : 0;
    return (item.price + addOnsTotal) * item.quantity;
  };

  const subtotal = items.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  const discountAmount = promoCode ? roundCurrency(subtotal * (promoDiscountPercent / 100)) : 0;
  const finalTotal = promoCode ? roundCurrency(Math.max(subtotal - discountAmount, 0)) : subtotal;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount * 15000);
  };

  const applyDisabled =
    promoLoading || !promoInput.trim() || promoInput.trim().toUpperCase() === (promoCode ?? "");

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Enter a promo code first.");
      setPromoSuccess("");
      return;
    }
    setPromoLoading(true);
    try {
      const result = (await validatePromoCode({ code, total: subtotal })) as PromoValidationResponse;
      setPromo(result.code, result.discount_percent);
      setPromoInput(result.code);
      setPromoError("");
      setPromoSuccess(
        `Promo ${result.code} applied. You saved ${formatPrice(result.discount_amount)}.`
      );
    } catch (error) {
      const message = (error as any)?.response?.data?.detail || "Promo code cannot be used.";
      setPromoError(message);
      setPromoSuccess("");
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePromoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await applyPromo();
  };

  const handleRemovePromo = () => {
    clearPromo();
    setPromoSuccess("");
    setPromoError("");
  };

  return (
    <main className="font-sans bg-white text-dark antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-8">Cart</h1>

        {items.length > 0 ? (
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-accent/15">
              <h2 className="text-2xl font-semibold mb-6">Your Items ({items.length})</h2>
              <div className="divide-y divide-accent/15">
                {items.map((item) => (
                  <div key={item.id} className="py-6 first:pt-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="relative h-40 w-full sm:h-28 sm:w-28 flex-shrink-0 overflow-hidden rounded-lg border border-accent/15">
                        <Image
                          src={item.img}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 112px"
                        />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm text-muted">{item.category}</p>
                            <Link
                              href={`/service/${item.slug}`}
                              className="font-semibold hover:text-primary"
                            >
                              {item.title}
                            </Link>
                            <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>
                          </div>
                          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end sm:gap-3">
                            <div className="flex items-center border border-accent/15 rounded-lg">
                              <button
                                onClick={() => decreaseQuantity(item.id)}
                                className="p-2 hover:bg-light transition"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="px-3 font-semibold text-sm">{item.quantity}</span>
                              <button
                                onClick={() => increaseQuantity(item.id)}
                                className="p-2 hover:bg-light transition"
                                aria-label="Increase quantity"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-muted/80 hover:text-danger transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                          <div className="pl-4 border-l-2 border-accent/15 space-y-2">
                            <p className="font-semibold text-sm">Add-ons:</p>
                            {item.selectedAddOns.map((addon: any) => (
                              <div key={addon.name} className="flex justify-between items-center text-sm">
                                <p className="text-muted">{addon.name}</p>
                                <p className="font-medium text-dark">+{formatPrice(addon.price)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1 lg:sticky lg:top-28">
              <div className="bg-white p-6 rounded-2xl border border-accent/15">
                <h2 className="text-2xl font-semibold mb-6">Order Summary</h2>
                <div className="mt-4">
                  <form onSubmit={handlePromoSubmit} className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-muted mb-2">
                        Promo Code
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          value={promoInput}
                          onChange={(event) => {
                            setPromoInput(event.target.value.toUpperCase());
                            setPromoError("");
                            setPromoSuccess("");
                          }}
                          placeholder="Enter your promo code"
                          className="form-input flex-1"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          size="md"
                          disabled={applyDisabled}
                          className="w-full sm:w-auto"
                        >
                          {promoLoading ? "Processing..." : "Apply"}
                        </Button>
                      </div>
                    </div>
                    {promoError && (
                      <p className="text-sm text-danger">{promoError}</p>
                    )}
                    {promoSuccess && (
                      <p className="text-sm text-success">{promoSuccess}</p>
                    )}
                    {promoCode && (
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-sm text-primary hover:text-accent"
                      >
                        Remove promo
                      </button>
                    )}
                  </form>
                </div>
                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="flex justify-between text-dark">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {promoCode && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Promo ({promoCode})</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xl">
                    <span>Total</span>
                    <span>{formatPrice(finalTotal)}</span>
                  </div>
                </div>
                <Link href="/checkout" passHref>
                  <Button fullWidth size="lg" className="mt-8">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/services"
                  className="text-sm font-semibold text-primary hover:text-accent inline-flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-accent/15">
            <h2 className="text-2xl font-bold mb-4">Your Cart is Empty</h2>
            <p className="text-muted mb-8">Looks like you haven't added any services yet.</p>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full hover:bg-accent transition-colors font-semibold"
            >
              <ArrowLeft size={18} />
              <span>Explore Services</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
