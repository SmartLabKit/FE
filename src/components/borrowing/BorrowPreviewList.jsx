import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material'

/**
 * Xem trước các đơn mượn sẽ tạo khi gửi: mỗi lab một đơn, mỗi lab duyệt và giao riêng.
 * preview = { labs: [{ roomCode, roomName, lines: [{ componentName, componentCode, quantity, unit }] }], problem }
 */
export default function BorrowPreviewList({ preview, loading, error }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Đang chia đơn theo lab...</Typography>
      </Box>
    )
  }
  if (error) return <Alert severity="warning">{error}</Alert>
  if (!preview) return null
  if (preview.problem) return <Alert severity="error">{preview.problem}</Alert>

  const labs = Array.isArray(preview.labs) ? preview.labs : []
  if (labs.length === 0) return null

  return (
    <Box sx={{ border: '1px solid #bfdbfe', bgcolor: '#eff6ff', borderRadius: 2, p: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
        {labs.length === 1
          ? `Sẽ tạo 1 đơn mượn ở ${labs[0].roomCode}`
          : `Sẽ tạo ${labs.length} đơn mượn, mỗi lab duyệt và giao riêng`}
      </Typography>
      <Stack spacing={1.25}>
        {labs.map((lab) => (
          <Box key={lab.roomId || lab.roomCode}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
              {lab.roomCode}{lab.roomName ? ` · ${lab.roomName}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: '#334155' }}>
              {lab.lines.map((line) => `${line.componentName} ×${line.quantity}${line.unit ? ` ${line.unit}` : ''}`).join(', ')}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
