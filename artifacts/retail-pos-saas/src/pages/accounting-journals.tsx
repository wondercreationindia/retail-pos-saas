import { useState } from "react";
import { useListJournalEntries, useCreateJournalEntry, useVoidJournalEntry, useListAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, AlertCircle } from "lucide-react";

type JItem = { accountId: number; debit: string; credit: string; description: string };

function today() { return new Date().toISOString().split("T")[0]!; }

export default function AccountingJournals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState(() => today().substring(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(() => today());
  const [showForm, setShowForm] = useState(false);
  const [voidDialog, setVoidDialog] = useState<{ id: number; number: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [form, setForm] = useState({ date: today(), description: "", narration: "", referenceNumber: "" });
  const [items, setItems] = useState<JItem[]>([
    { accountId: 0, debit: "0", credit: "0", description: "" },
    { accountId: 0, debit: "0", credit: "0", description: "" },
  ]);

  const { data: entries = [], isLoading } = useListJournalEntries({ dateFrom, dateTo, limit: 100 });
  const { data: accounts = [] } = useListAccounts({});
  const createMut = useCreateJournalEntry();
  const voidMut = useVoidJournalEntry();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/accounting/journals"] });

  const totalDebit = items.reduce((s, i) => s + (parseFloat(i.debit) || 0), 0);
  const totalCredit = items.reduce((s, i) => s + (parseFloat(i.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const addItem = () => setItems([...items, { accountId: 0, debit: "0", credit: "0", description: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof JItem, val: string | number) =>
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleCreate = () => {
    if (!isBalanced) return;
    createMut.mutate({
      data: {
        date: form.date, description: form.description, narration: form.narration || null,
        referenceNumber: form.referenceNumber || null, referenceType: "manual",
        items: items.filter((i) => i.accountId > 0).map((i) => ({
          accountId: i.accountId, debit: parseFloat(i.debit) || 0, credit: parseFloat(i.credit) || 0,
          description: i.description || null,
        })),
      },
    }, {
      onSuccess: () => { toast({ title: "Journal entry posted" }); setShowForm(false); invalidate(); },
      onError: (e: unknown) => toast({ title: (e as Error).message || "Failed", variant: "destructive" }),
    });
  };

  const handleVoid = () => {
    if (!voidDialog) return;
    voidMut.mutate({ id: voidDialog.id, data: { reason: voidReason } }, {
      onSuccess: () => { toast({ title: "Entry voided with reversal" }); setVoidDialog(null); invalidate(); },
      onError: () => toast({ title: "Failed to void", variant: "destructive" }),
    });
  };

  const statusColor: Record<string, string> = {
    posted: "bg-green-100 text-green-700",
    voided: "bg-red-100 text-red-700",
    draft: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground text-sm mt-1">Double-entry bookkeeping — every debit must equal credit</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />New Journal Entry
        </Button>
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No journal entries in this period.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Entry No.</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Ref</th>
                <th className="text-right px-4 py-3 font-medium">Debit</th>
                <th className="text-right px-4 py-3 font-medium">Credit</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{e.entryNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.referenceType ?? ""}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{e.totalDebit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{e.totalCredit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[e.status] ?? ""}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "posted" && (
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 text-xs h-7"
                        onClick={() => { setVoidDialog({ id: e.id, number: e.entryNumber }); setVoidReason(""); }}>
                        Void
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Entry Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Description *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Cash received from customer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Narration / Note</Label>
                <Input value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} />
              </div>
              <div>
                <Label>Reference No.</Label>
                <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Invoice / Bill no." />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Account</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Debit (₹)</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Credit (₹)</th>
                    <th className="text-left px-3 py-2 font-medium">Narration</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <Select value={String(item.accountId)} onValueChange={(v) => updateItem(idx, "accountId", parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter((a) => !a.isGroup).map((a) => (
                              <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.01" value={item.debit} onChange={(e) => updateItem(idx, "debit", e.target.value)} className="h-8 text-xs text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.01" value={item.credit} onChange={(e) => updateItem(idx, "credit", e.target.value)} className="h-8 text-xs text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="h-8 text-xs" placeholder="Line narration" />
                      </td>
                      <td className="px-3 py-2">
                        {items.length > 2 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td className="px-3 py-2 text-xs font-semibold">Totals</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-sm">₹{totalDebit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-sm">₹{totalCredit.toFixed(2)}</td>
                    <td colSpan={2} className="px-3 py-2">
                      {!isBalanced && totalDebit > 0 && (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />Difference: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)}
                        </span>
                      )}
                      {isBalanced && totalDebit > 0 && (
                        <span className="text-xs text-green-600">✓ Balanced</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addItem} className="text-xs">
              <Plus className="w-3 h-3 mr-1" />Add Line
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!isBalanced || createMut.isPending || !form.description}>
              Post Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={!!voidDialog} onOpenChange={() => setVoidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Journal Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will create a reversal entry for <strong>{voidDialog?.number}</strong>. This cannot be undone.</p>
          <div className="mt-2">
            <Label>Reason *</Label>
            <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason || voidMut.isPending}>Void Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
