import { useState } from "react";
import { Clock, User } from "lucide-react";
import { SAMPLE_TABLES, STATUS_META, fmtQ, type TableRow } from "./_data";

type Pos = { x: number; y: number; shape?: "round" | "square" | "long" };

const POSITIONS: Record<number, Pos> = {
  1: { x: 12, y: 8, shape: "round" },
  2: { x: 56, y: 8, shape: "round" },
  3: { x: 12, y: 32, shape: "square" },
  4: { x: 56, y: 32, shape: "square" },
  5: { x: 30, y: 56, shape: "long" },
  6: { x: 12, y: 78, shape: "round" },
  7: { x: 56, y: 78, shape: "round" },
  8: { x: 80, y: 32, shape: "round" },
  9: { x: 80, y: 56, shape: "round" },
  10: { x: 80, y: 8, shape: "round" },
  11: { x: 18, y: 18, shape: "long" },
  12: { x: 18, y: 50, shape: "square" },
  13: { x: 60, y: 18, shape: "square" },
  14: { x: 60, y: 50, shape: "round" },
};

function TableNode({ t, pos, onTap }: { t: TableRow; pos: Pos; onTap: (t: TableRow) => void }) {
  const m = STATUS_META[t.status];
  const shape = pos.shape ?? "round";
  const w = shape === "long" ? 76 : 52;
  const h = shape === "long" ? 36 : 52;
  const radius = shape === "round" ? 999 : 12;
  return (
    <button
      onClick={() => onTap(t)}
      className="absolute flex flex-col items-center justify-center font-bold text-white shadow-md active:scale-95 transition-transform"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        width: w,
        height: h,
        borderRadius: radius,
        background: m.color,
        boxShadow: `0 6px 16px -4px ${m.color}66`,
      }}
    >
      <span className="text-base leading-none">#{t.number}</span>
      {t.status !== "free" && (
        <span className="text-[8px] mt-0.5 opacity-90">{fmtQ(t.total ?? 0)}</span>
      )}
    </button>
  );
}

export function FloorMap() {
  const [area, setArea] = useState<"El Jardín" | "Salón">("El Jardín");
  const [selected, setSelected] = useState<TableRow | null>(null);
  const tables = SAMPLE_TABLES.filter((t) => t.area === area);
  const counts = tables.reduce(
    (acc, t) => ({ ...acc, [t.status]: acc[t.status] + 1 }),
    { free: 0, occupied: 0, waiting_payment: 0 } as Record<string, number>,
  );

  const m = selected ? STATUS_META[selected.status] : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 font-['Inter']">
      <div className="px-4 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Floor map</div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-slate-900">{area}</div>
          <div className="flex gap-2 text-[11px] text-slate-500">
            {(["free", "occupied", "waiting_payment"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                {counts[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mb-3 flex gap-2">
        {(["El Jardín", "Salón"] as const).map((a) => {
          const active = a === area;
          return (
            <button
              key={a}
              onClick={() => {
                setArea(a);
                setSelected(null);
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-4 pb-4">
        <div
          className="relative w-full rounded-3xl overflow-hidden border border-slate-200 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.06),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.06),transparent_60%)]"
          style={{ minHeight: 420 }}
        >
          {/* Decor: bar / entrance markers */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest text-slate-300 font-semibold">
            Entrance
          </div>
          <div className="absolute bottom-2 right-3 text-[9px] uppercase tracking-widest text-slate-300 font-semibold">
            Bar
          </div>

          {tables.map((t) => {
            const pos = POSITIONS[t.id];
            if (!pos) return null;
            return <TableNode key={t.id} t={t} pos={pos} onTap={setSelected} />;
          })}
        </div>
      </div>

      {/* Detail sheet */}
      {selected && m && (
        <div className="px-4 pb-6 pt-2 bg-white border-t border-slate-200 rounded-t-3xl shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-3" />
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-slate-900">Table #{selected.number}</span>
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: m.soft, color: m.color }}
                >
                  {m.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{selected.area}</div>
            </div>
            {selected.status !== "free" && (
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{fmtQ(selected.total ?? 0)}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 justify-end">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selected.waiter}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selected.openedMinutes}m
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: m.color }}
          >
            {selected.status === "free"
              ? "Open table"
              : selected.status === "waiting_payment"
                ? "Process payment"
                : "View order"}
          </button>
        </div>
      )}
    </div>
  );
}
