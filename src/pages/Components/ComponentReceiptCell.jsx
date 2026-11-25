import { Box, Typography } from '@mui/material'
import { formatVietnamDateTime } from '../../utils/dateFormatting'
import { receivedQuantity } from './receivedFilter'

/** Ô "Nhập gần nhất": số lượng và lúc nhập. */
export default function ComponentReceiptCell({ receipt, unit }) {
  if (!receipt) return '—'
  return (
    <Box sx={{ whiteSpace: 'nowrap' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
        +{receivedQuantity(receipt).toLocaleString('vi-VN')} {unit || ''}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>{formatVietnamDateTime(receipt.createdAt)}</Typography>
    </Box>
  )
}
