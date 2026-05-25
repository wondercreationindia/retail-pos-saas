import React, { useState } from "react";
import {
  useGetInventoryOverview, useGetLowStockProducts,
  useListStockAdjustments, useCreateStockAdjustment,
  useListStockTransfers, useCreateStockTransfer,
  getGetInventoryOverviewQueryKey, getGetLowStockProductsQueryKey,
  getListStockAdjustmentsQueryKey, getListStockTransfersQueryKey,
} from "@workspace/api-client-react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, TrendingUp, DollarSign, ArrowUpDown, PlusCircle, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADJUSTMENT_TYPES = [
  { value: "add", label: "Add Stock" },
  { value: "remove", label: "Remove Stock" },
  { value: "recount", label: "Stock Recount" },
  { value: "damage", label: "Damaged" },
  { value: "expiry", label: "Expired" },
];

const LOG_TYPE_BADGE: Record<string, string> = {
  stock_in: "bg-green-100 text-green-800",
  stock_out: "bg-red-100 text-red-800",
  adjustment: "bg-blue-100 text-blue-800",
  transfer_in: "bg-purple-100 text-purple-800",
  transfer_out: "bg-orange-100 text-orange-800",
  damage: "bg-rose-100 text-rose-800",
  expiry: "bg-yellow-100 text-yellow-800",
  recount: "bg-gray-100 text-gray-800",
};

