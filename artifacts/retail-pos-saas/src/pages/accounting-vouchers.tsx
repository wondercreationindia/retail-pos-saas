import { useState } from "react";
import { useListVouchers, useCreateVoucher, useCancelVoucher, useListAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

const VOUCHER_TYPES = ["payment", "receipt", "contra", "journal"] as const;

const TYPE_INFO: Record<string, { label: string; color: string; desc: string }> = {
  payment: { label: "Payment", color: "text-red-600 bg-red-50", desc: "Cash/Bank payment to a party" },
  receipt: { label: "Receipt", color: "text-green-600 bg-green-50", desc: "Cash/Bank received from a party" },
  contra: { label: "Contra", color: "text-blue-600 bg-blue-50", desc: "Cash ↔ Bank transfer" },
  journal: { label: "Journal", color: "text-purple-600 bg-purple-50", desc: "Manual journal voucher" },
};

function today() { return new Date().toISOString().split("T")[0]!; }

export default function AccountingVouchers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => today().substring(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(() => today());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "payment", date: today(), amount: "", accountId: "", contraAccountId: "",
    partyName: "", description: "", reference: "",
  });

  const queryParams = {
    ...(filterType !== "all" ? { type: filterType } : {}),
    dateFrom, dateTo, limit: 100,
  };

  const { data: vouchers = [], isLoading } = useListVouchers(queryParams);
  const { data: accounts = [] } = useListAccounts({});
  const createMut = useCreateVoucher();
  const cancelMut = useCancelVoucher();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/accounting/vouchers"] });

  const cashBankAccounts = accounts.filter((a) => !a.isGroup && (a.code?.startsWith("1101") || a.code?.startsWith("1102") || a.code?.startsWith("1103")));
  const allLeafAccounts = accounts.filter((a) => !a.isGroup);

  const handleCreate = () => {
    createMut.mutate({
      data: {
        type: form.type,
        date: form.date,
        amount: parseFloat(form.amount) || 0,
        accountId: parseInt(form.accountId),
        contraAccountId: parseInt(form.contraAccountId),
        partyName: form.partyName || null,
        description: form.description,
        reference: form.reference || null,
      },
    }, {
      onSuccess: () => { toast({ title: "Voucher created" }); setShowForm(false); invalidate(); },
      onError: (e: unknown) => toast({ title: (e as Error).message || "Failed", variant: "destructive" }),
    });
  };

  const handleCancel = (id: number, vNum: string) => {
    if (!confirm(`Cancel voucher ${vNum}?`)) return;
    cancelMut.mutate({ id }, {
      onSuccess: () => { toast({ title: "Voucher cancelled" }); invalidate(); },
      onError: () => toast({ title: "Cancel failed", variant: "destructive" }),
    });
  };

  const getAccountName = (id: number | null | undefined) => {
    if (!id) return "—";
    return accounts.find((a) => a.id === id)?.name ?? `#${id}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="text-muted-foreground text-sm mt-1">Payment, Receipt, Contra &amp; Journal vouchers</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />New Voucher
        </Button>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex gap-2">
          {["all", ...VOUCHER_TYPES].map((t) => (
            <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} onClick={() => setFilterType(t)} className="capitalize">
              {t}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : vouchers.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No vouchers in this period.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Voucher No.</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Account</th>
                <th className="text-left px-4 py-3 font-medium">Contra</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vouchers.map((v) => {
                const ti = TYPE_INFO[v.type] ?? { label: v.type, color: "", desc: "" };
                return (
                  <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{v.voucherNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ti.color}`}>{ti.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.date}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{v.description}</td>
                    <td className="px-4 py-3 text-sm">{getAccountName(v.accountId)}</td>
                    <td className="px-4 py-3 text-sm">{getAccountName(v.contraAccountId)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">₹{v.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === "posted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {v.status === "posted" && (
                        <Button size="sm" variant="ghost" className="text-red-600 text-xs h-7"
                          onClick={() => handleCancel(v.id, v.voucherNumber)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-sm font-semibold text-right">Total:</td>
                <td className="px-4 py-2 text-right font-mono font-bold">
                  ₹{vouchers.filter((v) => v.status !== "cancelled").reduce((s, v) => s + v.amount, 0).toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Voucher</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOUCHER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <div>
                          <div className="font-medium capitalize">{t}</div>
                          <div className="text-xs text-muted-foreground">{TYPE_INFO[t]?.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{form.type === "receipt" ? "Received Into" : "Paid From"} (Cash/Bank) *</Label>
                <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Cash/Bank account" /></SelectTrigger>
                  <SelectContent>
                    {(form.type === "contra" ? allLeafAccounts : cashBankAccounts.length > 0 ? cashBankAccounts : allLeafAccounts).map((a) => (
                      <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.type === "receipt" ? "Received From" : "Paid To"} Account *</Label>
                <Select value={form.contraAccountId} onValueChange={(v) => setForm({ ...form, contraAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Expense/Income/Party" /></SelectTrigger>
                  <SelectContent>
                    {allLeafAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Party Name</Label>
                <Input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} placeholder="Customer / Supplier" />
              </div>
              <div>
                <Label>Reference No.</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Invoice / Bill no." />
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Payment narration" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending || !form.amount || !form.accountId || !form.contraAccountId || !form.description}>
              Create Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
