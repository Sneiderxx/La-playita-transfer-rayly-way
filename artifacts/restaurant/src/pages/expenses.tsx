import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExpenses,
  useCreateExpense,
  useDeleteExpense,
  getListExpensesQueryKey,
  CreateExpenseRequestPaymentMethod,
  type CreateExpenseRequestPaymentMethod as ExpensePaymentMethod
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { format, subDays } from "date-fns";
import { Trash2, Plus, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Expenses() {
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [filterTo, setFilterTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const expensesParams = {
    ...(filterCategory !== "all" ? { category: filterCategory } : {}),
    from: filterFrom,
    to: filterTo,
  };
  const { data: expenses = [], isLoading } = useListExpenses(expensesParams, {
    query: { queryKey: getListExpensesQueryKey(expensesParams) }
  });
  
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [createOpen, setCreateOpen] = useState(false);
  
  // Form states
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food_supplies");
  const [supplier, setSupplier] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(CreateExpenseRequestPaymentMethod.cash);

  const categories = [
    { id: "food_supplies", label: "Food & Supplies" },
    { id: "drinks", label: "Drinks" },
    { id: "utilities", label: "Utilities" },
    { id: "payroll", label: "Payroll" },
    { id: "maintenance", label: "Maintenance" },
    { id: "transport", label: "Transport" },
    { id: "miscellaneous", label: "Miscellaneous" }
  ];

  const handleCreate = () => {
    createExpense.mutate({
      data: {
        name,
        amount: Number(amount),
        category,
        supplier: supplier || null,
        expenseDate,
        invoiceNumber: invoiceNumber || null,
        paymentMethod,
        description: ""
      }
    }, {
      onSuccess: () => {
        toast.success("Expense registered");
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        setName("");
        setAmount("");
        setSupplier("");
        setInvoiceNumber("");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpense.mutate({ id }, {
        onSuccess: () => {
          toast.success("Expense deleted");
          queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        }
      });
    }
  };

  const filteredExpenses = expenses.filter(e => filterCategory === "all" || e.category === filterCategory);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Register Expense
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} data-testid="input-filter-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} data-testid="input-filter-to" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map(expense => (
                <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                  <TableCell>{formatDate(expense.expenseDate, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {expense.name}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{expense.category.replace(/_/g, " ")}</TableCell>
                  <TableCell>{expense.supplier || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{expense.invoiceNumber || "-"}</TableCell>
                  <TableCell className="capitalize">{expense.paymentMethod}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(expense.id)} data-testid={`button-delete-expense-${expense.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExpenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No expenses found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomatoes and Onions" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (Q)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as ExpensePaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier (Optional)</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} data-testid="input-supplier" />
              </div>
              <div className="space-y-2">
                <Label>Invoice / Reference #</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. F-2025-0123" data-testid="input-invoice-number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name || !amount || createExpense.isPending}>
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
