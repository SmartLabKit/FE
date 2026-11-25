import { Link as RouterLink } from 'react-router-dom'
import { Box, Link, Typography } from '@mui/material'
import { formatVietnamDateTime } from '../../utils/dateFormatting'
import { receivedQuantity } from './receivedFilter'

const money = (value) => (Number(value) === 0 ? 'Cho tặng' : `${Number(value).toLocaleString('vi-VN')} ₫`)

/** Ô "Nhập gần nhất": số lượng, đơn giá, tủ và phiếu nhập để dò với file Excel. */
export default function ComponentReceiptCell({ receipt, unit }) {
  if (!receipt) return '—'
  const prices = [...new Set(receipt.lines.map((line) => Number(line.unitPrice)))]
  const cabinets = [...new Set(receipt.lines.map((line) => line.cabinetCode).filter(Boolean))]
  return (
    <Box sx={{ minWidth: 170 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
        +{receivedQuantity(receipt).toLocaleString('vi-VN')} {unit || ''}
        <Box component="span" sx={{ color: '#334155', fontWeight: 500 }}> · {prices.map(money).join(', ')}</Box>
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>{cabinets.join(', ')}</Typography>
      <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
        <Link component={RouterLink} to={`/class-setup/admin/stock-receipts/${receipt.receiptId}`} sx={{ fontWeight: 700 }}>
          {receipt.receiptCode}
        </Link>
        {' · '}
        {formatVietnamDateTime(receipt.createdAt)}
      </Typography>
    </Box>
  )
}
