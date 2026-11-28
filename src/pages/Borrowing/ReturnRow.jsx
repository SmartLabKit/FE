import { Box, Paper, Typography } from '@mui/material'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'

/** Nhãn trạng thái dạng viên thuốc, nền nhạt cùng màu chữ. */
export function StatusPill({ status }) {
  if (!status) return null
  return (
    <Box
      component="span"
      sx={{
        px: 1.25,
        py: 0.35,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        color: status.color,
        bgcolor: `${status.color}14`,
      }}
    >
      {status.text}
    </Box>
  )
}

/** Một khung có tiêu đề (và số lượng) chứa các dòng ReturnRow. */
export function RowGroup({ title, count, children, footer, sx = {} }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid #e4e6ef', borderRadius: 2.5, overflow: 'hidden', ...sx }}>
      {title && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f5' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{title}</Typography>
          {count != null && (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#64748b' }}>{count}</Typography>
          )}
        </Box>
      )}
      <Box sx={{ px: 2.5 }}>{children}</Box>
      {footer && <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>{footer}</Box>}
    </Paper>
  )
}

/** Một dòng gọn: tên, dòng phụ xám, trạng thái bên phải; bấm được thì có mũi tên. */
export default function ReturnRow({ title, subtitle, status, before, after, onClick, selected = false }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.5,
        mx: -2.5,
        px: 2.5,
        borderBottom: '1px solid #eef0f5',
        '&:last-of-type': { borderBottom: 0 },
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: selected ? '#eff6ff' : 'transparent',
        transition: 'background-color 0.15s',
        '&:hover': onClick ? { bgcolor: selected ? '#e0edff' : '#f8fafc' } : undefined,
      }}
    >
      {before}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#1e293b', overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: 13, color: '#64748b', overflowWrap: 'anywhere' }}>{subtitle}</Typography>}
      </Box>
      <StatusPill status={status} />
      {after}
      {onClick && !before && <ChevronRightIcon sx={{ color: '#cbd5e1', fontSize: 20, ml: -0.5 }} />}
    </Box>
  )
}