export default function Inventory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adjOpen, setAdjOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useGetInventoryOverview({
    query: { queryKey: getGetInventoryOverviewQueryKey() },
  });
  const { data: lowStock } = useGetLowStockProducts({
    query: { queryKey: getGetLowStockProductsQueryKey() },
  });
  const { data: adjustments } = useListStockAdjustments(
    { limit: 30, offset: 0 },
    { query: { queryKey: getListStockAdjustmentsQueryKey({ limit: 30, offset: 0 }) } },
  );
  const { data: transfers } = useListStockTransfers(
    { query: { queryKey: getListStockTransfersQueryKey() } },
  );
  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } },
  );

  const createAdj = useCreateStockAdjustment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStockAdjustmentsQueryKey({ limit: 30, offset: 0 }) });
        qc.invalidateQueries({ queryKey: getGetInventoryOverviewQueryKey() });
        qc.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        setAdjOpen(false);
        setAdjForm({ productId: "", adjustmentType: "add", quantity: "", reason: "", notes: "" });
        toast({ title: "Stock adjusted successfully" });
      },
      onError: (e: unknown) => {
        const msg = (e as { message?: string })?.message ?? "Failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  const createTransfer = useCreateStockTransfer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStockTransfersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetInventoryOverviewQueryKey() });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        setTransOpen(false);
        setTransForm({ productId: "", fromLocation: "main", toLocation: "", quantity: "", notes: "" });
        toast({ title: "Stock transferred successfully" });
      },
      onError: (e: unknown) => {
        const msg = (e as { message?: string })?.message ?? "Failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  const [adjForm, setAdjForm] = useState({ productId: "", adjustmentType: "add", quantity: "", reason: "", notes: "" });
  const [transForm, setTransForm] = useState({ productId: "", fromLocation: "main", toLocation: "", quantity: "", notes: "" });

  const handleAdj = () => {
    if (!adjForm.productId || !adjForm.quantity) return;
    createAdj.mutate({
      data: {
        productId: Number(adjForm.productId),
        adjustmentType: adjForm.adjustmentType as "add" | "remove" | "damage" | "expiry" | "recount",
        quantity: Number(adjForm.quantity),
        reason: adjForm.reason || undefined,
        notes: adjForm.notes || undefined,
      },
    });
  };

  const handleTransfer = () => {
    if (!transForm.productId || !transForm.toLocation || !transForm.quantity) return;
    createTransfer.mutate({
      data: {
        productId: Number(transForm.productId),
        fromLocation: transForm.fromLocation,
        toLocation: transForm.toLocation,
        quantity: Number(transForm.quantity),
        notes: transForm.notes || undefined,
      },
    });
  };

  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Stock management, adjustments and transfers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer Stock
          </Button>
          <Button onClick={() => setAdjOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Adjust Stock
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Products", value: overview?.totalProducts ?? 0, icon: <Package className="h-4 w-4 text-blue-500" /> },
          { label: "Active", value: overview?.activeProducts ?? 0, icon: <Package className="h-4 w-4 text-green-500" /> },
          { label: "Low Stock", value: overview?.lowStockProducts ?? 0, icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
          { label: "Out of Stock", value: overview?.outOfStock ?? 0, icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
          { label: "Stock Value", value: `₹${fmt(overview?.totalStockValue ?? 0)}`, icon: <DollarSign className="h-4 w-4 text-purple-500" />, wide: true },
          { label: "Retail Value", value: `₹${fmt(overview?.totalRetailValue ?? 0)}`, icon: <TrendingUp className="h-4 w-4 text-teal-500" />, wide: true },
        ].map((card) => (
          <Card key={card.label} className={card.wide ? "col-span-2 md:col-span-1" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                {card.icon}
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <div className="text-xl font-bold">{overviewLoading ? "—" : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="low-stock">
        <TabsList>
          <TabsTrigger value="low-stock">Low Stock ({lowStock?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        {/* Low Stock */}
        <TabsContent value="low-stock">
          <Card>
            <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!lowStock?.length ? (
                <div className="text-center py-10 text-muted-foreground">All products are well-stocked</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min Alert</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                        <TableCell className="font-bold text-red-600">{p.stock}</TableCell>
                        <TableCell>{p.minStockAlert}</TableCell>
                        <TableCell>
                          {p.stock === 0
                            ? <Badge variant="destructive">Out of Stock</Badge>
                            : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Low Stock</Badge>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments */}
        <TabsContent value="adjustments">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Stock Adjustments</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!adjustments?.length ? (
                <div className="text-center py-10 text-muted-foreground">No adjustments yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments?.map((a) => {
                      const prod = products?.find((p) => p.id === a.productId);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{prod?.name ?? `#${a.productId}`}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{a.adjustmentType}</Badge>
                          </TableCell>
                          <TableCell className={a.adjustmentType === "add" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {a.adjustmentType === "add" || a.adjustmentType === "recount" ? "+" : "-"}{a.quantity}
                          </TableCell>
                          <TableCell>{a.beforeQuantity}</TableCell>
                          <TableCell>{a.afterQuantity}</TableCell>
                          <TableCell className="text-muted-foreground">{a.reason ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfers */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader><CardTitle className="text-base">Stock Transfers</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!transfers?.length ? (
                <div className="text-center py-10 text-muted-foreground">No transfers yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers?.map((t) => {
                      const prod = products?.find((p) => p.id === t.productId);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-sm">{t.transferNumber}</TableCell>
                          <TableCell className="font-medium">{prod?.name ?? `#${t.productId}`}</TableCell>
                          <TableCell>{t.fromLocation}</TableCell>
                          <TableCell>{t.toLocation}</TableCell>
                          <TableCell>{t.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={t.status === "completed" ? "default" : "secondary"} className="capitalize">{t.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Modal */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Product *</Label>
              <Select value={adjForm.productId || "none"} onValueChange={(v) => setAdjForm({ ...adjForm, productId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select product…</SelectItem>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} (Stock: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Adjustment Type *</Label>
              <Select value={adjForm.adjustmentType} onValueChange={(v) => setAdjForm({ ...adjForm, adjustmentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min="0" step="1" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="Why are you adjusting stock?" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} placeholder="Additional notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancel</Button>
            <Button onClick={handleAdj} disabled={createAdj.isPending}>
              {createAdj.isPending ? "Saving…" : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Modal */}
      <Dialog open={transOpen} onOpenChange={setTransOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Product *</Label>
              <Select value={transForm.productId || "none"} onValueChange={(v) => setTransForm({ ...transForm, productId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select product…</SelectItem>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} (Stock: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From Location</Label>
                <Input value={transForm.fromLocation} onChange={(e) => setTransForm({ ...transForm, fromLocation: e.target.value })} placeholder="main" />
              </div>
              <div>
                <Label>To Location *</Label>
                <Input value={transForm.toLocation} onChange={(e) => setTransForm({ ...transForm, toLocation: e.target.value })} placeholder="warehouse-2" />
              </div>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min="0" step="1" value={transForm.quantity} onChange={(e) => setTransForm({ ...transForm, quantity: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={transForm.notes} onChange={(e) => setTransForm({ ...transForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={createTransfer.isPending}>
              {createTransfer.isPending ? "Transferring…" : "Transfer Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
