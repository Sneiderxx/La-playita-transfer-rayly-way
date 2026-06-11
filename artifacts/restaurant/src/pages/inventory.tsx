import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInventory, getListInventoryQueryKey, useAdjustInventory,
  useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
  InventoryItem, CreateInventoryRequestUnit,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, ArrowUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const UNIT_OPTIONS: Array<{ value: CreateInventoryRequestUnit; label: string }> = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "l", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "unit", label: "Unidades" },
  { value: "lb" as CreateInventoryRequestUnit, label: "Libras (lb)" },
];

type UsageRow = { recipeId: number; productId: number; productName: string };

export default function Inventory() {
  const queryClient = useQueryClient();
  const { data: inventory = [], isLoading } = useListInventory({ query: { queryKey: getListInventoryQueryKey() } });
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const adjustItem = useAdjustInventory();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });

  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<InventoryItem | null>(null);
  const [editOpen, setEditOpen] = useState<InventoryItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<InventoryItem | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<UsageRow[]>([]);

  const [newName, setNewName] = useState(""); const [newUnit, setNewUnit] = useState<CreateInventoryRequestUnit>("g");
  const [newQty, setNewQty] = useState("0"); const [newMin, setNewMin] = useState("0");
  const [newCost, setNewCost] = useState("0"); const [newSupplier, setNewSupplier] = useState("");

  const [eName, setEName] = useState(""); const [eUnit, setEUnit] = useState<CreateInventoryRequestUnit>("g");
  const [eQty, setEQty] = useState("0"); const [eMin, setEMin] = useState("0");
  const [eCost, setECost] = useState("0"); const [eSupplier, setESupplier] = useState("");

  const [adjustChange, setAdjustChange] = useState(""); const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => {
    if (editOpen) { setEName(editOpen.name); setEUnit(editOpen.unit as CreateInventoryRequestUnit);
      setEQty(String(editOpen.currentQuantity)); setEMin(String(editOpen.minimumStock));
      setECost(String(editOpen.cost)); setESupplier(editOpen.supplier ?? ""); }
  }, [editOpen]);

  useEffect(() => { if (!deleteOpen) setDeleteUsage([]); }, [deleteOpen]);

  const resetCreate = () => { setNewName(""); setNewUnit("g"); setNewQty("0"); setNewMin("0"); setNewCost("0"); setNewSupplier(""); };

  const handleCreate = () => {
    if (!newName.trim()) { toast.error("Nombre requerido"); return; }
    createItem.mutate({ data: { name: newName.trim(), unit: newUnit, currentQuantity: Number(newQty)||0, minimumStock: Number(newMin)||0, cost: Number(newCost)||0, supplier: newSupplier.trim()||null } },
      { onSuccess: () => { toast.success("Item creado"); setCreateOpen(false); resetCreate(); invalidate(); },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Error al crear") });
  };

  const handleEditSave = () => {
    if (!editOpen) return;
    if (!eName.trim()) { toast.error("Nombre requerido"); return; }
    updateItem.mutate({ id: editOpen.id, data: { name: eName.trim(), unit: eUnit, currentQuantity: Number(eQty)||0, minimumStock: Number(eMin)||0, cost: Number(eCost)||0, supplier: eSupplier.trim()||null } },
      { onSuccess: () => { toast.success(`"${eName}" actualizado`); setEditOpen(null); invalidate(); },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Error al actualizar") });
  };

  const performDelete = (force: boolean) => {
    if (!deleteOpen) return;
    deleteItem.mutate({ id: deleteOpen.id, params: force ? { force: true } : undefined },
      { onSuccess: () => { toast.success(`"${deleteOpen.name}" eliminado`); setDeleteOpen(null); setDeleteUsage([]); invalidate(); },
        onError: async (err: unknown) => {
          const anyErr = err as { data?: { error?: string; usedIn?: UsageRow[] }; message?: string };
          const data = anyErr?.data ?? (typeof anyErr?.message === "string" ? safeJson(anyErr.message) : undefined);
          if (data?.usedIn?.length) { setDeleteUsage(data.usedIn); toast.warning(`Usado en ${data.usedIn.length} receta(s).`); }
          else toast.error(data?.error ?? (err instanceof Error ? err.message : "Error al eliminar"));
        }});
  };

  const handleAdjust = () => {
    if (!adjustOpen) return;
    const change = Number(adjustChange);
    if (!change || Number.isNaN(change)) { toast.error("El cambio debe ser un número distinto de cero"); return; }
    adjustItem.mutate({ id: adjustOpen.id, data: { change, reason: adjustReason || "ajuste manual" } },
      { onSuccess: () => { toast.success("Stock ajustado"); setAdjustOpen(null); setAdjustChange(""); setAdjustReason(""); invalidate(); } });
  };

  if (isLoading) return <div className="p-8">Cargando inventario...</div>;
  const lowStockCount = inventory.filter(i => i.currentQuantity <= i.minimumStock).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          {lowStockCount > 0 && <Badge variant="destructive" className="flex gap-1 items-center"><AlertTriangle className="w-3 h-3" />{lowStockCount} Stock Bajo</Badge>}
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Nuevo Item</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nombre</TableHead><TableHead>Stock</TableHead><TableHead>Unidad</TableHead>
            <TableHead>Mínimo</TableHead><TableHead>Costo</TableHead><TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {inventory.map(item => {
              const isLow = item.currentQuantity <= item.minimumStock;
              return (
                <TableRow key={item.id} className={isLow ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2">{isLow && <AlertTriangle className="w-4 h-4 text-destructive" />}{item.name}</div></TableCell>
                  <TableCell className={isLow ? "text-destructive font-bold" : ""}>{item.currentQuantity}</TableCell>
                  <TableCell className="capitalize">{item.unit}</TableCell>
                  <TableCell>{item.minimumStock}</TableCell>
                  <TableCell>{formatCurrency(item.cost)}</TableCell>
                  <TableCell className="text-muted-foreground">{item.supplier ?? "—"}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => setAdjustOpen(item)}><ArrowUpDown className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteOpen(item)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div></TableCell>
                </TableRow>
              );
            })}
            {inventory.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay items en el inventario.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreate(); }}>
        <DialogContent><DialogHeader><DialogTitle>Nuevo Item</DialogTitle><DialogDescription>Agrega un ingrediente o insumo.</DialogDescription></DialogHeader>
          <ItemFormFields name={newName} setName={setNewName} unit={newUnit} setUnit={setNewUnit} qty={newQty} setQty={setNewQty} min={newMin} setMin={setNewMin} cost={newCost} setCost={setNewCost} supplier={newSupplier} setSupplier={setNewSupplier} />
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={!newName.trim()||createItem.isPending}>{createItem.isPending?"Creando...":"Crear"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent><DialogHeader><DialogTitle>Editar Item</DialogTitle><DialogDescription>Todos los cambios quedan registrados.</DialogDescription></DialogHeader>
          <ItemFormFields name={eName} setName={setEName} unit={eUnit} setUnit={setEUnit} qty={eQty} setQty={setEQty} min={eMin} setMin={setEMin} cost={eCost} setCost={setECost} supplier={eSupplier} setSupplier={setESupplier} />
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(null)}>Cancelar</Button><Button onClick={handleEditSave} disabled={!eName.trim()||updateItem.isPending}>{updateItem.isPending?"Guardando...":"Guardar Cambios"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteOpen} onOpenChange={(o) => { if (!o) { setDeleteOpen(null); setDeleteUsage([]); } }}>
        <DialogContent><DialogHeader><DialogTitle>¿Eliminar item?</DialogTitle>
          <DialogDescription>{deleteUsage.length === 0 ? <>Eliminará <span className="font-semibold text-foreground">{deleteOpen?.name}</span> permanentemente.</> : <><span className="font-semibold text-foreground">{deleteOpen?.name}</span> se usa en {deleteUsage.length} receta(s).</>}</DialogDescription>
        </DialogHeader>
        {deleteUsage.length > 0 && <div className="rounded-md border bg-muted/50 p-3 max-h-48 overflow-auto"><ul className="text-sm space-y-1">{deleteUsage.map(u => <li key={u.recipeId} className="text-muted-foreground">• {u.productName}</li>)}</ul></div>}
        <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(null)}>Cancelar</Button><Button variant="destructive" onClick={() => performDelete(deleteUsage.length > 0)} disabled={deleteItem.isPending}>{deleteItem.isPending?"Eliminando...":deleteUsage.length>0?"Eliminar y quitar de recetas":"Eliminar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent><DialogHeader><DialogTitle>Ajustar Stock: {adjustOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-md flex justify-between items-center"><span className="text-muted-foreground">Stock actual:</span><span className="font-bold text-lg">{adjustOpen?.currentQuantity} {adjustOpen?.unit}</span></div>
            <div className="space-y-2"><Label>Cambio (+/-)</Label><Input type="number" placeholder="-5 o +100" value={adjustChange} onChange={e => setAdjustChange(e.target.value)} /><p className="text-xs text-muted-foreground">Nuevo total: <strong>{(adjustOpen?.currentQuantity||0)+Number(adjustChange||0)} {adjustOpen?.unit}</strong></p></div>
            <div className="space-y-2"><Label>Motivo</Label><Input placeholder="ej: Reposición, Merma" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdjustOpen(null)}>Cancelar</Button><Button onClick={handleAdjust} disabled={!adjustChange||adjustItem.isPending}>Confirmar Ajuste</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function safeJson(s: string): { error?: string; usedIn?: UsageRow[] } | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}

function ItemFormFields(props: {
  name: string; setName: (v: string) => void; unit: CreateInventoryRequestUnit; setUnit: (v: CreateInventoryRequestUnit) => void;
  qty: string; setQty: (v: string) => void; min: string; setMin: (v: string) => void;
  cost: string; setCost: (v: string) => void; supplier: string; setSupplier: (v: string) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2"><Label>Nombre</Label><Input value={props.name} onChange={e => props.setName(e.target.value)} placeholder="ej: Camarón, Papas fritas" /></div>
      <div className="space-y-2"><Label>Unidad de medida</Label>
        <Select value={props.unit} onValueChange={v => props.setUnit(v as CreateInventoryRequestUnit)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Cantidad actual ({props.unit})</Label><Input type="number" value={props.qty} onChange={e => props.setQty(e.target.value)} /></div>
        <div className="space-y-2"><Label>Stock mínimo ({props.unit})</Label><Input type="number" value={props.min} onChange={e => props.setMin(e.target.value)} /></div>
        <div className="space-y-2"><Label>Costo por unidad (Q)</Label><Input type="number" value={props.cost} onChange={e => props.setCost(e.target.value)} /></div>
        <div className="space-y-2"><Label>Proveedor</Label><Input value={props.supplier} onChange={e => props.setSupplier(e.target.value)} placeholder="Opcional" /></div>
      </div>
    </div>
  );
}
