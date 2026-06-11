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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user?.role ?? "")
  );

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">🌊 La Playita</h1>
          <p className="text-xs text-muted-foreground mt-1">{user?.name} — {user?.role}</p>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {visibleItems.map((item, i) => {
            if (item.separator) {
              return <div key={i} className="px-3 py-2 text-xs text-muted-foreground font-medium mt-2">{item.label}</div>;
            }
            const Icon = item.icon!;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href!}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setSidebarOpen(false)}
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

      {/* Sidebar desktop — siempre visible en md+ */}
      <div className="hidden md:flex w-64 border-r bg-card flex-col h-screen">
        <SidebarContent />
      </div>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar móvil — drawer lateral */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r flex flex-col h-screen transform transition-transform duration-300 md:hidden ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <SidebarContent />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar móvil */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">🌊 La Playita</span>
          <span className="text-xs text-muted-foreground">{user?.name}</span>
        </div>

        {/* Página */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
