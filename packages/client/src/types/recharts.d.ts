import type {ComponentType} from 'react'

declare module 'recharts' {
  type Props = Record<string, unknown>
  export const ResponsiveContainer: ComponentType<Props>
  export const AreaChart: ComponentType<Props>
  export const Area: ComponentType<Props>
  export const XAxis: ComponentType<Props>
  export const YAxis: ComponentType<Props>
  export const Tooltip: ComponentType<Props>
  export const PieChart: ComponentType<Props>
  export const Pie: ComponentType<Props>
  export const Cell: ComponentType<Props>
  export const BarChart: ComponentType<Props>
  export const Bar: ComponentType<Props>
}
