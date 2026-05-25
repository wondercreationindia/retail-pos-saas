import React, { useState, useEffect } from "react";
import {
  useGetCurrentTenant,
  useUpdateTenant,
  getGetCurrentTenantQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, DollarSign, Clock, Building2 } from "lucide-react";

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "IST — India Standard Time (UTC+5:30)" },
  { value: "Asia/Dubai", label: "GST — Gulf Standard Time (UTC+4)" },
  { value: "Europe/London", label: "GMT/BST — London (UTC+0/+1)" },
  { value: "America/New_York", label: "EST/EDT — New York (UTC-5/-4)" },
  { value: "America/Chicago", label: "CST/CDT — Chicago (UTC-6/-5)" },
  { value: "America/Los_Angeles", label: "PST/PDT — Los Angeles (UTC-8/-7)" },
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
];

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tenant, isLoading } = useGetCurrentTenant({ query: { queryKey: getGetCurrentTenantQueryKey() } });
  const updateTenant = useUpdateTenant();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? "");
      setCurrency(tenant.currency ?? "INR");
      setTimezone(tenant.timezone ?? "Asia/Kolkata");
      setDirty(false);
    }
  }, [tenant]);

  const handleSave = async () => {
    try {
      await updateTenant.mutateAsync({ data: { name, currency, timezone } });
      qc.invalidateQueries({ queryKey: getGetCurrentTenantQueryKey() });
      toast({ title: "Settings saved successfully" });
      setDirty(false);
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  const currencyPreview = CURRENCIES.find((c) => c.code === currency);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your store preferences and localization</p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={updateTenant.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {updateTenant.isPending ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading settings…</div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          {/* Business Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Business Name</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true); }}
                  placeholder="Your store name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (read-only)</Label>
                <Input value={tenant?.slug ?? ""} readOnly className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Your store's unique identifier — cannot be changed.</p>
              </div>
            </CardContent>
          </Card>

          {/* Currency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />Currency & Formatting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Store Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => { setCurrency(e.target.value); setDirty(true); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              {currencyPreview && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Preview</div>
                  <div className="font-mono text-lg font-bold">
                    {currencyPreview.symbol}1,234.56
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Currency code: <strong>{currencyPreview.code}</strong> · Symbol: <strong>{currencyPreview.symbol}</strong>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                <strong>Supported currencies:</strong> INR (Indian Rupee), USD (US Dollar), AED (UAE Dirham), EUR (Euro).
                Changing the currency affects how amounts are displayed throughout the POS. Existing sales are not recalculated.
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />Timezone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Store Timezone</Label>
                <select
                  value={timezone}
                  onChange={(e) => { setTimezone(e.target.value); setDirty(true); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Used for date/time display in invoices and reports.
                Currently: <strong>{new Date().toLocaleString("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}</strong>
              </p>
            </CardContent>
          </Card>

          {/* GST/India */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />India / GST Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This POS is GST-ready with Indian invoice formatting:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Product-level GST rates (0%, 5%, 12%, 18%, 28%)</li>
                  <li>GST amount shown separately on thermal and A4 invoices</li>
                  <li>Indian number formatting (₹1,23,456.78)</li>
                  <li>WhatsApp-ready invoice text in Indian English</li>
                  <li>Loyalty points (1 pt per ₹100; 1 pt = ₹1)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {dirty && (
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={updateTenant.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {updateTenant.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => {
                if (tenant) {
                  setName(tenant.name ?? "");
                  setCurrency(tenant.currency ?? "INR");
                  setTimezone(tenant.timezone ?? "Asia/Kolkata");
                  setDirty(false);
                }
              }}>
                Discard
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
