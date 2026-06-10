import { format } from "date-fns";

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, formatStr: string = "dd/MM/yyyy HH:mm") {
  if (!date) return "";
  return format(new Date(date), formatStr);
}

export const statusColors: Record<string, string> = {
  free: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  occupied: "bg-red-500/10 text-red-500 border-red-500/20",
  waiting_payment: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  closed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  pending: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  preparing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  delivered: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};
