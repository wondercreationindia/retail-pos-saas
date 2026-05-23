import React from "react";
import { useGetCurrentTenant, getGetCurrentTenantQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const { data: tenant, isLoading } = useGetCurrentTenant({ query: { queryKey: getGetCurrentTenantQueryKey() } });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your store preferences</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading settings...</div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={tenant?.name || ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={tenant?.slug || ""} readOnly className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={tenant?.currency || "USD"} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={tenant?.timezone || "UTC"} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
