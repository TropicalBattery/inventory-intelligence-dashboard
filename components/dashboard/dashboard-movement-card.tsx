"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";
import type {
  InventoryTrendPoint,
  MonthlySalesTrendPoint,
} from "@/lib/queries/dashboard-trends";

type DashboardMovementCardProps = {
  salesTrend: MonthlySalesTrendPoint[];
  inventoryTrend: InventoryTrendPoint[];
};

type ChartRow = {
  month: string;
  label: string;
  salesUnits: number | null;
  inventoryUnits: number | null;
};

const SALES_COLOR = "#CC2B2B";
const INVENTORY_COLOR = "#F5A000";

function formatMonthLabel(monthIso: string): string {
  const parsed = Date.parse(monthIso);
  if (Number.isNaN(parsed)) {
    return monthIso;
  }
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function formatMonthCaption(monthIso: string): string {
  const parsed = Date.parse(monthIso);
  if (Number.isNaN(parsed)) {
    return monthIso;
  }
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function computeSalesMomDelta(
  salesTrend: MonthlySalesTrendPoint[]
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (salesTrend.length < 2) {
    return null;
  }
  const latest = salesTrend[salesTrend.length - 1]!.units;
  const prior = salesTrend[salesTrend.length - 2]!.units;
  if (!(prior > 0)) {
    return null;
  }
  const pct = ((latest - prior) / prior) * 100;
  if (Math.abs(pct) < 0.05) {
    return { pct: 0, direction: "flat" };
  }
  return { pct, direction: pct > 0 ? "up" : "down" };
}

function buildChartRows(
  salesTrend: MonthlySalesTrendPoint[],
  inventoryTrend: InventoryTrendPoint[]
): ChartRow[] {
  const inventoryByMonth = new Map(
    inventoryTrend.map((p) => [p.month, p.unitsOnHand] as const)
  );
  const salesByMonth = new Map(salesTrend.map((p) => [p.month, p.units] as const));

  const months = new Set<string>();
  for (const p of salesTrend) {
    months.add(p.month);
  }
  for (const p of inventoryTrend) {
    months.add(p.month);
  }

  return Array.from(months)
    .sort()
    .map((month) => ({
      month,
      label: formatMonthLabel(month),
      salesUnits: salesByMonth.has(month) ? salesByMonth.get(month)! : null,
      inventoryUnits: inventoryByMonth.has(month)
        ? inventoryByMonth.get(month)!
        : null,
    }));
}

export function DashboardMovementCard({
  salesTrend,
  inventoryTrend,
}: DashboardMovementCardProps) {
  const mom = useMemo(() => computeSalesMomDelta(salesTrend), [salesTrend]);
  const chartRows = useMemo(
    () => buildChartRows(salesTrend, inventoryTrend),
    [salesTrend, inventoryTrend]
  );

  const showInventorySeries = inventoryTrend.length > 0;
  const inventoryCaption =
    inventoryTrend.length === 0
      ? "Inventory tracking begins next cycle."
      : inventoryTrend.length === 1
        ? `Inventory tracking started ${formatMonthCaption(inventoryTrend[0]!.month)} - this line fills in each month.`
        : null;

  if (salesTrend.length < 2) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-[#111111]">
          Movement (Month over Month)
        </h2>
        <p className="text-sm text-[#6B7280]">Not enough sales data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#111111]">
          Movement (Month over Month)
        </h2>
        {mom ? (
          <p
            className={`text-sm font-medium tabular-nums ${
              mom.direction === "up"
                ? "text-[#16A34A]"
                : mom.direction === "down"
                  ? "text-[#CC2B2B]"
                  : "text-[#6B7280]"
            }`}
            title="Sales units: latest completed month vs prior"
          >
            {mom.direction === "up" ? "▲" : mom.direction === "down" ? "▼" : "●"}{" "}
            {Math.abs(mom.pct).toLocaleString("en-JM", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 0,
            })}
            % sales MoM
          </p>
        ) : null}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={chartRows}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            interval={0}
          />
          <YAxis
            yAxisId="sales"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            tickFormatter={(value) =>
              formatNumber(typeof value === "number" ? value : Number(value ?? 0))
            }
          />
          {showInventorySeries ? (
            <YAxis
              yAxisId="inventory"
              orientation="right"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickFormatter={(value) =>
                formatNumber(
                  typeof value === "number" ? value : Number(value ?? 0)
                )
              }
            />
          ) : null}
          <Tooltip
            formatter={(value, name) => {
              const n =
                typeof value === "number" ? value : Number(value ?? 0);
              if (!Number.isFinite(n)) {
                return ["-", String(name)];
              }
              return [formatNumber(n), String(name)];
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-[#6B7280]">{value}</span>
            )}
          />
          <Bar
            yAxisId="sales"
            dataKey="salesUnits"
            name="Sales units"
            fill={SALES_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          {showInventorySeries ? (
            <Line
              yAxisId="inventory"
              type="monotone"
              dataKey="inventoryUnits"
              name="Inventory on hand"
              stroke={INVENTORY_COLOR}
              strokeWidth={2.5}
              dot={{ r: 5, fill: INVENTORY_COLOR, strokeWidth: 0 }}
              connectNulls={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>

      {inventoryCaption ? (
        <p className="mt-3 text-xs text-[#6B7280]">{inventoryCaption}</p>
      ) : null}
    </div>
  );
}
