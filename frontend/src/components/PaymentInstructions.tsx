"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CreditCard, Smartphone, Globe } from "lucide-react";
import { bankInstructions, fallbackInstructions, BankInstructionSet } from "@/lib/bankInstructions";
import { cn } from "@/lib/utils";

interface PaymentInstructionsProps {
  bankCode?: string | null;
  virtualAccountNumber?: string | null;
  amount?: number | null;
}

const USD_TO_IDR_RATE = 15000;

const getChannelIcon = (channelName: string) => {
  const lowerCaseName = channelName.toLowerCase();
  if (lowerCaseName.includes("atm")) {
    return CreditCard;
  }
  if (lowerCaseName.includes("mobile") || lowerCaseName.includes("livin") || lowerCaseName.includes("brimo") || lowerCaseName.includes("digi") || lowerCaseName.includes("octo")) {
    return Smartphone;
  }
  if (lowerCaseName.includes("internet") || lowerCaseName.includes("net") || lowerCaseName.includes("clicks") || lowerCaseName.includes("klik")) {
    return Globe;
  }
  return CreditCard;
};

const PaymentInstructions: React.FC<PaymentInstructionsProps> = ({
  bankCode,
  virtualAccountNumber,
  amount,
}) => {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const instructionsSet: BankInstructionSet = useMemo(() => {
    const foundKey = Object.keys(bankInstructions).find(key =>
        key.toUpperCase() === bankCode?.toUpperCase() ||
        bankInstructions[key as keyof typeof bankInstructions] && bankCode?.toUpperCase() === key
    );
    return foundKey ? bankInstructions[foundKey as keyof typeof bankInstructions] : fallbackInstructions;
  }, [bankCode]);

  const channels = useMemo(() => Object.keys(instructionsSet), [instructionsSet]);

  useEffect(() => {
    if (channels.length > 0) {
      setOpenAccordion(channels[0]);
    } else {
      setOpenAccordion(null);
    }
  }, [channels]);

  const toggleAccordion = (channelName: string) => {
    setOpenAccordion(prev => (prev === channelName ? null : channelName));
  };

  const formatPrice = (value: number | null | undefined) => {
    if (value == null) return "";
     return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
     }).format(value * USD_TO_IDR_RATE);
  };


  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-1">
        Payment Guide
      </h2>

      {virtualAccountNumber && (
         <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
            <p className="text-sm text-muted">Virtual Account Number</p>
            <p className="text-xl font-semibold text-dark mt-1 break-all">
                {virtualAccountNumber}
            </p>
            {bankCode && (
                 <p className="text-sm text-muted mt-2">
                    Bank {bankCode.toUpperCase()}
                 </p>
            )}
            {amount != null && (
                 <p className="text-sm text-muted mt-1">
                    Amount: <span className="font-semibold text-dark">{formatPrice(amount)}</span>
                 </p>
            )}
         </div>
      )}

      {channels.length === 0 ? (
        <p className="text-sm text-muted">No specific instructions available.</p>
      ) : (
        channels.map((channelName) => {
          const isOpen = openAccordion === channelName;
          const steps = instructionsSet[channelName];
          const Icon = getChannelIcon(channelName);

          return (
            <div key={channelName} className="border-t border-slate-200 first:border-t-0">
              <button
                onClick={() => toggleAccordion(channelName)}
                className="flex justify-between items-center w-full py-4 text-left font-semibold text-gray-700 hover:text-[#C9A646] transition-colors"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                   <Icon size={18} className="text-[#C9A646]/80 flex-shrink-0" />
                   {channelName}
                </span>
                <ChevronDown
                  size={20}
                  className={cn(
                    "transition-transform duration-200 text-gray-400",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                      open: { opacity: 1, height: "auto", marginTop: 0 },
                      collapsed: { opacity: 0, height: 0, marginTop: 0 },
                    }}
                    transition={{ duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <ol className="list-decimal list-inside text-sm text-muted space-y-2 pl-4 pb-4">
                      {steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </div>
  );
};

export default PaymentInstructions;