import { useState } from "react";
import { Clock, User, Search } from "lucide-react";
import { SAMPLE_TABLES, STATUS_META, fmtQ, type TableRow } from "./_data";

const AREAS: Array<"all" | "El Jardín" | "Salón"> = ["all", "El Jardín", "Salón"];

function Card({ t }: { t: TableRow }) {
  const meta = STATUS_META[t.status];
  return (
    <button
      className="relative text-left bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden active:scale-[0.98] transition-transform"
      style={{ minHeight: 92 }}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: meta.color }} />
      <div className="p-3 pt-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold text-slate-900 leading-none">#{t.number}</span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: meta.soft, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">{t.area}</div>
        {t.status === "free" ? (
          <div className="text-xs text-slate-400 mt-2">Tap to open</div>
        ) : (
          <div className="mt-2 space-y-0.5 text-[11px] text-slate-700">
            <div className="flex items-center gap-1 truncate">
              <User className="w-3 h-3 text-slate-400" />
              <span className="truncate">{t.waiter}</span>
              <Clock className="w-3 h-3 text-slate-400 ml-1" />
              <span>{t.openedMinutes}m</span>
            </div>
            <div className="font-bold text-slate-900 text-sm">{fmtQ(t.total ?? 0)}</div>
          </div>
        )}
      </div>
    </button>
  );
}

export function DenseGrid() {
  const [area, setArea] = useState<"all" | "El Jardín" | "Salón">("all");
  const tables = area === "all" ? SAMPLE_TABLES : SAMPLE_TABLES.filter((t) => t.area === area);
  const counts = SAMPLE_TABLES.reduce(
    (acc, t) => ({ ...acc, [t.status]: acc[t.status] + 1 }),
    { free: 0, occupied: 0, waiting_payment: 0 } as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-slate-50 font-['Inter']">
      <div className="px-4 pt-5 pb-3 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Floor</div>
            <div className="text-2xl font-bold text-slate-900 -mt-0.5">Tables</div>
          </div>
          <button className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <Search className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {(["free", "occupied", "waiting_payment"] as const).map((s) => {
            const m = STATUS_META[s];
            return (
              <div key={s} className="rounded-xl px-2.5 py-2" style={{ background: m.soft }}>
                <div className="text-[10px] uppercase font-bold tracking-wide" style={{ color: m.color }}>
                  {m.label}
                </div>
                <div className="text-lg font-bold" style={{ color: m.color }}>
                  {counts[s]}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-3 overflow-x-auto -mx-1 px-1">
          {AREAS.map((a) => {
            const active = a === area;
            return (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                  active ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {a === "all" ? "All" : a}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3">
        {tables.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>
      <div className="h-20" />
    </div>
  );
}
