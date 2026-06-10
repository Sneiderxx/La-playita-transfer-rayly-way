import { useQueryClient } from "@tanstack/react-query";
import { 
  usePreviewDailyClose, 
  useCreateDailyClose,
  useGetLatestDailyClose,
  getGetLatestDailyCloseQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { format } from "date-fns";
import { Printer, CalendarX2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DailyClose() {
  const queryClient = useQueryClient();
  const dateStr = format(new Date(), "yyyy-MM-dd");

  const { data: preview, isLoading: isPreviewLoading } = usePreviewDailyClose();
  const { data: latest, isLoading: isLatestLoading } = useGetLatestDailyClose({
    query: { queryKey: getGetLatestDailyCloseQueryKey() }
  });
  const createClose = useCreateDailyClose();

  const handleClose = () => {
    if (!preview) return;
    if (confirm("Are you sure you want to finalize the day? This cannot be undone.")) {
      createClose.mutate(undefined, {
        onSuccess: () => {
          toast.success("Day closed successfully");
          queryClient.invalidateQueries({ queryKey: getGetLatestDailyCloseQueryKey() });
          window.print();
        }
      });
    }
  };

  if (isPreviewLoading || isLatestLoading) return <div>Loading...</div>;

  const isAlreadyClosed = latest?.closeDate === dateStr && latest?.finalized;
  const data = isAlreadyClosed ? latest : preview;

  if (!data) return <div>No data available</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto print:max-w-none print:m-0 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Daily Close</h1>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Print Z-Report
        </Button>
      </div>

      {isAlreadyClosed && (
        <Alert className="print:hidden bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
          <CalendarX2 className="w-4 h-4 !text-emerald-500" />
          <AlertTitle>Day Already Closed</AlertTitle>
          <AlertDescription>
            The day {dateStr} has been finalized. Showing the historical record.
          </AlertDescription>
        </Alert>
      )}

      {/* Printable Z-Report Format */}
      <Card className="print:border-none print:shadow-none font-mono">
        <CardHeader className="text-center border-b border-dashed pb-6">
          <CardTitle className="text-2xl font-black uppercase tracking-widest">La Playita de Don Concho</CardTitle>
          <CardDescription className="text-lg">
            Z-REPORT - END OF DAY
            <br />
            {formatDate(new Date())}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          
          <div className="space-y-2">
            <h3 className="font-bold border-b border-dashed pb-1 mb-2">FINANCIAL SUMMARY</h3>
            <div className="flex justify-between">
              <span>Gross Sales</span>
              <span>{formatCurrency(data.totalSales)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total Expenses</span>
              <span>- {formatCurrency(data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between font-black text-xl pt-2 border-t border-dashed mt-2">
              <span>NET PROFIT</span>
              <span>{formatCurrency(data.netProfit)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold border-b border-dashed pb-1 mb-2">PAYMENT BREAKDOWN</h3>
            {data.paymentBreakdown?.map(pb => (
              <div key={pb.method} className="flex justify-between">
                <span className="capitalize">{pb.method} ({pb.count})</span>
                <span>{formatCurrency(pb.amount)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="font-bold border-b border-dashed pb-1 mb-2">OPERATIONS</h3>
            <div className="flex justify-between">
              <span>Total Transactions</span>
              <span>{data.transactionCount}</span>
            </div>
          </div>

          {data.topProducts && data.topProducts.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold border-b border-dashed pb-1 mb-2">TOP SELLING PRODUCTS</h3>
              {data.topProducts.slice(0, 5).map(p => (
                <div key={p.productId} className="flex justify-between">
                  <span>{p.quantity}x {p.productName}</span>
                  <span>{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-bold border-b border-dashed pb-1 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 print:hidden" />
              LOW STOCK ITEMS
            </h3>
            {data.lowStock && data.lowStock.length > 0 ? (
              data.lowStock.map(item => (
                <div key={item.id} className="flex justify-between" data-testid={`row-z-low-stock-${item.id}`}>
                  <span>{item.name}</span>
                  <span>{item.currentQuantity} {item.unit} (min {item.minimumStock})</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground italic">All items are above minimum stock.</div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground pt-8 border-t border-dashed mt-8">
            END OF REPORT
            <br />
            Generated automatically by POS System
          </div>
        </CardContent>
      </Card>

      {!isAlreadyClosed && (
        <Button 
          className="w-full h-14 text-lg font-bold print:hidden" 
          onClick={handleClose}
          disabled={createClose.isPending}
        >
          FINALIZE DAY AND CLOSE
        </Button>
      )}
    </div>
  );
}
