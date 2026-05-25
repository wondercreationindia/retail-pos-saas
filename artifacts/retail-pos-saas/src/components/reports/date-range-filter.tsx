import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

export type DateRange = { dateFrom: string; dateTo: string };

type Preset = { label: string; fn: () => DateRange };

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0]!;
}

const PRESETS: Preset[] = [
  { label: "Today", fn: () => { const t = fmtDate(new Date()); return { dateFrom: t, dateTo: t }; } },
  { label: "Yesterday", fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = fmtDate(d); return { dateFrom: s, dateTo: s }; } },
  { label: "This Week", fn: () => { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay()); return { dateFrom: fmtDate(s), dateTo: fmtDate(n) }; } },
  { label: "Last Week", fn: () => { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay() - 7); const e = new Date(n); e.setDate(n.getDate() - n.getDay() - 1); return { dateFrom: fmtDate(s), dateTo: fmtDate(e) }; } },
  { label: "This Month", fn: () => { const n = new Date(); return { dateFrom: fmtDate(new Date(n.getFullYear(), n.getMonth(), 1)), dateTo: fmtDate(n) }; } },
  { label: "Last Month", fn: () => { const n = new Date(); return { dateFrom: fmtDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)), dateTo: fmtDate(new Date(n.getFullYear(), n.getMonth(), 0)) }; } },
  { label: "This Quarter", fn: () => { const n = new Date(); const q = Math.floor(n.getMonth() / 3); return { dateFrom: fmtDate(new Date(n.getFullYear(), q * 3, 1)), dateTo: fmtDate(n) }; } },
  { label: "This Year", fn: () => { const n = new Date(); return { dateFrom: `${n.getFullYear()}-01-01`, dateTo: fmtDate(n) }; } },
];

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  extraFilters?: React.ReactNode;
};

export function DateRangeFilter({ value, onChange, onRefresh, isLoading, extraFilters }: Props) {
  const [preset, setPreset] = useState("This Month");

  function applyPreset(label: string) {
    const p = PRESETS.find((x) => x.label === label);
    if (!p) return;
    setPreset(label);
    onChange(p.fn());
  }

  function handleDate(key: "dateFrom" | "dateTo", v: string) {
    setPreset("Custom");
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Select value={preset} onValueChange={applyPreset}>
        <SelectTrigger className="h-8 w-[130px] text-sm bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
          ))}
          {preset === "Custom" && <SelectItem value="Custom">Custom</SelectItem>}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="h-8 text-sm w-[130px] bg-white"
          value={value.dateFrom}
          onChange={(e) => handleDate("dateFrom", e.target.value)}
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          className="h-8 text-sm w-[130px] bg-white"
          value={value.dateTo}
          onChange={(e) => handleDate("dateTo", e.target.value)}
        />
      </div>

      {extraFilters}

      {onRefresh && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-white" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Run
        </Button>
      )}
    </div>
  );
}
