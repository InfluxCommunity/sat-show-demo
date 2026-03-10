import type {ComponentType} from 'react'

declare module 'recharts' {
  export const ResponsiveContainer: ComponentType<any>
  export const AreaChart: ComponentType<any>
  export const Area: ComponentType<any>
  export const XAxis: ComponentType<any>
  export const YAxis: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export const PieChart: ComponentType<any>
  export const Pie: ComponentType<any>
  export const Cell: ComponentType<any>
}
