import { Box, Tooltip, Typography } from '@mui/material'
import { CHART_COLORS, niceStep } from './reportFormat'

// Biểu đồ vẽ bằng SVG thuần (dự án chỉ dùng @mui/material, không thêm thư viện chart).
// Cách thể hiện bám theo app mobile: donut chia tỉ lệ và biểu đồ cột có lưới trục Y.

/** Chấm màu + nhãn cho chú thích biểu đồ. */
export function LegendDot({ label, color }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: 12, color: '#424754' }}>{label}</Typography>
    </Box>
  )
}

/**
 * Donut thể hiện tổng được chia thành các phần, kèm chú thích bên dưới.
 * 5 phần lớn nhất có lát riêng, phần còn lại gộp thành "Khác".
 * parts: [{ name, value }]
 */
export function ShareDonut({ title, parts = [], format, emptyText = 'Không có dữ liệu.' }) {
  const sorted = [...parts].sort((a, b) => b.value - a.value)
  const slices = sorted.slice(0, 5)
  const rest = sorted.slice(5).reduce((sum, part) => sum + part.value, 0)
  if (rest > 0) slices.push({ name: 'Khác', value: rest })
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  // Mỗi lát là 1 vòng tròn dùng stroke-dasharray: độ dài nét = tỉ lệ của lát trên chu vi,
  // dịch điểm bắt đầu bằng tổng tỉ lệ các lát trước (bắt đầu từ 12 giờ, theo chiều kim đồng hồ).
  const size = 180
  const thickness = 34
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const fractions = slices.map((slice) => (total > 0 ? slice.value / total : 0))
  const arcs = slices.map((slice, index) => {
    const fraction = fractions[index]
    const offset = fractions.slice(0, index).reduce((sum, value) => sum + value, 0)
    const midAngle = (offset + fraction / 2) * 2 * Math.PI - Math.PI / 2
    const arc = {
      ...slice,
      color: CHART_COLORS[index % CHART_COLORS.length],
      fraction,
      dash: `${fraction * circumference} ${circumference}`,
      dashOffset: -offset * circumference,
      labelX: size / 2 + radius * Math.cos(midAngle),
      labelY: size / 2 + radius * Math.sin(midAngle),
    }
    return arc
  })

  return (
    <Box sx={{ p: 2 }}>
      {title && <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#334155', mb: 1 }}>{title}</Typography>}
      {total <= 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{emptyText}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
              <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                {arcs.map((arc) => (
                  <Tooltip key={arc.name} title={`${arc.name}: ${format(arc.value)}`} arrow>
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={thickness}
                      strokeDasharray={arc.dash}
                      strokeDashoffset={arc.dashOffset}
                      style={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                ))}
              </g>
              {/* Chỉ ghi % trên lát đủ lớn (>= 6%) để chữ không đè nhau */}
              {arcs.filter((arc) => arc.fraction >= 0.06).map((arc) => (
                <text
                  key={arc.name}
                  x={arc.labelX}
                  y={arc.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={11}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {Math.round(arc.fraction * 100)}%
                </text>
              ))}
            </svg>
          </Box>
          <Box sx={{ mt: 2 }}>
            {arcs.map((arc) => (
              <Box key={arc.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: arc.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, color: '#424754', flexGrow: 1, minWidth: 0 }} noWrap>{arc.name}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{format(arc.value)}</Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

/**
 * Biểu đồ cột dọc (1 hoặc nhiều series cạnh nhau trong mỗi nhóm).
 * - categories: nhãn trục X, ví dụ ['T1', 'T2'] hoặc mã lớp
 * - series: [{ name, color, values: number[] }] (values cùng độ dài với categories)
 * - formatAxis: định dạng nhãn trục Y; tooltip(categoryIndex, seriesIndex) trả về nội dung khi rê chuột vào cột
 */
export function BarChart({ categories, series, formatAxis = (value) => String(Math.round(value)), minStep = 1, tooltip, legend = false }) {
  const gridLines = 4
  const highest = Math.max(0, ...series.flatMap((item) => item.values))
  const step = niceStep(highest / gridLines, minStep)
  const maxY = step * gridLines

  // Khung vẽ cố định theo đơn vị viewBox, SVG co giãn theo bề rộng khung chứa
  const height = 220
  const left = 48
  const right = 12
  const top = 12
  const bottom = 28
  const width = Math.max(560, categories.length * 56 + left + right)
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const groupWidth = plotWidth / Math.max(categories.length, 1)
  const barWidth = Math.min(categories.length > 8 ? 12 : 24, (groupWidth * 0.7) / series.length)
  const barsSpace = 4
  const y = (value) => top + plotHeight - (value / maxY) * plotHeight

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" style={{ display: 'block', maxHeight: 260 }}>
        {Array.from({ length: gridLines + 1 }, (_, index) => {
          const value = step * index
          return (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e4e6ef" strokeWidth={1} />
              <text x={left - 6} y={y(value)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#697386">
                {formatAxis(value)}
              </text>
            </g>
          )
        })}
        {categories.map((category, categoryIndex) => {
          const groupBarsWidth = series.length * barWidth + (series.length - 1) * barsSpace
          const startX = left + categoryIndex * groupWidth + (groupWidth - groupBarsWidth) / 2
          return (
            <g key={`${category}-${categoryIndex}`}>
              {series.map((item, seriesIndex) => {
                const value = item.values[categoryIndex] || 0
                const barHeight = Math.max(0, y(0) - y(value))
                return (
                  <Tooltip key={item.name} title={tooltip ? tooltip(categoryIndex, seriesIndex) : ''} arrow>
                    <rect
                      x={startX + seriesIndex * (barWidth + barsSpace)}
                      y={y(0) - barHeight}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      fill={item.color}
                      style={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                )
              })}
              <text
                x={left + categoryIndex * groupWidth + groupWidth / 2}
                y={height - bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="#697386"
              >
                {category.length > 12 ? `${category.slice(0, 11)}…` : category}
              </text>
            </g>
          )
        })}
      </svg>
      {legend && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
          {series.map((item) => <LegendDot key={item.name} label={item.name} color={item.color} />)}
        </Box>
      )}
    </Box>
  )
}
