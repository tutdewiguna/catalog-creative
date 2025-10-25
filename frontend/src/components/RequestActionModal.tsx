"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import Button from "./Button";
import Portal from "./Portal";

interface RequestActionModalProps {
  actionType: "cancel" | "refund";
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}

export default function RequestActionModal({ actionType, onClose, onSubmit, loading }: RequestActionModalProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = (e.currentTarget.elements.namedItem("reason") as HTMLTextAreaElement).value;
    onSubmit(reason);
  };

  const title = actionType === 'cancel' ? 'Cancel Order' : 'Request Refund';
  const description = actionType === 'cancel'
    ? 'Please provide a reason for cancelling this order.'
    : 'Please provide a reason for your refund request. The admin will review it shortly.';

  return (
    <Portal>
        <div className="fixed inset-0 bg-dark/70 z-[60] flex items-center justify-center p-4">
        <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        >
            <div className="flex justify-between items-center p-5 border-b border-accent/10">
            <h2 className="text-xl font-bold font-display text-dark">{title}</h2>
            <button onClick={onClose} className="p-2 rounded-full text-muted hover:bg-light hover:text-dark">
                <X size={22} />
            </button>
            </div>
            <form onSubmit={handleSubmit}>
            <div className="p-6">
                <p className="text-sm text-muted mb-4">{description}</p>
                <textarea
                name="reason"
                rows={4}
                required
                className="form-input w-full"
                placeholder="Your reason here..."
                />
            </div>
            <div className="p-4 bg-light flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit'}
                </Button>
            </div>
            </form>
        </motion.div>
        </div>
    </Portal>
  );
}
