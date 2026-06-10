import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTable, 
  useListProducts, 
  useListCategories,
  useCreateOrder,
  usePatchOrderItems,
  useUpdateTableStatus,
  customFetch,
  getGetTableQueryKey,
  Product,
  NewOrderItem
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Trash2, Send, CreditCard, DoorOpen, Ban } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

interface CartItem extends Product {
  cartId: string;
  cartQuantity: number;
  notes: string;
}

export default function TableOrder() {
  const [, params] = useRoute("/tables/:id/order");
  const [, setLocation] = useLocation();
  const tableId = Number(params?.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: table } = useGetTable(tableId, { 
    query: { enabled: !!tableId, queryKey: getGetTableQueryKey(tableId) } 
  });
  const { data: products = [] } = useListProducts();
  const { data: categories = [] } = useListCategories();

  const createOrder = useCreateOrder();
  const patchOrder = usePatchOrderItems();
  const updateStatus = useUpdateTableStatus();

  const voidOrder = useMutation({
    mutationFn: (orderId: number) => customFetch(`/api/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Orden anulada");
      queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const freeTable = useMutation({
    mutationFn: () => customFetch(`/api/tables/${tableId}/status`, { 
      method: "PATCH", 
      body: JSON.stringify({ status: "free" }) 
    }),
    onSuccess: () => {
      toast.success("Mesa liberada");
      setLocation("/tables");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const existingOrder = table?.order;
  const isPendingPayment = table?.status === "waiting_payment";

  const addToCart = (product: Product) => {
    if (isPendingPayment) return;
    setCart(prev => [...prev, { ...product, cartId: Math.random().toString(), cartQuantity: 1, notes: "" }]);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQ = Math.max(1, item.cartQuantity + delta);
        return { ...item, cartQuantity: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    const items: NewOrderItem[] = cart.map(item => ({
      productId: item.id,
      quantity: item.cartQuantity,
      notes: item.notes || undefined
    }));

    if (existingOrder) {
      patchOrder.mutate({ id: existingOrder.id, data: { add: items } }, {
        onSuccess: () => {
          toast.success("Productos enviados a cocina");
          setCart([]);
          queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) });
        }
      });
    } else {
      createOrder.mutate({ data: { tableId, items } }, {
        onSuccess: () => {
          toast.success("Orden enviada a cocina");
          setCart([]);
          queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) });
        }
      });
    }
  };

  const handleRequestPayment = () => {
    updateStatus.mutate({ id: tableId, data: { status: "waiting_payment" } }, {
      onSuccess: () => {
        toast.success("Mesa marcada para cobro");
        queryClient.invalidateQueries({ queryKey: getGetTableQueryKey(tableId) });
      }
    });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "all" || p.categoryId.toString() === activeCategory;
    return matchesSearch && matchesCat && p.active;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.cartQuantity), 0);
  const existingTotal = existingOrder?.total || 0;

  const statusLabel: Record<string, string> = {
    free: "Libre",
    occupied: "Ocupada",
    waiting_payment: "Esperando Pago",
    closed: "Cerrada",
  };

  const statusColor: Record<string, string> = {
    free: "secondary",
    occupied: "destructive",
    waiting_payment: "warning",
    closed: "secondary",
  };

  if (!table) return <div className="p-8">Cargando...</div>;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4 overflow-hidden">
      {/* Panel izquierdo - Productos */}
      <div className="flex-1 flex flex-col min-w-0 bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="w-full whitespace-nowrap pb-1">
            <div className="flex space-x-2">
              <Button 
                variant={activeCategory === "all" ? "default" : "secondary"}
                onClick={() => setActiveCategory("all")}
                size="sm" className="rounded-full"
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button 
                  key={cat.id}
                  variant={activeCategory === cat.id.toString() ? "default" : "secondary"}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  size="sm" className="rounded-full"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-12">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className={`cursor-pointer hover:border-primary transition-colors overflow-hidden group ${isPendingPayment ? "opacity-50 pointer-events-none" : ""}`}
                onClick={() => addToCart(product)}
              >
                <div className="h-20 w-full bg-muted/50 flex items-center justify-center">
                  <span className="text-muted-foreground font-bold text-2xl">{product.name.charAt(0)}</span>
                </div>
                <CardContent className="p-3">
                  <div className="font-semibold text-sm truncate">{product.name}</div>
                  <div className="text-primary font-bold text-sm mt-1">{formatCurrency(Number(product.price))}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Panel derecho - Orden */}
      <div className="w-[380px] flex flex-col bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Mesa #{table.number}</h2>
              <p className="text-sm text-muted-foreground">{table.areaName} • {table.openedByName}</p>
            </div>
            <Badge variant={statusColor[table.status] as "default" | "secondary" | "destructive" | "outline"}>
              {statusLabel[table.status] ?? table.status}
            </Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {/* Orden existente */}
          {existingOrder && existingOrder.items && existingOrder.items.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Orden enviada</h3>
                {isAdmin && existingOrder.status !== "paid" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-7 text-xs">
                        <Ban className="w-3 h-3 mr-1" /> Anular
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Anular esta orden?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción liberará la mesa y no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                          onClick={() => voidOrder.mutate(existingOrder.id)}>
                          Anular orden
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <div className="space-y-1">
                {existingOrder.items.map((item: { id: number; productName: string; quantity: number; unitPrice: number }) => (
                  <div key={item.id} className="flex justify-between items-center py-1 text-sm">
                    <span>{item.quantity}× {item.productName}</span>
                    <span className="font-medium">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(existingTotal))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Carrito nuevo */}
          {cart.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Nuevos items</h3>
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.cartId} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm flex-1 mr-2">{item.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.cartId)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.cartId, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-bold">{item.cartQuantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.cartId, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(Number(item.price) * item.cartQuantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!existingOrder && cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <p>No hay items en la orden.</p>
              <p className="text-xs mt-1">Selecciona productos del menú.</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t space-y-2 bg-muted/10">
          {cart.length > 0 && (
            <div className="flex justify-between items-center font-bold mb-2">
              <span>Total nuevos items</span>
              <span className="text-primary">{formatCurrency(cartTotal)}</span>
            </div>
          )}
          
          {(existingTotal > 0 || cartTotal > 0) && (
            <div className="flex justify-between items-center font-bold text-lg mb-2">
              <span>Total mesa</span>
              <span className="text-primary">{formatCurrency(Number(existingTotal) + cartTotal)}</span>
            </div>
          )}

          {cart.length > 0 && (
            <Button className="w-full" onClick={handleSendToKitchen} disabled={createOrder.isPending || patchOrder.isPending}>
              <Send className="w-4 h-4 mr-2" />
              {createOrder.isPending || patchOrder.isPending ? "Enviando..." : "Enviar a Cocina"}
            </Button>
          )}

          {existingOrder && !isPendingPayment && cart.length === 0 && (
            <Button className="w-full" variant="secondary" onClick={handleRequestPayment}>
              <CreditCard className="w-4 h-4 mr-2" />
              Solicitar Pago
            </Button>
          )}

          {isPendingPayment && (
            <Button className="w-full" variant="outline" disabled>
              <CreditCard className="w-4 h-4 mr-2" />
              Esperando al cajero...
            </Button>
          )}

          {/* Liberar mesa sin orden (solo admin o si no hay orden) */}
          {(isAdmin || !existingOrder) && !isPendingPayment && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-muted-foreground hover:text-destructive" size="sm">
                  <DoorOpen className="w-4 h-4 mr-2" />
                  Liberar mesa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Liberar la mesa #{table.number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {existingOrder ? "Esto anulará la orden activa y liberará la mesa." : "La mesa quedará libre para nuevos clientes."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    if (existingOrder && isAdmin) {
                      voidOrder.mutate(existingOrder.id, {
                        onSuccess: () => setLocation("/tables")
                      });
                    } else {
                      freeTable.mutate();
                    }
                  }}>
                    Liberar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
