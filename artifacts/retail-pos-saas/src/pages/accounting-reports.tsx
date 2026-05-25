import { useState } from "react";
import {
  useGetTrialBalance, getGetTrialBalanceQueryKey,
  useGetProfitLoss, getGetProfitLossQueryKey,
  useGetCashSummary, getGetCashSummaryQueryKey,
  useGetGstSummary, getGetGstSummaryQueryKey,
  useGetDayClosing, getGetDayClosingQueryKey,
  useListAccounts,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function today() { return new Date().toISOString().split("T")[0]!; }
function firstOfMonth() { return today().substring(0, 7) + "-01"; }

export default function AccountingReports() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [cashAccountId, setCashAccountId] = useState("");
  const [dayDate, setDayDate] = useState(today);
  const [activeTab, setActiveTab] = useState("trial-balance");

  const { data: accounts = [] } = useListAccounts({});
  const cashBankAccts = accounts.filter((a) => !a.isGroup && (a.type === "asset") && (a.code?.startsWith("11")));

  const tbParams = { dateFrom, dateTo };
  const { data: trialBalance = [], isLoading: tbLoading } = useGetTrialBalance(
    tbParams,
    { query: { enabled: activeTab === "trial-balance", queryKey: getGetTrialBalanceQueryKey(tbParams) } }
  );

  const plParams = { dateFrom, dateTo };
  const { data: pl, isLoading: plLoading } = useGetProfitLoss(
    plParams,
    { query: { enabled: activeTab === "profit-loss", queryKey: getGetProfitLossQueryKey(plParams) } }
  );

  const cashParams = { accountId: cashAccountId ? parseInt(cashAccountId) : undefined, dateFrom, dateTo };
  const { data: cash, isLoading: cashLoading } = useGetCashSummary(
    cashParams,
    { query: { enabled: activeTab === "cash-book", queryKey: getGetCashSummaryQueryKey(cashParams) } }
  );

  const gstParams = { dateFrom, dateTo };
  const { data: gst, isLoading: gstLoading } = useGetGstSummary(
    gstParams,
    { query: { enabled: activeTab === "gst", queryKey: getGetGstSummaryQueryKey(gstParams) } }
  );

  const dayParams = { date: dayDate };
  const { data: dayClose, isLoading: dayLoading } = useGetDayClosing(
    dayParams,
    { query: { enabled: activeTab === "day-closing", queryKey: getGetDayClosingQueryKey(dayParams) } }
  );

  const tbTotalDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
  const tbTotalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Trial Balance, P&amp;L, Cash Book, GST Summary &amp; Day Closing</p>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="profit-loss">P&amp;L</TabsTrigger>
          <TabsTrigger value="cash-book">Cash Book</TabsTrigger>
          <TabsTrigger value="gst">GST Summary</TabsTrigger>
          <TabsTrigger value="day-closing">Day Closing</TabsTrigger>
        </TabsList>

        {/* ─── Trial Balance ─────────────────────────────────────────────── */}
        <TabsContent value="trial-balance" className="mt-4">
          {tbLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
            <div className="rounded-lg border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Account Name</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Debit (₹)</th>
                    <th className="text-right px-4 py-3 font-medium">Credit (₹)</th>
                    <th className="text-right px-4 py-3 font-medium">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trialBalance.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No data for this period. Post journal entries first.</td></tr>
                  ) : trialBalance.map((r) => (
                    <tr key={r.accountId} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.code}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 capitalize text-xs text-muted-foreground">{r.type}</td>
                      <td className="px-4 py-2 text-right font-mono">₹{r.debit.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">₹{r.credit.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-right font-mono font-semibold ${r.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{Math.abs(r.balance).toFixed(2)} {r.balance < 0 ? "Cr" : "Dr"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {trialBalance.length > 0 && (
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 font-bold text-right">Grand Total</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-blue-700">₹{tbTotalDebit.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-orange-700">₹{tbTotalCredit.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-right font-mono font-bold ${Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        {Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? "✓ Balanced" : `Diff: ₹${Math.abs(tbTotalDebit - tbTotalCredit).toFixed(2)}`}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─── Profit & Loss ─────────────────────────────────────────────── */}
        <TabsContent value="profit-loss" className="mt-4">
          {plLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : !pl ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Total Income</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-green-600">₹{(pl.totalIncome ?? 0).toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Total Expenses</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-red-600">₹{(pl.totalExpenses ?? 0).toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Net Profit / (Loss)</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${(pl.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {(pl.netProfit ?? 0) < 0 && "("}₹{Math.abs(pl.netProfit ?? 0).toFixed(2)}{(pl.netProfit ?? 0) < 0 && ")"}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-card">
                  <div className="px-4 py-3 border-b bg-green-50 font-semibold text-green-700 text-sm">Income Accounts</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {pl.income.length === 0 ? (
                        <tr><td className="px-4 py-4 text-center text-muted-foreground text-xs">No income recorded</td></tr>
                      ) : pl.income.map((r) => (
                        <tr key={r.accountId} className="hover:bg-muted/20">
                          <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{r.code}</td>
                          <td className="px-4 py-2">{r.name}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-green-600">₹{r.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/20">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 font-bold text-right text-xs">Total</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-green-700">₹{(pl.totalIncome ?? 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="rounded-lg border bg-card">
                  <div className="px-4 py-3 border-b bg-red-50 font-semibold text-red-700 text-sm">Expense Accounts</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {pl.expenses.length === 0 ? (
                        <tr><td className="px-4 py-4 text-center text-muted-foreground text-xs">No expenses recorded</td></tr>
                      ) : pl.expenses.map((r) => (
                        <tr key={r.accountId} className="hover:bg-muted/20">
                          <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{r.code}</td>
                          <td className="px-4 py-2">{r.name}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">₹{Math.abs(r.balance).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/20">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 font-bold text-right text-xs">Total</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-red-700">₹{(pl.totalExpenses ?? 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Cash Book ─────────────────────────────────────────────────── */}
        <TabsContent value="cash-book" className="mt-4">
          <div className="mb-4 flex gap-3 items-end">
            <div>
              <Label className="text-xs">Cash / Bank Account</Label>
              <Select value={cashAccountId} onValueChange={setCashAccountId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Cash in Hand (default)" />
                </SelectTrigger>
                <SelectContent>
                  {cashBankAccts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {cashLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : !cash ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Opening Balance</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-bold">₹{cash.openingBalance.toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Cash In</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-bold text-green-600">₹{cash.totalIn.toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Cash Out</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-bold text-red-600">₹{cash.totalOut.toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Closing Balance</CardTitle></CardHeader>
                  <CardContent><div className={`text-lg font-bold ${cash.closingBalance < 0 ? "text-red-600" : "text-green-700"}`}>₹{cash.closingBalance.toFixed(2)}</div></CardContent>
                </Card>
              </div>
              <div className="rounded-lg border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-left px-4 py-3 font-medium">Ref</th>
                      <th className="text-right px-4 py-3 font-medium">In (₹)</th>
                      <th className="text-right px-4 py-3 font-medium">Out (₹)</th>
                      <th className="text-right px-4 py-3 font-medium">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(cash.transactions ?? []).length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period</td></tr>
                    ) : (cash.transactions ?? []).map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-muted-foreground">{t.date}</td>
                        <td className="px-4 py-2 max-w-xs truncate">{t.description}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{t.referenceType ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-mono text-green-600">{t.debit > 0 ? `₹${t.debit.toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-2 text-right font-mono text-red-600">{t.credit > 0 ? `₹${t.credit.toFixed(2)}` : "—"}</td>
                        <td className={`px-4 py-2 text-right font-mono font-semibold ${t.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                          ₹{t.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── GST Summary ───────────────────────────────────────────────── */}
        <TabsContent value="gst" className="mt-4">
          {gstLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : !gst ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Output GST (Sales)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">₹{gst.outputGst.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{gst.salesCount} invoices</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Input GST (ITC)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">₹{gst.inputGst.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{gst.purchaseCount} purchases</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Net GST Payable</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${gst.netPayable >= 0 ? "text-red-700" : "text-green-700"}`}>
                      ₹{Math.abs(gst.netPayable).toFixed(2)}
                      {gst.netPayable < 0 && <span className="text-sm ml-1">(Refundable)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{gst.dateFrom} to {gst.dateTo}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3">GST Reconciliation</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span>Output GST Collected (on Sales)</span>
                    <span className="font-mono font-semibold text-green-700">₹{gst.outputGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>(-) Input Tax Credit (on Purchases)</span>
                    <span className="font-mono font-semibold text-blue-700">₹{gst.inputGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-base">
                    <span>Net GST Payable</span>
                    <span className={`font-mono ${gst.netPayable >= 0 ? "text-red-700" : "text-green-700"}`}>
                      ₹{Math.abs(gst.netPayable).toFixed(2)} {gst.netPayable < 0 ? "(Refund)" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Day Closing ───────────────────────────────────────────────── */}
        <TabsContent value="day-closing" className="mt-4">
          <div className="mb-4 flex gap-3 items-end">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} className="w-40 h-9" />
            </div>
          </div>
          {dayLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : !dayClose ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Sales</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-green-700">₹{(dayClose.totalSales as number).toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{(dayClose.salesCount as number)} invoices</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Cash Sales</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">₹{(dayClose.totalCashSales as number).toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Expenses</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold text-red-600">₹{(dayClose.totalExpenses as number).toFixed(2)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Net Cash In</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold ${(dayClose.netCashIn as number) >= 0 ? "text-green-700" : "text-red-700"}`}>
                      ₹{(dayClose.netCashIn as number).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3">Payment Breakdown</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between p-3 rounded bg-muted/30">
                    <span>Cash</span><span className="font-mono font-semibold">₹{(dayClose.totalCashSales as number).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded bg-muted/30">
                    <span>Card</span><span className="font-mono font-semibold">₹{(dayClose.totalCardSales as number).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded bg-muted/30">
                    <span>UPI</span><span className="font-mono font-semibold">₹{(dayClose.totalUpiSales as number).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
