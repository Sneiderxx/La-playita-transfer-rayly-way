import { useMemo } from "react";
import { ChevronRight, AlertCircle, Clock, User, Plus } from "lucide-react";
import { SAMPLE_TABLES, STATUS_META, fmtQ, type TableRow, type TableStatus } from "./_data";

const ORDER: TableStatus[] = ["waiting_payment", "occupied", "free"];

function Row({ t }: { t: TableRow }) {
  const m = STATUS_META[t.status];
  return (
    <button className="w-full flex items-center gap-3 px-4 py-3 bg-white active:bg-slate-50 transition-colors">
      <div
        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-extrabold shrink-0"
        style={{ background: m.soft, color: m.color }}
      >
        <span className="text-lg leading-none">#{t.number}</span>
        <span className="text-[8px] uppercase tracking-wide opacity-70 mt-0.5">{t.area === "El Jardín" ? "Jrdn" : "Saln"}</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        {t.status === "free" ? (
          <>
            <div className="text-sm font-semibold text-slate-900">Available</div>
            <div className="text-xs text-slate-500">{t.area} · Tap to open</div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{fmtQ(t.total ?? 0)}</span>
              {t.status === "waiting_payment" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                  Pay now
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {t.waiter}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t.openedMinutes}m
              </span>
            </div>
          </>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </button>
  );
}

export function ActionList() {
  const grouped = useMemo(() => {
    const g: Record<TableStatus, TableRow[]> = { waiting_payment: [], occupied: [], free: [] };
    SAMPLE_TABLES.forEach((t) => g[t.status].push(t));
    return g;
  }, []);

  const urgentCount = grouped.waiting_payment.length;

  return (
    <div className="min-h-screen bg-slate-100 font-['Inter']">
      <div className="px-4 pt-5 pb-4 bg-white">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Floor</div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-slate-900">Service queue</div>
          <button className="text-xs font-semibold text-sky-600">All tables</button>
        </div>
        {urgentCount > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-amber-800 font-medium">
              {urgentCount} {urgentCount === 1 ? "table needs" : "tables need"} payment
            </span>
          </div>
        )}
      </div>

      {ORDER.map((status) => {
        const rows = grouped[status];
        if (rows.length === 0) return null;
        const m = STATUS_META[status];
        return (
          <div key={status} className="mt-3">
            <div className="px-4 py-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: m.color }}>
                {status === "waiting_payment" ? "Awaiting payment" : status === "occupied" ? "In service" : "Available"}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">· {rows.length}</span>
            </div>
            <div className="bg-white divide-y divide-slate-100 mx-3 rounded-2xl overflow-hidden shadow-sm">
              {rows.map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="h-24" />
      <button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-sky-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: "0 10px 24px -8px rgba(14,165,233,0.55)" }}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
