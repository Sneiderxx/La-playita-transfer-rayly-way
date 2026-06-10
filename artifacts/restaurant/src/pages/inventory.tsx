import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInventory,
  getListInventoryQueryKey,
  useAdjustInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  InventoryItem,
  CreateInventoryRequestUnit,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  AlertTriangle,
  ArrowUpDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const UNIT_OPTIONS: Array<{ value: CreateInventoryRequestUnit; label: string }> = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "l", label: "Liters (L)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "unit", label: "Units" },
];

type UsageRow = { recipeId: number; productId: number; productName: string };

export default function Inventory() {
  const queryClient = useQueryClient();
  const { data: inventory = [], isLoading } = useListInventory({
    query: { queryKey: getListInventoryQueryKey() },
  });

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const adjustItem = useAdjustInventory();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });

  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<InventoryItem | null>(null);
  const [editOpen, setEditOpen] = useState<InventoryItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<InventoryItem | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<UsageRow[]>([]);

  // Create form
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<CreateInventoryRequestUnit>("kg");
  const [newQty, setNewQty] = useState("0");
  const [newMin, setNewMin] = useState("0");
  const [newCost, setNewCost] = useState("0");
  const [newSupplier, setNewSupplier] = useState("");

  // Edit form
  const [eName, setEName] = useState("");
  const [eUnit, setEUnit] = useState<CreateInventoryRequestUnit>("kg");
  const [eQty, setEQty] = useState("0");
  const [eMin, setEMin] = useState("0");
  const [eCost, setECost] = useState("0");
  const [eSupplier, setESupplier] = useState("");

  // Adjust form
  const [adjustChange, setAdjustChange] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => {
    if (editOpen) {
      setEName(editOpen.name);
      setEUnit(editOpen.unit as CreateInventoryRequestUnit);
      setEQty(String(editOpen.currentQuantity));
      setEMin(String(editOpen.minimumStock));
      setECost(String(editOpen.cost));
      setESupplier(editOpen.supplier ?? "");
    }
  }, [editOpen]);

  useEffect(() => {
    if (!deleteOpen) setDeleteUsage([]);
  }, [deleteOpen]);

  const resetCreate = () => {
    setNewName("");
    setNewUnit("kg");
    setNewQty("0");
    setNewMin("0");
    setNewCost("0");
    setNewSupplier("");
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    createItem.mutate(
      {
        data: {
          name: newName.trim(),
          unit: newUnit,
          currentQuantity: Number(newQty) || 0,
          minimumStock: Number(newMin) || 0,
          cost: Number(newCost) || 0,
          supplier: newSupplier.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Inventory item created");
          setCreateOpen(false);
          resetCreate();
          invalidate();
        },
        onError: (err: unknown) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to create item",
          );
        },
      },
    );
  };

  const handleEditSave = () => {
    if (!editOpen) return;
    if (!eName.trim()) {
      toast.error("Name is required");
      return;
    }
    updateItem.mutate(
      {
        id: editOpen.id,
        data: {
          name: eName.trim(),
          unit: eUnit,
          currentQuantity: Number(eQty) || 0,
          minimumStock: Number(eMin) || 0,
          cost: Number(eCost) || 0,
          supplier: eSupplier.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(`"${eName}" updated`);
          setEditOpen(null);
          invalidate();
        },
        onError: (err: unknown) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to update item",
          );
        },
      },
    );
  };

  const performDelete = (force: boolean) => {
    if (!deleteOpen) return;
    deleteItem.mutate(
      { id: deleteOpen.id, params: force ? { force: true } : undefined },
      {
        onSuccess: () => {
          toast.success(`"${deleteOpen.name}" deleted`);
          setDeleteOpen(null);
          setDeleteUsage([]);
          invalidate();
        },
        onError: async (err: unknown) => {
          // Orval throws on non-2xx with the parsed body in `.message` for
          // generic fetch clients; try to surface the usage list when the
          // server responds 409 with `usedIn`.
          const anyErr = err as {
            response?: Response;
            data?: { error?: string; usedIn?: UsageRow[] };
            message?: string;
          };
          const data =
            anyErr?.data ??
            (typeof anyErr?.message === "string"
              ? safeJson(anyErr.message)
              : undefined);
          if (data?.usedIn?.length) {
            setDeleteUsage(data.usedIn);
            toast.warning(
              `Used in ${data.usedIn.length} recipe(s). Confirm to remove from recipes too.`,
            );
          } else {
            toast.error(
              data?.error ??
                (err instanceof Error ? err.message : "Failed to delete"),
            );
          }
        },
      },
    );
  };

  const handleAdjust = () => {
    if (!adjustOpen) return;
    const change = Number(adjustChange);
    if (!change || Number.isNaN(change)) {
      toast.error("Change must be a non-zero number");
      return;
    }
    adjustItem.mutate(
      {
        id: adjustOpen.id,
        data: { change, reason: adjustReason || "manual adjustment" },
      },
      {
        onSuccess: () => {
          toast.success("Inventory adjusted");
          setAdjustOpen(null);
          setAdjustChange("");
          setAdjustReason("");
          invalidate();
        },
      },
    );
  };

  if (isLoading) return <div>Loading...</div>;

  const lowStockCount = inventory.filter(
    (i) => i.currentQuantity <= i.minimumStock,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          {lowStockCount > 0 && (
            <Badge variant="destructive" className="flex gap-1 items-center">
              <AlertTriangle className="w-3 h-3" />
              {lowStockCount} Low Stock
            </Badge>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Item
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Min Stock</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((item) => {
                const isLow = item.currentQuantity <= item.minimumStock;
                return (
                  <TableRow
                    key={item.id}
                    className={isLow ? "bg-destructive/5" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isLow && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell
                      className={isLow ? "text-destructive font-bold" : ""}
                    >
                      {item.currentQuantity}
                    </TableCell>
                    <TableCell className="capitalize">{item.unit}</TableCell>
                    <TableCell>{item.minimumStock}</TableCell>
                    <TableCell>{formatCurrency(item.cost)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.supplier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAdjustOpen(item)}
                          title="Adjust stock"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditOpen(item)}
                          title="Edit item"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteOpen(item)}
                          title="Delete item"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {inventory.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No inventory items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreate();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new ingredient or supply item.
            </DialogDescription>
          </DialogHeader>
          <ItemFormFields
            name={newName}
            setName={setNewName}
            unit={newUnit}
            setUnit={setNewUnit}
            qty={newQty}
            setQty={setNewQty}
            min={newMin}
            setMin={setNewMin}
            cost={newCost}
            setCost={setNewCost}
            supplier={newSupplier}
            setSupplier={setNewSupplier}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createItem.isPending}
            >
              {createItem.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Change any field. All updates are logged.
            </DialogDescription>
          </DialogHeader>
          <ItemFormFields
            name={eName}
            setName={setEName}
            unit={eUnit}
            setUnit={setEUnit}
            qty={eQty}
            setQty={setEQty}
            min={eMin}
            setMin={setEMin}
            cost={eCost}
            setCost={setECost}
            supplier={eSupplier}
            setSupplier={setESupplier}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!eName.trim() || updateItem.isPending}
            >
              {updateItem.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={!!deleteOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteOpen(null);
            setDeleteUsage([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete inventory item?</DialogTitle>
            <DialogDescription>
              {deleteUsage.length === 0 ? (
                <>
                  This will permanently remove{" "}
                  <span className="font-semibold text-foreground">
                    {deleteOpen?.name}
                  </span>{" "}
                  from inventory.
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {deleteOpen?.name}
                  </span>{" "}
                  is used in {deleteUsage.length} recipe(s). Deleting will also
                  remove it from those recipes.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteUsage.length > 0 && (
            <div className="rounded-md border bg-muted/50 p-3 max-h-48 overflow-auto">
              <p className="text-sm font-medium mb-2">Used in:</p>
              <ul className="text-sm space-y-1">
                {deleteUsage.map((u) => (
                  <li key={u.recipeId} className="text-muted-foreground">
                    • {u.productName}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => performDelete(deleteUsage.length > 0)}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending
                ? "Deleting..."
                : deleteUsage.length > 0
                  ? "Delete & Remove from Recipes"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust */}
      <Dialog
        open={!!adjustOpen}
        onOpenChange={(o) => !o && setAdjustOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {adjustOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-md flex justify-between">
              <span className="text-muted-foreground">Current Stock:</span>
              <span className="font-bold">
                {adjustOpen?.currentQuantity} {adjustOpen?.unit}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Change (+/-)</Label>
              <Input
                type="number"
                placeholder="-5 or 10"
                value={adjustChange}
                onChange={(e) => setAdjustChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                New total will be:{" "}
                {(adjustOpen?.currentQuantity || 0) +
                  Number(adjustChange || 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g., Restock, Spoilage, Error"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={!adjustChange || adjustItem.isPending}
            >
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function safeJson(s: string): { error?: string; usedIn?: UsageRow[] } | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function ItemFormFields(props: {
  name: string;
  setName: (v: string) => void;
  unit: CreateInventoryRequestUnit;
  setUnit: (v: CreateInventoryRequestUnit) => void;
  qty: string;
  setQty: (v: string) => void;
  min: string;
  setMin: (v: string) => void;
  cost: string;
  setCost: (v: string) => void;
  supplier: string;
  setSupplier: (v: string) => void;
}) {
  const isGrams = props.unit === "g";
  const isKg = props.unit === "kg";
  const isBulk = isGrams || isKg;
  const gramsPerBag = 2400; // 2.4kg por bolsa
  const costNum = Number(props.cost) || 0;

  // Convertir cantidad en gramos → bolsas para mostrar
  const qtyInBags = isBulk ? (Number(props.qty) / gramsPerBag) : 0;
  const minInBags = isBulk ? (Number(props.min) / gramsPerBag) : 0;

  // Costo por porción
  const costPer200g = costNum > 0 ? (costNum / gramsPerBag) * 200 : 0;
  const costPer300g = costNum > 0 ? (costNum / gramsPerBag) * 300 : 0;

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="ej: Papas fritas"
        />
      </div>
      <div className="space-y-2">
        <Label>Unidad de medida</Label>
        <Select
          value={props.unit}
          onValueChange={(v) => props.setUnit(v as CreateInventoryRequestUnit)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isBulk ? (
        /* Modo bolsas para ingredientes en gramos */
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>¿Cuántas bolsas tienes?</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="0"
                value={qtyInBags > 0 ? qtyInBags.toFixed(2).replace(/\.00$/, "") : ""}
                onChange={(e) => {
                  const bags = Number(e.target.value) || 0;
                  props.setQty(String(bags * gramsPerBag));
                }}
              />
              <p className="text-xs text-muted-foreground">
                = {props.qty || 0} g en inventario
              </p>
            </div>
            <div className="space-y-2">
              <Label>Costo por bolsa (Q)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={props.cost}
                onChange={(e) => props.setCost(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stock mínimo (bolsas)</Label>
            <Input
              type="number"
              step="0.5"
              placeholder="1"
              value={minInBags > 0 ? minInBags.toFixed(2).replace(/\.00$/, "") : ""}
              onChange={(e) => {
                const bags = Number(e.target.value) || 0;
                props.setMin(String(bags * gramsPerBag));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Alerta cuando queden menos de {props.min || 0} g
            </p>
          </div>

          {/* Calculadora de costo por porción */}
          {costNum > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                📊 Costo por porción (bolsa de 2.4kg)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Guarnición (200g)</div>
                  <div className="font-bold text-emerald-400 text-lg">Q {costPer200g.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">por plato</div>
                </div>
                <div className="bg-background/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Sola (300g)</div>
                  <div className="font-bold text-emerald-400 text-lg">Q {costPer300g.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">por plato</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Rinde <strong>{Math.floor(gramsPerBag / 200)}</strong> porciones de guarnición
                o <strong>{Math.floor(gramsPerBag / 300)}</strong> solas por bolsa
              </p>
            </div>
          )}
        </>
      ) : (
        /* Modo normal para otros ingredientes */
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cantidad actual ({props.unit})</Label>
            <Input
              type="number"
              value={props.qty}
              onChange={(e) => props.setQty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Stock mínimo ({props.unit})</Label>
            <Input
              type="number"
              value={props.min}
              onChange={(e) => props.setMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Costo por unidad (Q)</Label>
            <Input
              type="number"
              value={props.cost}
              onChange={(e) => props.setCost(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Proveedor</Label>
        <Input
          value={props.supplier}
          onChange={(e) => props.setSupplier(e.target.value)}
          placeholder="Opcional"
        />
      </div>
    </div>
  );
}
