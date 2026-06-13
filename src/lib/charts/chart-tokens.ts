/** Chart colors aligned with globals.css / design tokens — not default Recharts theme */

export const CHART_COLORS = {
  primary: "#0d9488",
  primaryMuted: "#99f6e4",
  success: "#16a34a",
  successMuted: "#86efac",
  warning: "#d97706",
  info: "#2563eb",
  danger: "#dc2626",
  neutral: "#9ca3af",
  neutralLight: "#e5e7eb",
  series: ["#0d9488", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777"],
} as const

export const CHART_GRID = {
  stroke: "#f3f4f6",
  strokeDasharray: "4 4",
} as const

export const CHART_AXIS = {
  tick: { fill: "#6b7280", fontSize: 11 },
  axisLine: { stroke: "#e5e7eb" },
} as const

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
    fontSize: "12px",
  },
} as const
