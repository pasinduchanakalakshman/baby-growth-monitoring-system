import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Keep caller className overrides working with our CSS-defined Tailwind tokens.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      font: ["heading"],
      text: ["heading", "display"],
      spacing: ["control", "control-sm", "control-lg", "card", "page", "form"],
      shadow: ["card", "control", "auth"],
      container: ["content", "auth"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
