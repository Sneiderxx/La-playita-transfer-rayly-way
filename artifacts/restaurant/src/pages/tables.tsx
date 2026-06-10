import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTables, 
  useOpenTable, 
  getListTablesQueryKey,
  RestaurantTable
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusColors, formatCurrency } from "@/lib/format";
import { Users, Clock, Receipt } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function Tables() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: tables = [], isLoading } = useListTables();
  const openTableMutation = useOpenTable();

  const handleTableClick = (table: RestaurantTable) => {
    if (table.status === "free") {
      openTableMutation.mutate({ id: table.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          setLocation(`/tables/${table.id}/order`);
        },
        onError: (err) => toast.error("Error al abrir mesa: " + err.message)
      });
    } else {
      setLocation(`/tables/${table.id}/order`);
    }
  };

  if (isLoading) return <div className="p-8">Cargando mesas...</div>;

  const elJardin = tables.filter(t => t.areaName === "El Jardín").sort((a,b) => a.number - b.number);
  const salon = tables.filter(t => t.areaName === "Salón").sort((a,b) => a.number - b.number);

  const statusLabel: Record<string, string> = {
    free: "Libre",
    occupied: "Ocupada",
    waiting_payment: "Esperando Pago",
    closed: "Cerrada",
  };

  const TableGrid = ({ tables }: { tables: RestaurantTable[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-4">
      {tables.map(table => (
        <Card 
          key={table.id}
          className={`cursor-pointer transition-all hover:scale-[1.02] border-2 ${statusColors[table.status]}`}
          onClick={() => handleTableClick(table)}
        >
          <CardContent className="p-3 flex flex-col h-full justify-between min-h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-2xl font-bold">#{table.number}</span>
              {table.openedAt && (
                <div className="flex items-center gap-1 text-xs opacity-80">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(table.openedAt), { locale: es, addSuffix: false })}
                </div>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {table.openedByName && (
                <div className="flex items-center gap-1 text-xs opacity-90">
                  <Users className="w-3 h-3" />
                  <span className="truncate">{table.openedByName}</span>
                </div>
              )}
              {table.currentTotal !== undefined && table.status !== "free" && (
                <div className="flex items-center gap-1 font-semibold text-sm">
                  <Receipt className="w-3 h-3" />
                  {formatCurrency(table.currentTotal)}
                </div>
              )}
              <div className={`text-xs font-medium ${table.status === "free" ? "opacity-60" : "opacity-90"}`}>
                {statusLabel[table.status] ?? table.status}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
        <div className="flex gap-4 text-sm font-medium">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>Libre</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div>Ocupada</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div>Esperando Pago</div>
        </div>
      </div>

      <Tabs defaultValue="jardin" className="w-full">
        <TabsList className="grid w-[300px] grid-cols-2">
          <TabsTrigger value="jardin">El Jardín ({elJardin.length})</TabsTrigger>
          <TabsTrigger value="salon">Salón ({salon.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="jardin">
          <TableGrid tables={elJardin} />
        </TabsContent>
        <TabsContent value="salon">
          <TableGrid tables={salon} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
