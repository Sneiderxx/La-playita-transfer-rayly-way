import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface FixedCost {
  id: number;
  name: string;
  category: string;
  monthlyAmount: string;
  active: boolean;
}

const CATEGORIES = [
  { value: "luz", label: "Luz eléctrica" },
  { value: "agua", label: "Agua" },
  { value: "internet", label: "Internet" },
  { value: "local", label: "Local / Renta" },
  { value: "basura", label: "Basura" },
  { value: "personal", label: "Personal / Planilla" },
  { value: "otro", label: "Otro" },
];

const categoryLabel = (c: string) => CATEGORIES.find(x => x.value === c)?.label ?? c;

export default function FixedCosts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [form, setForm] = useState({ name: "", category: "luz", monthlyAmount: "" });

  const { data: costs = [], isLoading } = useQuery<FixedCost[]>({
    queryKey: ["fixed-costs"],
    queryFn: () => customFetch("/api/fixed-costs"),
  });

  const { data: daily } = useQuery<{ monthlyTotal: number; dailyTotal: number }>({
    queryKey: ["fixed-costs-daily"],
    queryFn: () => customFetch("/api/fixed-costs/daily-total"),
  });

  const save = useMutation({
    mutationFn: (data: typeof form) => editing
      ? customFetch(`/api/fixed-costs/${editing.id}`, { method: "PUT", body: JSON.stringify(data) })
      : customFetch("/api/fixed-costs", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success(editing ? "Gasto actualizado" : "Gasto agregado");
      qc.invalidateQueries({ queryKey: ["fixed-costs"] });
      qc.invalidateQueries({ queryKey: ["fixed-costs-daily"] });
      setOpen(false);
      setEditing(null);
      setForm({ name: "", category: "luz", monthlyAmount: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/fixed-costs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Gasto eliminado");
      qc.invalidateQueries({ queryKey: ["fixed-costs"] });
      qc.invalidateQueries({ queryKey: ["fixed-costs-daily"] });
    },
  });

  const handleEdit = (cost: FixedCost) => {
    setEditing(cost);
    setForm({ name: cost.name, category: cost.category, monthlyAmount: cost.monthlyAmount });
    setOpen(true);
  };

  const totalMonthly = costs.filter(c => c.active).reduce((s, c) => s + Number(c.monthlyAmount), 0);
  const totalDaily = totalMonthly / 30;

  if (isLoading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Gastos Fijos</h1>
        <Button onClick={() => { setEditing(null); setForm({ name: "", category: "luz", monthlyAmount: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Agregar gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total mensual</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalMonthly)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Costo fijo diario</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalDaily)}</div><p className="text-xs text-muted-foreground mt-1">Se usa para calcular el costo real por plato</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rubros activos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{costs.filter(c => c.active).length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {costs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-4 opacity-20" />
              <p>No hay gastos fijos registrados.</p>
              <p className="text-sm mt-1">Agrega luz, agua, renta, personal, etc.</p>
            </div>
          ) : (
            <div className="divide-y">
              {costs.map(cost => (
                <div key={cost.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{cost.name}</div>
                      <Badge variant="secondary" className="text-xs mt-1">{categoryLabel(cost.category)}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrency(Number(cost.monthlyAmount))}</div>
                      <div className="text-xs text-muted-foreground">por mes</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(cost)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm(`¿Eliminar "${cost.name}"?`)) remove.mutate(cost.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar gasto fijo" : "Nuevo gasto fijo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Energía eléctrica" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto mensual (Q)</Label>
              <Input type="number" placeholder="0.00" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => save.mutate(form)} disabled={save.isPending || !form.name || !form.monthlyAmount}>
                {save.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
