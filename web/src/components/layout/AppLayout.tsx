import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
import { AppSidebar } from "./AppSidebar";

/** Shell do profissional: sidebar fixa no desktop, drawer no mobile (padrão Cockpit). */
export function AppLayout() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg">
      <AppSidebar className="hidden md:flex" />
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-64 border-r-0 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar className="w-full border-r-0" onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMenu(true)}
            className="-ml-2 flex size-10 items-center justify-center rounded-md text-ink-soft hover:bg-bg-subtle"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <BrandMark size={24} />
          <span className="text-body font-semibold">PreceptorFISIC</span>
        </header>
        <main id="conteudo" className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
