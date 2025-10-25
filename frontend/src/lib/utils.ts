import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine multiple Tailwind classNames safely.
 * Example:
 * cn("p-4", condition && "bg-primary")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
