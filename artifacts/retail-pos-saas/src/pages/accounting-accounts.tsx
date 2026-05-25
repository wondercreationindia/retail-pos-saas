import { useState } from "react";
import { useListAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useSeedAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, RefreshCw, ChevronRight } from "lucide-react";

const ACCOUNT_TYPES = ["asset", "liability", "income", "expense", "capital"] as const;
type AccountType = typeof ACCOUNT_TYPES[number];

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  income: "bg-green-100 text-green-700",
  expense: "bg-orange-100 text-orange-700",
  capital: "bg-purple-100 text-purple-700",
};

type Account = {
  id: number; code: string; name: string; type: string; group: string | null;
  isGroup: boolean; isSystem: boolean; openingBalance: number; isActive: boolean;
  parentId: number | null; description: string | null;
};

export default function AccountingAccounts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset", group: "", openingBalance: "0", description: "", isGroup: false });

  const { data: accounts = [], isLoading } = useListAccounts(
    filterType !== "all" ? { type: filterType } : {}
  );
  const seedMut = useSeedAccounts();
  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();
  const deleteMut = useDeleteAccount();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/accounting/accounts"] });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", type: "asset", group: "", openingBalance: "0", description: "", isGroup: false });
    setShowForm(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({ code: a.code, name: a.name, type: a.type, group: a.group ?? "", openingBalance: String(a.openingBalance), description: a.description ?? "", isGroup: a.isGroup });
    setShowForm(true);
  };

  const handleSeed = () => {
    seedMut.mutate(undefined, {
      onSuccess: (d) => { toast({ title: `${d.created} default accounts created` }); invalidate(); },
      onError: () => toast({ title: "Seed failed", variant: "destructive" }),
    });
  };

  const handleSubmit = () => {
    const body = {
      code: form.code, name: form.name, type: form.type,
      group: form.group || null, isGroup: form.isGroup,
      openingBalance: parseFloat(form.openingBalance) || 0,
      description: form.description || null,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: body }, {
        onSuccess: () => { toast({ title: "Account updated" }); setShowForm(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: body }, {
        onSuccess: () => { toast({ title: "Account created" }); setShowForm(false); invalidate(); },
        onError: (e: unknown) => toast({ title: (e as Error).message || "Create failed", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (a: Account) => {
    if (!confirm(`Delete account "${a.name}"?`)) return;
    deleteMut.mutate({ id: a.id }, {
      onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
      onError: () => toast({ title: "Cannot delete this account", variant: "destructive" }),
    });
  };

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const g = a.group ?? "Other";
    (acc[g] ??= []).push(a as Account);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your accounting chart — assets, liabilities, income, expenses &amp; capital</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={handleSeed} disabled={seedMut.isPending}>
              <RefreshCw className="w-4 h-4 mr-2" />Seed Default Accounts
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Account
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", ...ACCOUNT_TYPES].map((t) => (
          <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} onClick={() => setFilterType(t)} className="capitalize">
            {t}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground mb-4">No accounts found. Seed default accounts to get started.</p>
          <Button variant="outline" onClick={handleSeed} disabled={seedMut.isPending}>
            <RefreshCw className="w-4 h-4 mr-2" />Seed Default Chart of Accounts
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
            <div key={group} className="rounded-lg border bg-card">
              <div className="px-4 py-2 bg-muted/50 rounded-t-lg border-b flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{group}</span>
                <span className="text-xs text-muted-foreground ml-auto">{items.length} account{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y">
                {items.sort((a, b) => a.code.localeCompare(b.code)).map((a) => (
                  <div key={a.id} className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="w-20 font-mono text-sm text-muted-foreground">{a.code}</div>
                    <div className="flex-1">
                      <span className={`font-medium ${a.isGroup ? "font-semibold" : ""}`}>{a.name}</span>
                      {a.isSystem && <Badge variant="secondary" className="ml-2 text-xs">system</Badge>}
                      {a.isGroup && <Badge variant="outline" className="ml-2 text-xs">group</Badge>}
                    </div>
                    <Badge className={`text-xs mr-4 ${TYPE_COLORS[a.type as AccountType] ?? ""}`}>{a.type}</Badge>
                    <span className="w-32 text-right text-sm font-mono">
                      {a.openingBalance !== 0 && (
                        <span className={a.openingBalance < 0 ? "text-red-600" : "text-green-600"}>
                          ₹{Math.abs(a.openingBalance).toFixed(2)}
                        </span>
                      )}
                    </span>
                    <div className="flex gap-1 ml-3">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a as Account)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {!a.isSystem && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(a as Account)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1101" disabled={!!editing} />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cash in Hand" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Group / Category</Label>
                <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="e.g. Current Assets" />
              </div>
              <div>
                <Label>Opening Balance (₹)</Label>
                <Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isGroup} onChange={(e) => setForm({ ...form, isGroup: e.target.checked })} />
              This is a group / heading account (no transactions)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
