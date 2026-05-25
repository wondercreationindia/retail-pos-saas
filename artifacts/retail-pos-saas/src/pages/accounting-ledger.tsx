import { useState } from "react";
import { useGetAccountLedger, getGetAccountLedgerQueryKey, useListAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen } from "lucide-react";

function today() { return new Date().toISOString().split("T")[0]!; }

export default function AccountingLedger() {
  const [accountId, setAccountId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => today().substring(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(() => today());
  const [queryKey, setQueryKey] = useState<{ id: number; from: string; to: string } | null>(null);

  const { data: accounts = [] } = useListAccounts({});
  const leafAccounts = accounts.filter((a) => !a.isGroup);

  const ledgerParams = queryKey ? { dateFrom: queryKey.from, dateTo: queryKey.to, limit: 500 } : {};
  const { data: ledger, isLoading } = useGetAccountLedger(
    queryKey?.id ?? 0,
    ledgerParams,
    { query: { enabled: !!queryKey, queryKey: getGetAccountLedgerQueryKey(queryKey?.id ?? 0, ledgerParams) } }
  );

  const handleView = () => {
    if (!accountId) return;
    setQueryKey({ id: parseInt(accountId), from: dateFrom, to: dateTo });
  };

  const transactions = ledger?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Ledger</h1>
        <p className="text-muted-foreground text-sm mt-1">View all transactions for a specific account with running balance</p>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-56">
          <Label className="text-xs">Account *</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {leafAccounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" />
        </div>
        <Button onClick={handleView} disabled={!accountId} className="h-9">
          <BookOpen className="w-4 h-4 mr-2" />View Ledger
        </Button>
      </div>

      {!queryKey && (
        <div className="py-20 text-center text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Select an account and date range to view its ledger</p>
        </div>
      )}

      {queryKey && isLoading && (
        <div className="py-16 text-center text-muted-foreground">Loading ledger…</div>
      )}

      {ledger && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{ledger.account?.code} — {ledger.account?.name}</h2>
              <p className="text-sm text-muted-foreground capitalize">{ledger.account?.type} | {ledger.account?.group ?? ""}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Closing Balance</div>
              <div className={`text-xl font-bold ${(ledger.closingBalance ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                ₹{Math.abs(ledger.closingBalance ?? 0).toFixed(2)} {(ledger.closingBalance ?? 0) < 0 ? "Cr" : "Dr"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Ref Type</th>
                  <th className="text-left px-4 py-3 font-medium">Party</th>
                  <th className="text-right px-4 py-3 font-medium">Debit (₹)</th>
                  <th className="text-right px-4 py-3 font-medium">Credit (₹)</th>
                  <th className="text-right px-4 py-3 font-medium">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Opening balance row */}
                <tr className="bg-muted/20 text-xs italic">
                  <td className="px-4 py-2 text-muted-foreground">{dateFrom}</td>
                  <td className="px-4 py-2 text-muted-foreground" colSpan={5}>Opening Balance</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">
                    {(ledger.openingBalance ?? 0) !== 0 && (
                      <span className={(ledger.openingBalance ?? 0) < 0 ? "text-red-600" : "text-green-600"}>
                        {(ledger.openingBalance ?? 0) < 0 ? "Cr " : "Dr "}₹{Math.abs(ledger.openingBalance ?? 0).toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period</td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{t.date}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{t.referenceType ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.partyName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{t.debit > 0 ? `₹${t.debit.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{t.credit > 0 ? `₹${t.credit.toFixed(2)}` : "—"}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${t.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                        {t.balance < 0 ? "Cr " : "Dr "}₹{Math.abs(t.balance).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {transactions.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 font-semibold text-sm text-right">Period Totals</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-blue-700">
                      ₹{transactions.reduce((s, t) => s + t.debit, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-orange-700">
                      ₹{transactions.reduce((s, t) => s + t.credit, 0).toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${(ledger.closingBalance ?? 0) < 0 ? "text-red-700" : "text-green-700"}`}>
                      {(ledger.closingBalance ?? 0) < 0 ? "Cr " : "Dr "}₹{Math.abs(ledger.closingBalance ?? 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
