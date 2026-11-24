import { Box, Chip } from '@mui/material'

const labels = {
  Draft: 'Bản nháp',
  Submitted: 'Chờ GV duyệt',
  Rejected: 'Bị từ chối',
  Approved: 'Đã duyệt',
  Cancelled: 'Đã hủy',
}

const styles = {
  Draft: { bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', dotColor: '#64748b' },
  Submitted: { bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
  Rejected: { bgcolor: '#fff1f2', color: '#be123c', borderColor: '#fda4af', dotColor: '#e11d48' },
  Approved: { bgcolor: '#ecfdf5', color: '#047857', borderColor: '#6ee7b7', dotColor: '#10b981' },
}

export default function ProjectStatus({ status, label, size = 'medium' }) {
  const style = styles[status] || styles.Draft
  return (
    <Chip
      icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.dotColor }} />}
      label={label || labels[status] || status || 'Chưa xác định'}
      size={size}
      sx={{
        height: size === 'small' ? 26 : 32,
        px: 0.5,
        borderRadius: '999px',
        border: '1px solid ' + style.borderColor,
        bgcolor: style.bgcolor,
        color: style.color,
        fontSize: size === 'small' ? 12 : 13,
        fontWeight: 700,
        '& .MuiChip-label': { px: 1.25 },
        '& .MuiChip-icon': { ml: 1, mr: -0.5 },
      }}
    />
  )
}
