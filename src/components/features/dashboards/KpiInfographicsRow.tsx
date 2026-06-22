import { RefreshCw, DollarSign, Users, ShoppingCart, TrendingUp, BarChart2, Package, Star, Activity, Target, Zap } from "lucide-react";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import type { KpiQueryDescriptor } from "../../../services/api";

interface KpiInfographicsRowProps {
  descriptors: KpiQueryDescriptor[];
  values: Record<string, number | null>;
  errors: Record<string, boolean>;
  isLoading: boolean;
  generationError: string | null;
  onRefresh: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  BarChart2,
  Package,
  Star,
  Activity,
  Target,
  Zap,
};

function formatValue(value: number | null, format: KpiQueryDescriptor["format"]): string {
  if (value === null || value === undefined) return "—";

  switch (format) {
    case "currency": {
      const abs = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
      if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
      return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    case "percentage":
      return `${Number(value).toFixed(1)}%`;
    case "decimal":
      return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "number":
    default: {
      const abs = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
      return `${sign}${Math.round(abs).toLocaleString()}`;
    }
  }
}

export function KpiInfographicsRow({
  descriptors,
  values,
  errors,
  isLoading,
  generationError,
  onRefresh,
}: KpiInfographicsRowProps) {
  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">KPI Metrics</span>
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-6 flex-1 min-w-[180px] border border-border">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (generationError) {
    return (
      <div className="mb-8 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive flex items-center justify-between">
        <span>Could not generate KPI metrics: {generationError}</span>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="text-destructive hover:text-destructive">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!descriptors || descriptors.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">KPI Metrics</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Refresh KPI values"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        {descriptors.map((kpi) => {
          const IconComponent = ICON_MAP[kpi.icon] ?? Activity;
          const rawValue = values[kpi.label];
          const hasError = errors[kpi.label];
          const isLoadingValue = !(kpi.label in values) && !hasError;

          return (
            <Card
              key={kpi.label}
              className="p-5 border border-border flex-1 min-w-[180px] flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium truncate pr-2">
                  {kpi.label}
                </p>
                <div className="shrink-0 rounded-full bg-primary/10 p-1.5">
                  <IconComponent className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>

              {isLoadingValue ? (
                <Skeleton className="h-8 w-24 my-0.5" />
              ) : (
                <p
                  className={`text-3xl font-semibold tracking-tight ${hasError ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {hasError ? "—" : formatValue(rawValue, kpi.format)}
                </p>
              )}

              <p className="text-xs text-muted-foreground truncate">{kpi.subtitle}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
