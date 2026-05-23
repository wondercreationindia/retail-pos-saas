import React from "react";
import { useListCategories, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Categories() {
  const { data: categories, isLoading } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground">Manage product categories</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories?.map((cat) => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="h-2 w-full" style={{ backgroundColor: cat.color || 'var(--primary)' }} />
              <CardHeader>
                <CardTitle>{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{cat.description || "No description"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
