import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, useListInventory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface PurchaseItem { inventoryItemId: number; quantity: string; unitCost: string; }
interface Purchase { id: number; supplier: string | null; purchaseDate: string; totalAmount: string; notes: string | null; createdAt: string; items: PurchaseItemDetail[]; }
interface PurchaseItemDetail { id: number; inventoryItemId: number; inventoryItemName: string; quantity: string; unit: string; unitCost: string; totalCost: string; }

export default function InventoryPurchases() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([{ inventoryItemId: 0, quantity: "", unitCost: "" }]);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ["inventory-purchases"],
    queryFn: () => customFetch("/api/inventory-purchases"),
  });

  const { data: inventory = [] } = useListInventory();

  const create = useMutation({
    mutationFn: (data: object) => customFetch("/api/inventory-purchases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Factura registrada e inventario actualizado");
      qc.invalidateQueries({ queryKey: ["inventory-purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory"] });
      setOpen(false);
      setSupplier(""); setNotes("");
      setItems([{ inventoryItemId: 0, quantity: "", unitCost: "" }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/inventory-purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Factura eliminada");
      qc.invalidateQueries({ queryKey: ["inventory-purchases"] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, { inventoryItemId: 0, quantity: "", unitCost: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof PurchaseItem, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: field === "inventoryItemId" ? Number(val) : val };
    setItems(next);
  };

  const total = items.reduce((s, it) => s + (Number(it.quantity) * Number(it.unitCost) || 0), 0);

  const handleSubmit = () => {
    const validItems = items.filter(it => it.inventoryItemId && Number(it.quantity) > 0 && Number(it.unitCost) > 0);
    if (validItems.length === 0) return toast.error("Agrega al menos un producto válido");
    create.mutate({ supplier, purchaseDate, notes, items: validItems });
  };

  if (isLoading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Facturas de Compra</h1>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nueva factura</Button>
      </div>

      {purchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-16 text-muted-foreground">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p>No hay facturas registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map(p => (
            <Card key={p.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setDetail(p)}>
                  <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
                  <div>
                    <div className="font-semibold">{p.supplier || "Sin proveedor"}</div>
                    <div className="text-sm text-muted-foreground">{p.purchaseDate} • {p.items?.length ?? 0} productos</div>
                    {p.notes && <div className="text-xs text-muted-foreground italic mt-1">{p.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">{formatCurrency(Number(p.totalAmount))}</div>
                    <div className="text-xs text-muted-foreground">total</div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Factura de {p.supplier || "Sin proveedor"} — {formatCurrency(Number(p.totalAmount))}. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => remove.mutate(p.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog nueva factura */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nueva Factura de Compra</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input placeholder="Nombre del proveedor" value={supplier} onChange={e => setSupplier(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de compra</Label>
                <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input placeholder="Observaciones..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Productos comprados</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
              </div>
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end bg-muted/30 p-3 rounded-lg">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Ingrediente</Label>
                        <Select value={String(item.inventoryItemId)} onValueChange={v => updateItem(i, "inventoryItemId", v)}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent className="max-h-48 overflow-y-auto">
                            {inventory.map(inv => (
                              <SelectItem key={inv.id} value={String(inv.id)}>{inv.name} ({inv.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Cantidad</Label>
                        <Input type="number" placeholder="0" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Costo unit.</Label>
                        <Input type="number" placeholder="0.00" value={item.unitCost} onChange={e => updateItem(i, "unitCost", e.target.value)} />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Subtotal</Label>
                        <div className="h-9 flex items-center font-medium text-sm">{formatCurrency(Number(item.quantity) * Number(item.unitCost) || 0)}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(i)} disabled={items.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="font-semibold">Total:</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={create.isPending}>
                {create.isPending ? "Registrando..." : "Registrar y actualizar inventario"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle factura */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalle — {detail?.supplier || "Sin proveedor"}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Fecha: {detail.purchaseDate}</div>
              {detail.notes && <div className="text-sm italic text-muted-foreground">{detail.notes}</div>}
              <div className="divide-y border rounded-lg overflow-hidden">
                {detail.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3">
                    <div>
                      <div className="font-medium">{item.inventoryItemName}</div>
                      <div className="text-sm text-muted-foreground">{item.quantity} {item.unit} × {formatCurrency(Number(item.unitCost))}</div>
                    </div>
                    <div className="font-bold">{formatCurrency(Number(item.totalCost))}</div>
                  </div>
                ))}
                <div className="flex justify-between p-3 bg-muted/30 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(Number(detail.totalAmount))}</span>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 border-destructive/30">
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar factura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => remove.mutate(detail.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
