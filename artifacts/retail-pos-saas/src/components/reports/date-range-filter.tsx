import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, RefreshCw } from "lucide-react";

export type DateRange = { dateFrom: string; dateTo: string };

type Preset = { label: string; fn: () => DateRange };

function fmt(d: Date) {
  return d.toISOString().split("T")[0]!;
}

const PRESETS: Preset[] = [
  { label: "Today", fn: () => { const t = fmt(new Date()); return { dateFrom: t, dateTo: t }; } },
  {
    label: "Yesterday",
    fn: () => {
      const d = new Date(); d.setDate(d.getDate() - 1); const s = fmt(d);
      return { dateFrom: s, dateTo: s };
    },
  },
  {
    label: "This Week",
    fn: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day);
      return { dateFrom: fmt(start), dateTo: fmt(now) };
    },
  },
  {
    label: "Last Week",
    fn: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day - 7);
      const end = new Date(now); end.setDate(now.getDate() - day - 1);
      return { dateFrom: fmt(start), dateTo: fmt(end) };
    },
  },
  {
    label: "This Month",
    fn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: fmt(start), dateTo: fmt(now) };
    },
  },
  {
    label: "Last Month",
    fn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: fmt(start), dateTo: fmt(end) };
    },
  },
  {
    label: "This Quarter",
    fn: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { dateFrom: fmt(start), dateTo: fmt(now) };
    },
  },
  {
    label: "This Year",
    fn: () => {
      const now = new Date();
      return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: fmt(now) };
    },
  },
];

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  extraFilters?: React.ReactNode;
};

export function DateRangeFilter({ value, onChange, onRefresh, isLoading, extraFilters }: Props) {
  const [activePreset, setActivePreset] = useState<string>("This Month");

  function applyPreset(p: Preset) {
    setActivePreset(p.label);
    onChange(p.fn());
  }

  function handleCustomChange(key: "dateFrom" | "dateTo", v: string) {
    setActivePreset("Custom");
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3 print:hidden">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={activePreset === p.label ? "default" : "outline"}
            className="h-7 text-xs px-3"
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                className="h-8 text-sm w-[140px]"
                value={value.dateFrom}
                onChange={(e) => handleCustomChange("dateFrom", e.target.value)}
              />
            </div>
            <span className="text-muted-foreground mt-4">–</span>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                className="h-8 text-sm w-[140px]"
                value={value.dateTo}
                onChange={(e) => handleCustomChange("dateTo", e.target.value)}
              />
            </div>
          </div>
        </div>
        {extraFilters}
        {onRefresh && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}
