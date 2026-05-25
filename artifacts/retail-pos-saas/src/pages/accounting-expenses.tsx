import { useState } from "react";
import { useListExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useListAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Rent", "Utilities", "Salaries", "Marketing", "Office Supplies",
  "Transport", "Repairs", "Professional Fees", "Bank Charges", "Miscellaneous",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function today() { return new Date().toISOString().split("T")[0]!; }

export default function AccountingExpenses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => today().substring(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(() => today());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today(), category: "Miscellaneous", amount: "", gstAmount: "0",
    vendor: "", description: "", paymentMethod: "cash",
    paidFromAccountId: "", isRecurring: false, notes: "",
  });

  const queryParams = {
    ...(filterStatus !== "all" ? { status: filterStatus } : {}),
    dateFrom, dateTo, limit: 100,
  };

  const { data: expenses = [], isLoading } = useListExpenses(queryParams);
  const { data: accounts = [] } = useListAccounts({});
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const deleteMut = useDeleteExpense();

  const cashAccounts = accounts.filter((a) => !a.isGroup && ["1101", "1102", "1103"].includes(a.code ?? ""));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/accounting/expenses"] });

  const handleCreate = () => {
    createMut.mutate({
      data: {
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        gstAmount: parseFloat(form.gstAmount) || 0,
        vendor: form.vendor || null,
        description: form.description,
        paymentMethod: form.paymentMethod,
        paidFromAccountId: form.paidFromAccountId ? parseInt(form.paidFromAccountId) : null,
        isRecurring: form.isRecurring,
        notes: form.notes || null,
      },
    }, {
      onSuccess: () => { toast({ title: "Expense recorded" }); setShowForm(false); invalidate(); },
      onError: (e: unknown) => toast({ title: (e as Error).message || "Failed", variant: "destructive" }),
    });
  };

  const handleApprove = (id: number) => {
    updateMut.mutate({ id, data: { status: "approved" } }, {
      onSuccess: () => { toast({ title: "Expense approved and journal posted" }); invalidate(); },
      onError: () => toast({ title: "Approve failed", variant: "destructive" }),
    });
  };

  const handleReject = (id: number) => {
    updateMut.mutate({ id, data: { status: "rejected" } }, {
      onSuccess: () => { toast({ title: "Expense rejected" }); invalidate(); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this expense?")) return;
    deleteMut.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
      onError: () => toast({ title: "Cannot delete approved expense", variant: "destructive" }),
    });
  };

  const totalAmount = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Record and approve business expenses — auto-posts journal on approval</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Add Expense
        </Button>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)} className="capitalize">
              {s}
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
      ) : expenses.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No expenses found.</div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Exp. No.</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">GST</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{e.expenseNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-3 font-medium">{e.category}</td>
                    <td className="px-4 py-3 text-sm">{e.vendor ?? "—"}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{e.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">₹{(e.gstAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">₹{e.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[e.status] ?? ""}`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {e.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleApprove(e.id)} title="Approve">
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-600" onClick={() => handleReject(e.id)} title="Reject">
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)} title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-sm font-semibold text-right">Approved Total:</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-green-700">₹{totalAmount.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (₹) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>GST Amount (₹)</Label>
                <Input type="number" step="0.01" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor / Payee</Label>
                <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Name of vendor" />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Paid From Account</Label>
              <Select value={form.paidFromAccountId} onValueChange={(v) => setForm({ ...form, paidFromAccountId: v })}>
                <SelectTrigger><SelectValue placeholder="Cash / Bank account (optional)" /></SelectTrigger>
                <SelectContent>
                  {cashAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.code} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this expense for?" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
              Recurring expense
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending || !form.amount || !form.description}>
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
