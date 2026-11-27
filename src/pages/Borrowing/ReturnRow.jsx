import { Box, Typography } from '@mui/material'

/** Một dòng gọn: tên, dòng phụ xám, chữ trạng thái bên phải. */
export default function ReturnRow({ title, subtitle, status, before, after, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.5,
        borderBottom: '1px solid #eef0f5',
        '&:last-of-type': { borderBottom: 0 },
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {before}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, color: '#1e293b', overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: 13, color: '#64748b', overflowWrap: 'anywhere' }}>{subtitle}</Typography>}
      </Box>
      {status && (
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: status.color, textAlign: 'right' }}>{status.text}</Typography>
      )}
      {after}
    </Box>
  )
}
