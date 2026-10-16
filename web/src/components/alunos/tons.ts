import type { StatusTone } from "@/components/ui/status-chip";

/** Tom semântico → classe de texto (só tokens). */
export const TOM_TEXTO: Record<StatusTone, string> = {
  neutral: "text-ink",
  brand: "text-brand",
  warning: "text-warning",
  positive: "text-positive",
  negative: "text-negative",
  info: "text-info",
};
