import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTables, 
  getListTablesQueryKey,
  useCreateSale,
  RestaurantTable,
  CreateSaleRequestPaymentsItemMethod
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Receipt, Banknote, CreditCard, Smartphone, Plus, Minus, Percent } from "lucide-react";

interface PaymentLine {
  method: CreateSaleRequestPaymentsItemMethod;
  amount: string;
}

export default function POS() {
  const queryClient = useQueryClient();
  const { data: tables = [], isLoading } = useListTables();
  const createSale = useCreateSale();
  
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: CreateSaleRequestPaymentsItemMethod.cash, amount: "" }]);
  const [tipType, setTipType] = useState<"none" | "10" | "custom">("none");
  const [customTip, setCustomTip] = useState("");

  const waitingTables = tables.filter(t => t.status === "waiting_payment");

  const handleOpenTable = (table: RestaurantTable) => {
    setSelectedTable(table);
    const total = table.currentTotal || 0;
    setPayments([{ method: CreateSaleRequestPaymentsItemMethod.cash, amount: String(total) }]);
    setTipType("none");
    setCustomTip("");
  };

  const subtotal = selectedTable?.currentTotal || 0;
  const tipAmount = tipType === "10" ? subtotal * 0.10 : tipType === "custom" ? Number(customTip) || 0 : 0;
  const totalWithTip = subtotal + tipAmount;

  const paymentsTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = paymentsTotal - totalWithTip;

  const addPaymentLine = () => {
    setPayments([...payments, { method: CreateSaleRequestPaymentsItemMethod.card, amount: "" }]);
  };

  const removePaymentLine = (i: number) => {
    setPayments(payments.filter((_, idx) => idx !== i));
  };

  const updatePayment = (i: number, field: "method" | "amount", val: string) => {
    const next = [...payments];
    next[i] = { ...next[i], [field]: val };
    setPayments(next);
  };

  const handleTipChange = (type: "none" | "10" | "custom") => {
    setTipType(type);
    const base = selectedTable?.currentTotal || 0;
    if (type === "10") {
      const total = base * 1.10;
      setPayments([{ ...payments[0], amount: String(total.toFixed(2)) }]);
    } else if (type === "none") {
      setPayments([{ ...payments[0], amount: String(base) }]);
    }
  };

  const handlePay = () => {
    if (!selectedTable || !selectedTable.currentOrderId) return;
    if (paymentsTotal < totalWithTip) {
      toast.error("El monto pagado es menor al total");
      return;
    }

    const validPayments = payments
      .filter(p => Number(p.amount) > 0)
      .map(p => ({ method: p.method, amount: Number(p.amount) }));

    if (validPayments.length === 0) {
      toast.error("Agrega al menos un método de pago");
      return;
    }

    createSale.mutate({
      data: {
        orderId: selectedTable.currentOrderId,
        payments: validPayments
      }
    }, {
      onSuccess: () => {
        toast.success("Pago procesado correctamente");
        queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
        setSelectedTable(null);
      },
      onError: (err) => {
        toast.error("Error al procesar pago: " + err.message);
      }
    });
  };

  if (isLoading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Cobros</h1>
        <div className="text-sm text-muted-foreground">{waitingTables.length} mesa(s) esperando pago</div>
      </div>

      {waitingTables.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Sin pagos pendientes</h3>
            <p>Las mesas que soliciten pago aparecerán aquí.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {waitingTables.map(table => (
            <Card 
              key={table.id} 
              className="cursor-pointer hover:border-primary transition-colors border-2 bg-amber-500/5 border-amber-500/30"
              onClick={() => handleOpenTable(table)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                  <span>Mesa #{table.number}</span>
                  <span className="text-primary font-bold">{formatCurrency(table.currentTotal || 0)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Área: {table.areaName}</div>
                  <div>Mesero: {table.openedByName}</div>
                </div>
                <Button className="w-full mt-4">Cobrar</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cobrar — Mesa #{selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Subtotal */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Subtotal consumo</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Propina</span>
                  <span className="text-green-600">+{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totalWithTip)}</span>
              </div>
            </div>

            {/* Propina */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Percent className="w-4 h-4" /> Propina</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={tipType === "none" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => handleTipChange("none")}
                >
                  Sin propina
                </Button>
                <Button 
                  variant={tipType === "10" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => handleTipChange("10")}
                >
                  10% — {formatCurrency(subtotal * 0.10)}
                </Button>
                <Button 
                  variant={tipType === "custom" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => handleTipChange("custom")}
                >
                  Personalizada
                </Button>
              </div>
              {tipType === "custom" && (
                <Input 
                  type="number" 
                  placeholder="Monto de propina (Q)" 
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                />
              )}
            </div>

            {/* Métodos de pago */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Método(s) de pago</Label>
                <Button variant="ghost" size="sm" onClick={addPaymentLine}>
                  <Plus className="w-3 h-3 mr-1" /> Dividir pago
                </Button>
              </div>
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={p.method} onValueChange={v => updatePayment(i, "method", v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash"><div className="flex items-center gap-2"><Banknote className="w-4 h-4" /> Efectivo</div></SelectItem>
                      <SelectItem value="card"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Tarjeta</div></SelectItem>
                      <SelectItem value="transfer"><div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Transferencia</div></SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    className="flex-1"
                    placeholder="Monto"
                    value={p.amount}
                    onChange={e => updatePayment(i, "amount", e.target.value)}
                  />
                  {payments.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removePaymentLine(i)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Cambio */}
            {change > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg flex justify-between items-center">
                <span className="font-medium text-green-700">Cambio a devolver</span>
                <span className="text-xl font-bold text-green-700">{formatCurrency(change)}</span>
              </div>
            )}
            {change < 0 && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex justify-between items-center">
                <span className="font-medium text-red-700">Falta por cobrar</span>
                <span className="text-xl font-bold text-red-700">{formatCurrency(Math.abs(change))}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedTable(null)}>Cancelar</Button>
              <Button 
                className="flex-1" 
                onClick={handlePay}
                disabled={createSale.isPending || paymentsTotal < totalWithTip}
              >
                {createSale.isPending ? "Procesando..." : "Confirmar Pago"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
