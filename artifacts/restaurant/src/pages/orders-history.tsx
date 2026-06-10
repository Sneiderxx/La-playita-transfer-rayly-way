import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Eye, ClipboardList } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface OrderItem { id: number; productName: string; quantity: number; unitPrice: number; }
interface Order { id: number; tableNumber: number; areaName: string; waiterName: string; status: string; total: number; createdAt: string; items: OrderItem[]; }

const STATUS_LABELS: Record<string, string> = { open: "Abierta", sent: "En cocina", paid: "Pagada", void: "Anulada" };
const STATUS_COLORS: Record<string, string> = { open: "secondary", sent: "default", paid: "outline", void: "destructive" };

export default function OrdersHistory() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders-history", statusFilter],
    queryFn: () => customFetch(`/api/orders/history/all?limit=200${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`),
  });

  const voidOrder = useMutation({
    mutationFn: (id: number) => customFetch(`/api/orders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Orden eliminada permanentemente");
      qc.invalidateQueries({ queryKey: ["orders-history"] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (isLoading) return <div className="p-8">Cargando órdenes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Historial de Órdenes</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-sm">
            {Object.entries(statusCounts).map(([s, count]) => (
              <span key={s} className="text-muted-foreground">{STATUS_LABELS[s] ?? s}: <strong>{count}</strong></span>
            ))}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="open">Abiertas</SelectItem>
              <SelectItem value="sent">En cocina</SelectItem>
              <SelectItem value="paid">Pagadas</SelectItem>
              <SelectItem value="void">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-16 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
            <p>No hay órdenes registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 border-b">
            <span>#</span><span>Mesa</span><span>Mesero</span><span>Estado</span><span>Total</span><span>Acciones</span>
          </div>
          <ScrollArea className="max-h-[600px]">
            {orders.map(order => (
              <div key={order.id} className="grid grid-cols-6 items-center px-4 py-3 border-b hover:bg-muted/20 transition-colors">
                <span className="text-sm font-mono text-muted-foreground">#{order.id}</span>
                <div>
                  <div className="font-medium text-sm">Mesa #{order.tableNumber}</div>
                  <div className="text-xs text-muted-foreground">{order.areaName}</div>
                </div>
                <span className="text-sm">{order.waiterName}</span>
                <Badge variant={STATUS_COLORS[order.status] as "default" | "secondary" | "destructive" | "outline"}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </Badge>
                <div>
                  <div className="font-semibold text-sm">{formatCurrency(order.total)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.createdAt), { locale: es, addSuffix: true })}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(order)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {order.status !== "void" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar orden #{order.id}?</AlertDialogTitle>
                          <AlertDialogDescription>Mesa #{order.tableNumber} — {formatCurrency(order.total)}. Se eliminará de historial, reportes y cierre del día. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => voidOrder.mutate(order.id)}>
                            Anular
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Orden #{detail?.id} — Mesa #{detail?.tableNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Mesero: {detail.waiterName}</span>
                <Badge variant={STATUS_COLORS[detail.status] as "default" | "secondary" | "destructive" | "outline"}>
                  {STATUS_LABELS[detail.status]}
                </Badge>
              </div>
              <div className="divide-y border rounded-lg overflow-hidden">
                {detail.items?.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3">
                    <div>
                      <div className="font-medium text-sm">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice)}</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</div>
                  </div>
                ))}
                <div className="flex justify-between p-3 bg-muted/30 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(detail.total)}</span>
                </div>
              </div>
              {detail.status !== "void" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar permanentemente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar orden #{detail.id}?</AlertDialogTitle>
                      <AlertDialogDescription>Se eliminará de historial, reportes y cierre del día. Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => voidOrder.mutate(detail.id)}>
                        Anular
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
