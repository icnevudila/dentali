"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
} from "@/lib/charts/chart-tokens"

export type ChartPoint = { label: string; value: number; [key: string]: string | number }

type ChartFrameProps = {
  children: React.ReactNode
  height?: number
  className?: string
  empty?: boolean
  emptyLabel?: string
}

function ChartFrame({
  children,
  height = 220,
  className,
  empty,
  emptyLabel = "No data",
}: ChartFrameProps) {
  if (empty) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-neutral-400", className)}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className={cn("min-w-0 w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

type TrendLineProps = {
  data: ChartPoint[]
  dataKey?: string
  color?: string
  height?: number
  className?: string
  emptyLabel?: string
  valueFormatter?: (v: number) => string
}

export function TrendLine({
  data,
  dataKey = "value",
  color = CHART_COLORS.primary,
  height,
  className,
  emptyLabel,
  valueFormatter = (v) => String(v),
}: TrendLineProps) {
  const hasData = data.some((d) => Number(d[dataKey]) > 0)
  return (
    <ChartFrame height={height} className={className} empty={!hasData} emptyLabel={emptyLabel}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={CHART_AXIS.axisLine} tick={CHART_AXIS.tick} />
        <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS.tick} width={40} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [valueFormatter(Number(value)), ""]}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartFrame>
  )
}

type TrendAreaProps = TrendLineProps

export function TrendArea({
  data,
  dataKey = "value",
  color = CHART_COLORS.success,
  height,
  className,
  emptyLabel,
  valueFormatter = (v) => String(v),
}: TrendAreaProps) {
  const hasData = data.some((d) => Number(d[dataKey]) > 0)
  const fillId = `area-${color.replace("#", "")}`
  return (
    <ChartFrame height={height} className={className} empty={!hasData} emptyLabel={emptyLabel}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={CHART_AXIS.axisLine} tick={CHART_AXIS.tick} />
        <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS.tick} width={48} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [valueFormatter(Number(value)), ""]}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${fillId})`}
        />
      </AreaChart>
    </ChartFrame>
  )
}

type CompareBarProps = {
  data: ChartPoint[]
  dataKey?: string
  height?: number
  className?: string
  emptyLabel?: string
  colors?: string[]
  valueFormatter?: (v: number) => string
}

export function CompareBar({
  data,
  dataKey = "value",
  height,
  className,
  emptyLabel,
  colors = [...CHART_COLORS.series],
  valueFormatter = (v) => String(v),
}: CompareBarProps) {
  const hasData = data.some((d) => Number(d[dataKey]) > 0)
  return (
    <ChartFrame height={height} className={className} empty={!hasData} emptyLabel={emptyLabel}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={CHART_AXIS.axisLine} tick={CHART_AXIS.tick} />
        <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS.tick} width={40} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [valueFormatter(Number(value)), ""]}
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

export type FunnelStep = { label: string; value: number; color?: string }

type StatusFunnelProps = {
  steps: FunnelStep[]
  className?: string
  emptyLabel?: string
}

export function StatusFunnel({ steps, className, emptyLabel = "No data" }: StatusFunnelProps) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  const hasData = steps.some((s) => s.value > 0)
  if (!hasData) {
    return <p className="text-center text-sm text-neutral-400 py-8">{emptyLabel}</p>
  }
  return (
    <ul className={cn("space-y-2.5", className)}>
      {steps.map((step) => {
        const widthPct = Math.max((step.value / max) * 100, step.value > 0 ? 12 : 0)
        return (
          <li key={step.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-neutral-700">{step.label}</span>
              <span className="tabular-nums text-neutral-500">{step.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: step.color ?? CHART_COLORS.primary,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

type SparklineProps = {
  data: number[]
  color?: string
  className?: string
  width?: number
  height?: number
}

type DistributionPieProps = {
  data: ChartPoint[]
  dataKey?: string
  height?: number
  className?: string
  emptyLabel?: string
  colors?: string[]
  valueFormatter?: (v: number) => string
}

export function DistributionPie({
  data,
  dataKey = "value",
  height = 200,
  className,
  emptyLabel = "No data",
  colors = [...CHART_COLORS.series],
  valueFormatter = (v) => String(v),
}: DistributionPieProps) {
  const hasData = data.some((d) => Number(d[dataKey]) > 0)
  if (!hasData) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-neutral-400", className)}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value, _name, item) => [
              valueFormatter(Number(value)),
              String(item.payload?.label ?? ""),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({
  data,
  color = CHART_COLORS.primary,
  className,
  width = 96,
  height = 28,
}: SparklineProps) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
