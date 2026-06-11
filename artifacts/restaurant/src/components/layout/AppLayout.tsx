import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, Receipt,
  Package, BookOpen, DollarSign, BarChart3, Calendar,
  Users, LogOut, Building2, FileText, ClipboardList, Menu, X
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Panel Principal", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/tables", label: "Mesas", icon: UtensilsCrossed, roles: ["ADMIN", "WAITER", "CASHIER"] },
  { href: "/kitchen", label: "Cocina", icon: ChefHat, roles: ["ADMIN", "WAITER"] },
  { href: "/pos", label: "Cobros", icon: Receipt, roles: ["ADMIN", "CASHIER"] },
  { label: "─ Inventario", separator: true, roles: ["ADMIN"] },
  { href: "/inventory", label: "Inventario", icon: Package, roles: ["ADMIN"] },
  { href: "/inventory-purchases", label: "Facturas de Compra", icon: FileText, roles: ["ADMIN"] },
  { href: "/recipes", label: "Recetas", icon: BookOpen, roles: ["ADMIN"] },
  { label: "─ Finanzas", separator: true, roles: ["ADMIN"] },
  { href: "/expenses", label: "Gastos", icon: DollarSign, roles: ["ADMIN", "CASHIER"] },
  { href: "/fixed-costs", label: "Gastos Fijos", icon: Building2, roles: ["ADMIN"] },
  { href: "/reports", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/daily-close", label: "Cierre del Día", icon: Calendar, roles: ["ADMIN"] },
  { label: "─ Admin", separator: true, roles: ["ADMIN"] },
  { href: "/orders-history", label: "Historial de Órdenes", icon: ClipboardList, roles: ["ADMIN"] },
  { href: "/users", label: "Usuarios", icon: Users, roles: ["ADMIN"] },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user?.role ?? "")
  );

  const NavLinks = () => (
    <>
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {visibleItems.map((item, i) => {
            if (item.separator) {
              return <div key={i} className="px-3 pt-3 pb-1 text-xs text-muted-foreground font-medium">{item.label}</div>;
            }
            const Icon = item.icon!;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href!}>
                <div
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="p-3 border-t">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── DESKTOP sidebar ── */}
      <aside className="hidden md:flex w-64 border-r bg-card flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">🌊 La Playita</h1>
          <p className="text-xs text-muted-foreground mt-1">{user?.name} — {user?.role}</p>
        </div>
        <NavLinks />
      </aside>

      {/* ── MOBILE overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* ── MOBILE drawer ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-50 bg-card border-r flex flex-col
        transition-transform duration-300 ease-in-out md:hidden
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🌊 La Playita</h1>
            <p className="text-xs text-muted-foreground mt-1">{user?.name} — {user?.role}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <NavLinks />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar solo en móvil */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-base">🌊 La Playita</span>
          <span className="text-xs text-muted-foreground">{user?.name}</span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-3 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
