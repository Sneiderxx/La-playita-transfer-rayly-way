import { useState } from "react";
import {
  useGetSalesReport,
  useGetSalesTrend,
  useGetProductPerformance,
  useGetWaiterPerformance,
  useGetInventoryMovements,
  useListExpenses,
  getGetSalesReportQueryKey,
  getGetSalesTrendQueryKey,
  getGetProductPerformanceQueryKey,
  getGetWaiterPerformanceQueryKey,
  getGetInventoryMovementsQueryKey,
  getListExpensesQueryKey
} from "@workspace/api-client-react";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const REPORT_TYPES = ["ventas", "tendencia", "productos", "meseros", "inventario", "gastos"] as const;
type ReportType = typeof REPORT_TYPES[number];

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const salesReportQuery = useGetSalesReport({ from: dateFrom, to: dateTo }, { query: { enabled: reportType === "sales", queryKey: getGetSalesReportQueryKey({ from: dateFrom, to: dateTo }) } });
  const trendDays = Math.max(1, Math.min(365, differenceInCalendarDays(new Date(dateTo), new Date(dateFrom)) + 1));
  const trendQuery = useGetSalesTrend({ days: trendDays }, { query: { enabled: reportType === "trend", queryKey: getGetSalesTrendQueryKey({ days: trendDays }) } });
  const productQuery = useGetProductPerformance({ from: dateFrom, to: dateTo }, { query: { enabled: reportType === "products", queryKey: getGetProductPerformanceQueryKey({ from: dateFrom, to: dateTo }) } });
  const waiterQuery = useGetWaiterPerformance({ from: dateFrom, to: dateTo }, { query: { enabled: reportType === "waiters", queryKey: getGetWaiterPerformanceQueryKey({ from: dateFrom, to: dateTo }) } });
  const inventoryQuery = useGetInventoryMovements({ query: { enabled: reportType === "inventory", queryKey: getGetInventoryMovementsQueryKey() } });
  const expensesParams = { from: dateFrom, to: dateTo };
  const expensesQuery = useListExpenses(expensesParams, { query: { enabled: reportType === "expenses", queryKey: getListExpensesQueryKey(expensesParams) } });

  const renderContent = () => {
    switch (reportType) {
      case "ventas":
        const sales = salesReportQuery.data;
        if (!sales) return <div>Cargando...</div>;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">Total Sales</div><div className="text-2xl font-bold">{formatCurrency(sales.totalSales)}</div></CardContent></Card>
              <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">Transactions</div><div className="text-2xl font-bold">{sales.transactionCount}</div></CardContent></Card>
              <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">Average Ticket</div><div className="text-2xl font-bold">{formatCurrency(sales.averageTicket || 0)}</div></CardContent></Card>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Order #</TableHead><TableHead>Cashier</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {sales.sales.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.createdAt)}</TableCell>
                    <TableCell>#{s.orderId}</TableCell>
                    <TableCell>{s.cashierName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      
      case "products":
        const products = productQuery.data;
        if (!products) return <div>Cargando...</div>;
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={products.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="productName" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.productId}>
                    <TableCell>{p.productName}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "waiters":
        const waiters = waiterQuery.data;
        if (!waiters) return <div>Cargando...</div>;
        return (
          <Table>
            <TableHeader><TableRow><TableHead>Waiter</TableHead><TableHead className="text-right">Tables Served</TableHead><TableHead className="text-right">Total Generated</TableHead></TableRow></TableHeader>
            <TableBody>
              {waiters.map(w => (
                <TableRow key={w.waiterId}>
                  <TableCell>{w.waiterName}</TableCell>
                  <TableCell className="text-right">{w.salesCount}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(w.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "inventory":
        const inv = inventoryQuery.data;
        if (!inv) return <div>Cargando...</div>;
        return (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Change</TableHead><TableHead>Reason</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
            <TableBody>
              {inv.map(i => (
                <TableRow key={i.id}>
                  <TableCell>{formatDate(i.createdAt)}</TableCell>
                  <TableCell className="font-medium">{i.inventoryItemName}</TableCell>
                  <TableCell className={i.change > 0 ? "text-emerald-500 font-bold" : "text-destructive font-bold"}>
                    {i.change > 0 ? `+${i.change}` : i.change}
                  </TableCell>
                  <TableCell>{i.reason}</TableCell>
                  <TableCell>{i.userName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "trend":
        const trend = trendQuery.data;
        if (!trend) return <div>Cargando...</div>;
        return (
          <Card>
            <CardContent className="p-6 h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );

      case "expenses":
        const exp = expensesQuery.data;
        if (!exp) return <div>Cargando...</div>;
        const expTotal = exp.reduce((sum, e) => sum + Number(e.amount), 0);
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-sm text-muted-foreground">Total Expenses</div>
                <div className="text-2xl font-bold">{formatCurrency(expTotal)}</div>
              </CardContent>
            </Card>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {exp.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.expenseDate)}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="capitalize">{e.category.replace(/_/g, " ")}</TableCell>
                    <TableCell>{e.supplier ?? "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      default:
        return <div>Select a report</div>;
    }
  };

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      <Card className="print:hidden border-none shadow-none bg-muted/20">
        <CardContent className="p-4 flex gap-4 items-end">
          <div className="space-y-2 flex-1">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v) => { if (isReportType(v)) setReportType(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Summary</SelectItem>
                <SelectItem value="trend">Sales Trend (30 days)</SelectItem>
                <SelectItem value="products">Product Performance</SelectItem>
                <SelectItem value="waiters">Waiter Performance</SelectItem>
                <SelectItem value="inventory">Inventory Movements</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2 flex-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="print:block">
        <div className="hidden print:block mb-8 text-center border-b pb-4">
          <h1 className="text-2xl font-bold">La Playita de Don Concho</h1>
          <h2 className="text-xl capitalize">{reportType.replace("_", " ")} Report</h2>
          <p className="text-gray-500">{dateFrom} to {dateTo}</p>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
