import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTable, useListProducts, useListCategories,
  useCreateOrder, usePatchOrderItems, useUpdateTableStatus,
  customFetch, getGetTableQueryKey, Product, NewOrderItem
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Trash2, Send, CreditCard, DoorOpen, Ban, ShoppingCart, UtensilsCrossed, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

interface CartItem extends Product {
  cartId: string;
  cartQuantity: number;
  selectedPrice: number;
  variantName?: string;
}

interface ProductVariant {
  name: string;
  price: number;
}

export default function TableOrder() {
  const [, params] = useRoute("/tables/:id/order");
  const [, setLocation] = useLocation();
  const tableId = Number(params?.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: table } = useGetTable(tableId, { query: { enabled: !!tableId, queryKey: getGetTableQueryKey(tableId) } });
  const { data: products = [] } = useListProducts();
  const { data: categories = [] } = useListCategories();

  const createOrder = useCreateOrder();
  const patchOrder = usePatchOrderItems();
  const updateStatus = useUpdateTableStatus();

  const voidOrder = useMutation({
    mutationFn: (orderId: number) => customFetch(`/api/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Orden anulada"); queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const freeTable = useMutation({
    mutationFn: () => customFetch(`/api/tables/${tableId}/status`, { method: "PATCH", body: JSON.stringify({ status: "free" }) }),
    onSuccess: () => { toast.success("Mesa liberada"); setLocation("/tables"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [mobileTab, setMobileTab] = useState<"menu" | "order">("menu");
  const [variantModal, setVariantModal] = useState<Product | null>(null);

  const existingOrder = table?.order;
  const isPendingPayment = table?.status === "waiting_payment";

  const addToCart = (product: Product, price?: number, variantName?: string) => {
    if (isPendingPayment) return;
    const selectedPrice = price ?? Number(product.price);
    setCart(prev => [...prev, { ...product, cartId: Math.random().toString(), cartQuantity: 1, selectedPrice, variantName }]);
    setMobileTab("order");
    setVariantModal(null);
  };

  const handleProductClick = (product: Product) => {
    if (isPendingPayment) return;
    const variants = product.variants as ProductVariant[] | null;
    if (variants && variants.length > 0) {
      setVariantModal(product);
    } else {
      addToCart(product);
    }
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, cartQuantity: Math.max(1, item.cartQuantity + delta) } : item));
  };

  const removeFromCart = (cartId: string) => setCart(prev => prev.filter(item => item.cartId !== cartId));

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    const items: NewOrderItem[] = cart.map(item => ({ productId: item.id, quantity: item.cartQuantity, unitPrice: item.selectedPrice }));
    if (existingOrder) {
      patchOrder.mutate({ id: existingOrder.id, data: { add: items } }, {
        onSuccess: () => { toast.success("Enviado a cocina"); setCart([]); setMobileTab("order"); queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) }); }
      });
    } else {
      createOrder.mutate({ data: { tableId, items } }, {
        onSuccess: () => { toast.success("Orden enviada a cocina"); setCart([]); setMobileTab("order"); queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) }); }
      });
    }
  };

  const handleRequestPayment = () => {
    updateStatus.mutate({ id: tableId, data: { status: "waiting_payment" } }, {
      onSuccess: () => { toast.success("Mesa marcada para cobro"); queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) }); }
    });
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || p.categoryId.toString() === activeCategory;
    return matchSearch && matchCat && p.active;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.selectedPrice * item.cartQuantity), 0);
  const existingTotal = existingOrder?.total || 0;
  const totalItems = cart.reduce((s, i) => s + i.cartQuantity, 0);

  const statusLabel: Record<string, string> = {
    free: "Libre", occupied: "Ocupada", waiting_payment: "Esperando Pago", closed: "Cerrada",
  };

  if (!table) return <div className="p-8">Cargando...</div>;

  // ── Panel de productos ──
  const ProductsPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button variant={activeCategory === "all" ? "default" : "secondary"} size="sm" className="rounded-full shrink-0 text-xs h-7" onClick={() => setActiveCategory("all")}>Todos</Button>
          {categories.map(cat => (
            <Button key={cat.id} variant={activeCategory === cat.id.toString() ? "default" : "secondary"} size="sm" className="rounded-full shrink-0 text-xs h-7" onClick={() => setActiveCategory(cat.id.toString())}>{cat.name}</Button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {filteredProducts.map(product => (
            <Card key={product.id} className={`cursor-pointer hover:border-primary active:scale-95 transition-all ${isPendingPayment ? "opacity-50 pointer-events-none" : ""}`} onClick={() => handleProductClick(product)}>
              <div className="h-14 bg-muted/50 flex items-center justify-center rounded-t-lg">
                <span className="text-2xl font-bold text-muted-foreground">{product.name.charAt(0)}</span>
              </div>
              <CardContent className="p-2">
                <div className="font-medium text-xs leading-tight line-clamp-2">{product.name}</div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {(product as any).salePrice && (
                    <span className="bg-orange-500 text-white text-xs px-1 rounded font-bold">OFERTA</span>
                  )}
                  <span className="text-primary font-bold text-sm">{formatCurrency(Number(product.price))}</span>
                  {(product as any).salePrice && (
                    <span className="text-orange-400 font-bold text-sm">{formatCurrency(Number((product as any).salePrice))}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  // ── Panel de orden ──
  const OrderPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg">Mesa #{table.number}</h2>
            <p className="text-xs text-muted-foreground">{table.areaName} • {table.openedByName}</p>
          </div>
          <Badge>{statusLabel[table.status] ?? table.status}</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        {existingOrder?.items?.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orden enviada</span>
              {isAdmin && existingOrder.status !== "paid" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive h-6 text-xs px-2"><Ban className="w-3 h-3 mr-1" />Anular</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Anular esta orden?</AlertDialogTitle><AlertDialogDescription>Esta acción liberará la mesa.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => voidOrder.mutate(existingOrder.id)}>Anular</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="space-y-1 bg-muted/20 rounded-lg p-2">
              {existingOrder.items.map((item: { id: number; productName: string; quantity: number; unitPrice: number }) => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span>{item.quantity}× {item.productName}</span>
                  <span className="font-medium">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-1 flex justify-between font-semibold text-sm">
                <span>Subtotal</span><span>{formatCurrency(Number(existingTotal))}</span>
              </div>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nuevos items</span>
            <div className="space-y-2 mt-2">
              {cart.map(item => (
                <div key={item.cartId} className="bg-muted/30 rounded-lg p-2.5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm flex-1 mr-2">{item.name}{item.variantName ? ` (${item.variantName})` : ""}</span>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-destructive p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 rounded-full border flex items-center justify-center" onClick={() => updateQuantity(item.cartId, -1)}><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center font-bold text-sm">{item.cartQuantity}</span>
                      <button className="w-7 h-7 rounded-full border flex items-center justify-center" onClick={() => updateQuantity(item.cartId, 1)}><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="font-semibold text-sm">{formatCurrency(item.selectedPrice * item.cartQuantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!existingOrder && cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
            <p>Sin items. Selecciona del menú.</p>
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t space-y-2 bg-muted/5">
        {(Number(existingTotal) + cartTotal) > 0 && (
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(Number(existingTotal) + cartTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <Button className="w-full" onClick={handleSendToKitchen} disabled={createOrder.isPending || patchOrder.isPending}>
            <Send className="w-4 h-4 mr-2" />{createOrder.isPending || patchOrder.isPending ? "Enviando..." : "Enviar a Cocina"}
          </Button>
        )}
        {existingOrder && !isPendingPayment && cart.length === 0 && (
          <Button className="w-full" variant="secondary" onClick={handleRequestPayment}>
            <CreditCard className="w-4 h-4 mr-2" />Solicitar Pago
          </Button>
        )}
        {isPendingPayment && (
          <Button className="w-full" variant="outline" disabled><CreditCard className="w-4 h-4 mr-2" />Esperando cajero...</Button>
        )}
        {(isAdmin || !existingOrder) && !isPendingPayment && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full text-muted-foreground text-sm" size="sm">
                <DoorOpen className="w-4 h-4 mr-2" />Liberar mesa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Liberar mesa #{table.number}?</AlertDialogTitle>
                <AlertDialogDescription>{existingOrder ? "Anulará la orden activa y liberará la mesa." : "La mesa quedará libre."}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { existingOrder && isAdmin ? voidOrder.mutate(existingOrder.id, { onSuccess: () => setLocation("/tables") }) : freeTable.mutate(); }}>Liberar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP: dos paneles lado a lado ── */}
      <div className="hidden md:flex h-[calc(100vh-112px)] gap-4 overflow-hidden">
        <div className="flex-1 bg-card rounded-xl border shadow-sm overflow-hidden"><ProductsPanel /></div>
        <div className="w-[360px] bg-card rounded-xl border shadow-sm overflow-hidden"><OrderPanel /></div>
      </div>

      {/* ── Modal variantes (ej: Cubetazo) ── */}
      <Dialog open={!!variantModal} onOpenChange={(o) => !o && setVariantModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{variantModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Selecciona una opción:</p>
            {/* Precio normal */}
            <button
              className="w-full flex justify-between items-center p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => variantModal && addToCart(variantModal, Number(variantModal.price))}
            >
              <span className="font-medium">{variantModal?.name} — Precio normal</span>
              <span className="font-bold text-primary">{formatCurrency(Number(variantModal?.price ?? 0))}</span>
            </button>
            {/* Precio de oferta si existe */}
            {variantModal && (variantModal as any).salePrice && (
              <button
                className="w-full flex justify-between items-center p-4 rounded-lg border border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/5 transition-colors"
                onClick={() => variantModal && addToCart(variantModal, Number((variantModal as any).salePrice), "Oferta")}
              >
                <span className="font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-500" />
                  {variantModal?.name} — Oferta
                </span>
                <span className="font-bold text-orange-500">{formatCurrency(Number((variantModal as any).salePrice))}</span>
              </button>
            )}
            {/* Variantes personalizadas (ej: x5, x6) */}
            {variantModal && (variantModal as any).variants && ((variantModal as any).variants as ProductVariant[]).map((v: ProductVariant, i: number) => (
              <button
                key={i}
                className="w-full flex justify-between items-center p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => variantModal && addToCart(variantModal, v.price, v.name)}
              >
                <span className="font-medium">{variantModal?.name} — {v.name}</span>
                <span className="font-bold text-primary">{formatCurrency(v.price)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MÓVIL: tabs Menú / Orden ── */}
      <div className="flex flex-col h-[calc(100vh-112px)] md:hidden">
        {/* Tab switcher */}
        <div className="flex border-b bg-card shrink-0">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${mobileTab === "menu" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setMobileTab("menu")}
          >
            <UtensilsCrossed className="w-4 h-4" /> Menú
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${mobileTab === "order" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setMobileTab("order")}
          >
            <ShoppingCart className="w-4 h-4" /> Orden
            {totalItems > 0 && <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{totalItems}</span>}
          </button>
        </div>

        <div className="flex-1 bg-card overflow-hidden">
          {mobileTab === "menu" ? <ProductsPanel /> : <OrderPanel />}
        </div>
      </div>
    </>
  );
}
