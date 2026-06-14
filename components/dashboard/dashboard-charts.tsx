"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";

type StatusDatum = {
  name: string;
  value: number;
  color: string;
};

type DemandDatum = {
  sku: string;
  name: string;
  demand: number;
};

type CategoryDatum = {
  category: string;
  value: number;
};

type SyncDatum = {
  entity: string;
  relativeTime: string;
  tone: "success" | "warning" | "danger";
};

type DashboardChartsProps = {
  statusData: StatusDatum[];
  totalSkus: number;
  topDemand: DemandDatum[];
  categoryValue: CategoryDatum[];
  syncActivity: SyncDatum[];
};

const syncToneClasses: Record<SyncDatum["tone"], string> = {
  success: "bg-[#F0FDF4] text-[#16A34A]",
  warning: "bg-[#FFFBEB] text-[#B45309]",
  danger: "bg-[#FDF2F2] text-[#CC2B2B]",
};

function DonutCenterLabel({
  viewBox,
  totalSkus,
}: {
  viewBox?: unknown;
  totalSkus: number;
}) {
  const box = viewBox as { cx?: number; cy?: number } | undefined;
  const cx = box?.cx;
  const cy = box?.cy;

  if (cx === undefined || cy === undefined) {
    return null;
  }

  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" className="fill-[#111111] text-2xl font-bold">
        {formatNumber(totalSkus)}
      </tspan>
      <tspan x={cx} dy="1.6em" className="fill-[#6B7280] text-xs">
        Total SKUs
      </tspan>
    </text>
  );
}

export function DashboardCharts({
  statusData,
  totalSkus,
  topDemand,
  categoryValue,
  syncActivity,
}: DashboardChartsProps) {
  const filteredStatus = statusData.filter((item) => item.value > 0);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="rounded-2xl bg-white p-6 shadow-card xl:col-span-1">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">
          Stock Status
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={filteredStatus}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              stroke="none"
            >
              {filteredStatus.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <Label
                content={(props) => (
                  <DonutCenterLabel
                    viewBox={props.viewBox}
                    totalSkus={totalSkus}
                  />
                )}
                position="center"
              />
            </Pie>
            <Tooltip
              formatter={(value) =>
                formatNumber(typeof value === "number" ? value : Number(value ?? 0))
              }
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
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-card xl:col-span-2">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">
          Top SKUs by Annual Demand
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={topDemand}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis
              type="category"
              dataKey="sku"
              width={100}
              tick={{ fontSize: 11, fill: "#6B7280" }}
            />
            <Tooltip
              formatter={(value, _name, item) => [
                formatNumber(typeof value === "number" ? value : Number(value ?? 0)),
                item?.payload?.name ?? "",
              ]}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
              }}
            />
            <Bar dataKey="demand" fill="#CC2B2B" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-card xl:col-span-2">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">
          Value by Category
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={categoryValue}
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip
              formatter={(value) =>
                formatCurrencyJMD(
                  typeof value === "number" ? value : Number(value ?? 0)
                )
              }
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
              }}
            />
            <Bar dataKey="value" fill="#F5A000" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-card xl:col-span-1">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">Last Sync</h2>
        <ul className="space-y-3">
          {syncActivity.length === 0 ? (
            <li className="text-sm text-[#6B7280]">No sync activity recorded</li>
          ) : (
            syncActivity.map((item) => (
              <li
                key={item.entity}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-[#111111]">{item.entity}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${syncToneClasses[item.tone]}`}
                >
                  {item.relativeTime}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
