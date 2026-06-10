export type TableStatus = "free" | "occupied" | "waiting_payment";

export type TableRow = {
  id: number;
  number: number;
  area: "El Jardín" | "Salón";
  status: TableStatus;
  waiter?: string;
  openedMinutes?: number;
  total?: number;
};

export const SAMPLE_TABLES: TableRow[] = [
  { id: 1, number: 1, area: "El Jardín", status: "free" },
  { id: 2, number: 2, area: "El Jardín", status: "free" },
  { id: 3, number: 3, area: "El Jardín", status: "occupied", waiter: "Sneider", openedMinutes: 24, total: 30 },
  { id: 4, number: 4, area: "El Jardín", status: "free" },
  { id: 5, number: 5, area: "El Jardín", status: "waiting_payment", waiter: "Lucia", openedMinutes: 58, total: 285.5 },
  { id: 6, number: 6, area: "El Jardín", status: "occupied", waiter: "Marcos", openedMinutes: 12, total: 142 },
  { id: 7, number: 7, area: "El Jardín", status: "free" },
  { id: 8, number: 8, area: "El Jardín", status: "free" },
  { id: 9, number: 9, area: "El Jardín", status: "occupied", waiter: "Sneider", openedMinutes: 41, total: 96.25 },
  { id: 10, number: 10, area: "El Jardín", status: "free" },
  { id: 11, number: 1, area: "Salón", status: "waiting_payment", waiter: "Marcos", openedMinutes: 73, total: 412 },
  { id: 12, number: 2, area: "Salón", status: "occupied", waiter: "Lucia", openedMinutes: 8, total: 64 },
  { id: 13, number: 3, area: "Salón", status: "free" },
  { id: 14, number: 4, area: "Salón", status: "free" },
];

export const fmtQ = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const STATUS_META = {
  free: { label: "Free", color: "#10b981", soft: "#d1fae5" },
  occupied: { label: "Occupied", color: "#ef4444", soft: "#fee2e2" },
  waiting_payment: { label: "Pay", color: "#f59e0b", soft: "#fef3c7" },
} as const;
