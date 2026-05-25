import React, { useState } from "react";
import {
  useListProducts, getListProductsQueryKey,
  useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListCategories, getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, X, Package } from "lucide-react";

type ProductStatus = "active" | "inactive" | "discontinued";

interface ProductForm {
  // Core
  name: string;
  description: string;
  sku: string;
  barcode: string;
  hsnCode: string;
  brand: string;
  unit: string;
  weight: string;
  size: string;
  color: string;
  // Pricing
  price: string;
  salePrice: string;
  mrp: string;
  purchasePrice: string;
  costPrice: string;
  gstRate: string;
  // Inventory
  stock: string;
  minStockAlert: string;
  maxStock: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  // Category
  categoryId: string;
  imageUrl: string;
  // E-commerce
  slug: string;
  seoTitle: string;
  seoDescription: string;
  publishOnline: boolean;
  featuredProduct: boolean;
  // Barcode printing
  barcodeType: string;
  labelWidth: string;
  labelHeight: string;
  // Status
  status: ProductStatus;
  isActive: boolean;
}

const emptyForm: ProductForm = {
  name: "", description: "", sku: "", barcode: "", hsnCode: "", brand: "",
  unit: "pcs", weight: "", size: "", color: "",
  price: "", salePrice: "", mrp: "", purchasePrice: "", costPrice: "", gstRate: "0",
  stock: "0", minStockAlert: "10", maxStock: "", trackInventory: true, allowNegativeStock: false,
  categoryId: "", imageUrl: "",
  slug: "", seoTitle: "", seoDescription: "", publishOnline: false, featuredProduct: false,
  barcodeType: "CODE128", labelWidth: "", labelHeight: "",
  status: "active", isActive: true,
};

type Tab = "core" | "pricing" | "inventory" | "ecommerce" | "barcode";

