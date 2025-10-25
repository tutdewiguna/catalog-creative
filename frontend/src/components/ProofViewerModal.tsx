"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X } from "lucide-react";

interface ProofViewerModalProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ProofViewerModal({ imageUrl, onClose }: ProofViewerModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-dark/80 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl"
        >
          <Image
            src={imageUrl}
            alt="Proof of Payment"
            width={800}
            height={800}
            className="rounded-lg object-contain w-full h-auto max-h-[80vh]"
          />
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 bg-white rounded-full p-2 text-dark hover:bg-light"
          >
            <X size={24} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
