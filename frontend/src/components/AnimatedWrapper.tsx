"use client";

import { motion, Variants } from "framer-motion";

interface Props {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  immediate?: boolean;
}

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

export default function AnimatedWrapper({
  children,
  className,
  variants = defaultVariants,
  delay = 0,
  immediate = false,
}: Props) {
  const motionProps = immediate
    ? { animate: "visible" as const }
    : { whileInView: "visible" as const, viewport: { once: true, amount: 0.3 } };

  return (
    <motion.div
      className={className}
      initial="hidden"
      {...motionProps}
      variants={{
        ...variants,
        visible: {
            ...variants.visible,
            transition: {
                ...variants.visible.transition,
                delay
            }
        }
      }}
    >
      {children}
    </motion.div>
  );
}
