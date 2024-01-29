import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";
import { createTwc } from "react-twc";
import type { ClassValue } from "clsx";

// Using `clsx` + `twMerge` for a complete flexibility (taken from shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// We named it `twx` to have better autocompletion
export const twx = createTwc({ compose: cn });
