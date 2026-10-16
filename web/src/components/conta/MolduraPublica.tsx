import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";

/** Moldura das telas de conta fora do shell (onboarding, recuperar, redefinir). */
export function MolduraPublica({ children, largo }: { children: ReactNode; largo?: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <main className={cn("w-full rounded-lg border border-line bg-bg-elevated p-6 shadow-card sm:p-8", largo ? "max-w-xl" : "max-w-md")}>
        <div className="mb-7 flex items-center gap-3">
          <BrandMark size={28} />
          <span className="text-body-lg font-semibold">PreceptorFISIC</span>
        </div>
        {children}
      </main>
    </div>
  );
}
