import { useMemo } from 'react'

export interface BarDatum {
  label: string
  value: number
}

export interface BarChartProps {
  data: BarDatum[]
  ariaLabel: string
  height?: number
}

const WIDTH = 720
const LEFT = 36
const TOP = 12
const BOTTOM = 28

function niceMax(value: number): number {
  if (value <= 4) {
    return 4
  }
  const step = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / step) * step
}

export function BarChart({ data, ariaLabel, height = 220 }: BarChartProps) {
  const { max, bars, ticks } = useMemo(() => {
    const top = niceMax(Math.max(0, ...data.map((datum) => datum.value)))
    const plotWidth = WIDTH - LEFT - 8
    const plotHeight = height - TOP - BOTTOM
    const slot = data.length > 0 ? plotWidth / data.length : plotWidth
    return {
      max: top,
      bars: data.map((datum, index) => {
        const barHeight = (datum.value / top) * plotHeight
        return { ...datum, x: LEFT + index * slot + slot * 0.15, width: slot * 0.7, y: TOP + plotHeight - barHeight, height: barHeight }
      }),
      ticks: [0, top / 2, top].map((value) => ({ value, y: TOP + plotHeight - (value / top) * plotHeight })),
    }
  }, [data, height])

  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <figure className="bar-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={LEFT} x2={WIDTH - 8} y1={tick.y} y2={tick.y} className="bar-chart__grid" />
            <text x={LEFT - 6} y={tick.y + 4} textAnchor="end" className="bar-chart__axis">
              {tick.value}
            </text>
          </g>
        ))}
        {bars.map((bar, index) => (
          <g key={bar.label}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={Math.max(bar.height, bar.value > 0 ? 1 : 0)} rx={2} className="bar-chart__bar">
              <title>{`${bar.label}: ${bar.value}`}</title>
            </rect>
            {index % labelEvery === 0 ? (
              <text x={bar.x + bar.width / 2} y={height - 8} textAnchor="middle" className="bar-chart__axis">
                {bar.label.slice(5)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <figcaption className="visually-hidden">Highest bar represents up to {max} appointments in a day.</figcaption>
    </figure>
  )
}