const TAB_LABELS: Record<Tab, string> = {
  core: "Product Info",
  pricing: "Pricing & Tax",
  inventory: "Inventory",
  ecommerce: "E-Commerce",
  barcode: "Barcode & Label",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-green-700 bg-green-50 border-green-200" },
  inactive: { label: "Inactive", className: "text-slate-600 bg-slate-50 border-slate-200" },
  discontinued: { label: "Discontinued", className: "text-red-600 bg-red-50 border-red-200" },
};

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [activeTab, setActiveTab] = useState<Tab>("core");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: products, isLoading } = useListProducts(
    { search: search || undefined, categoryId: categoryFilter ? Number(categoryFilter) : undefined },
    { query: { queryKey: getListProductsQueryKey({ search: search || undefined, categoryId: categoryFilter ? Number(categoryFilter) : undefined }) } },
  );
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  };

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setActiveTab("core");
    setModalOpen(true);
  }

  function openEdit(p: NonNullable<typeof products>[0]) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      hsnCode: p.hsnCode ?? "",
      brand: p.brand ?? "",
      unit: p.unit ?? "pcs",
      weight: p.weight != null ? String(p.weight) : "",
      size: p.size ?? "",
      color: p.color ?? "",
      price: String(p.price),
      salePrice: p.salePrice != null ? String(p.salePrice) : "",
      mrp: p.mrp != null ? String(p.mrp) : "",
      purchasePrice: p.purchasePrice != null ? String(p.purchasePrice) : "",
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      gstRate: p.gstRate != null ? String(p.gstRate) : "0",
      stock: String(p.stock),
      minStockAlert: p.minStockAlert != null ? String(p.minStockAlert) : "10",
      maxStock: p.maxStock != null ? String(p.maxStock) : "",
      trackInventory: p.trackInventory ?? false,
      allowNegativeStock: p.allowNegativeStock ?? false,
      categoryId: p.categoryId != null ? String(p.categoryId) : "",
      imageUrl: p.imageUrl ?? "",
      slug: p.slug ?? "",
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      publishOnline: p.publishOnline ?? false,
      featuredProduct: p.featuredProduct ?? false,
      barcodeType: p.barcodeType ?? "CODE128",
      labelWidth: p.labelWidth != null ? String(p.labelWidth) : "",
      labelHeight: p.labelHeight != null ? String(p.labelHeight) : "",
      status: (p.status as ProductStatus) ?? "active",
      isActive: p.isActive,
    });
    setEditId(p.id);
    setActiveTab("core");
    setModalOpen(true);
  }

  function f(v: string): number | undefined {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  function fi(v: string): number | undefined {
    const n = parseInt(v);
    return isNaN(n) ? undefined : n;
  }

  async function handleSave() {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      hsnCode: form.hsnCode || undefined,
      brand: form.brand || undefined,
      unit: form.unit || undefined,
      weight: f(form.weight),
      size: form.size || undefined,
      color: form.color || undefined,
      price: f(form.price) ?? 0,
      salePrice: f(form.salePrice),
      mrp: f(form.mrp),
      purchasePrice: f(form.purchasePrice),
      costPrice: f(form.costPrice),
      gstRate: f(form.gstRate),
      stock: fi(form.stock) ?? 0,
      minStockAlert: fi(form.minStockAlert),
      maxStock: fi(form.maxStock),
      trackInventory: form.trackInventory,
      allowNegativeStock: form.allowNegativeStock,
      categoryId: fi(form.categoryId) ?? null,
      imageUrl: form.imageUrl || undefined,
      slug: form.slug || undefined,
      seoTitle: form.seoTitle || undefined,
      seoDescription: form.seoDescription || undefined,
      publishOnline: form.publishOnline,
      featuredProduct: form.featuredProduct,
      barcodeType: form.barcodeType || undefined,
      labelWidth: f(form.labelWidth),
      labelHeight: f(form.labelHeight),
      status: form.status,
      isActive: form.isActive,
    };

    if (editId) {
      await updateMutation.mutateAsync({ id: editId, data: payload });
    } else {
      await createMutation.mutateAsync({ data: payload as Parameters<typeof createMutation.mutateAsync>[0]["data"] });
    }
    invalidate();
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    invalidate();
    setDeleteId(null);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU / Barcode</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>GST %</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading products...</TableCell></TableRow>
              ) : !products?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="w-8 h-8" />
                      <p>No products yet. Click "Add Product" to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => {
                  const minAlert = p.minStockAlert ?? 10;
                  const isLowStock = p.stock < minAlert;
                  const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE["active"];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-mono text-xs text-muted-foreground">{p.sku || "—"}</div>
                        {p.barcode && <div className="font-mono text-xs text-muted-foreground/60">{p.barcode}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.hsnCode && <div className="text-xs text-muted-foreground">HSN: {p.hsnCode}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{p.brand || "—"}</TableCell>
                      <TableCell className="text-sm">{p.mrp != null ? `₹${p.mrp.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-sm font-medium">₹{p.price.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{p.gstRate != null ? `${p.gstRate}%` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={isLowStock ? "text-red-600 font-semibold" : ""}>{p.stock}</span>
                          {isLowStock && <Badge variant="destructive" className="text-xs">Low</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">{editId ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b overflow-x-auto shrink-0">
              {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {activeTab === "core" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Product Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Espresso" />
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="BEV-001" />
                  </div>
                  <div>
                    <Label>Barcode</Label>
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="8901234567890" />
                  </div>
                  <div>
                    <Label>HSN Code</Label>
                    <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="0901" />
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand name" />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["pcs", "kg", "g", "litre", "ml", "box", "pack", "dozen", "meter", "sqft"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0.5" />
                  </div>
                  <div>
                    <Label>Size</Label>
                    <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="L / XL / 32" />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Red" />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProductStatus, isActive: v === "active" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Image URL</Label>
                    <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sale Price (₹) *</Label>
                    <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>MRP (₹)</Label>
                    <Input type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Purchase Price (₹)</Label>
                    <Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Cost Price (₹)</Label>
                    <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Offer / Sale Price (₹)</Label>
                    <Input type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>GST Rate (%)</Label>
                    <Select value={form.gstRate} onValueChange={(v) => setForm({ ...form, gstRate: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["0", "5", "12", "18", "28"].map((r) => (
                          <SelectItem key={r} value={r}>{r}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.price && form.purchasePrice && (
                    <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
                      <span className="font-medium">Margin: </span>
                      {(() => {
                        const sp = parseFloat(form.price);
                        const cp = parseFloat(form.purchasePrice);
                        const margin = sp > 0 ? (((sp - cp) / sp) * 100).toFixed(1) : "0";
                        return <span className="text-green-600 font-semibold">{margin}%</span>;
                      })()}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "inventory" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Current Stock</Label>
                    <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <Label>Min Stock Alert</Label>
                    <Input type="number" value={form.minStockAlert} onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })} placeholder="10" />
                  </div>
                  <div>
                    <Label>Max Stock</Label>
                    <Input type="number" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} placeholder="500" />
                  </div>
                  <div className="col-span-2 space-y-3 mt-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.trackInventory} onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium">Track inventory for this product</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.allowNegativeStock} onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.checked })} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium">Allow selling when out of stock</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === "ecommerce" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>URL Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="espresso-coffee" />
                  </div>
                  <div className="col-span-2">
                    <Label>SEO Title</Label>
                    <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} placeholder="Best Espresso Coffee" />
                  </div>
                  <div className="col-span-2">
                    <Label>SEO Description</Label>
                    <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} placeholder="Meta description..." />
                  </div>
                  <div className="col-span-2 space-y-3 mt-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.publishOnline} onChange={(e) => setForm({ ...form, publishOnline: e.target.checked })} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium">Publish on online store</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.featuredProduct} onChange={(e) => setForm({ ...form, featuredProduct: e.target.checked })} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium">Featured product</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === "barcode" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Barcode Type</Label>
                    <Select value={form.barcodeType} onValueChange={(v) => setForm({ ...form, barcodeType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["CODE128", "EAN13", "EAN8", "UPC", "QR", "CODE39"].map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                  <div>
                    <Label>Label Width (mm)</Label>
                    <Input type="number" value={form.labelWidth} onChange={(e) => setForm({ ...form, labelWidth: e.target.value })} placeholder="50" />
                  </div>
                  <div>
                    <Label>Label Height (mm)</Label>
                    <Input type="number" value={form.labelHeight} onChange={(e) => setForm({ ...form, labelHeight: e.target.value })} placeholder="30" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !form.name || !form.price}>
                {isSaving ? "Saving..." : editId ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">Delete Product?</h3>
            <p className="text-sm text-muted-foreground">This product will be marked as deleted and hidden from the catalog. This action can be reversed from the database.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
