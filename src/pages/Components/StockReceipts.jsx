import { useEffect, useState } from 'react'
import { Add as AddIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const formatDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '—'
const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN')

export default function StockReceipts() {
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    inventoryService.getStockReceipts()
      .then((items) => { if (active) setReceipts(items) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách phiếu nhập.')) })
    return () => { active = false }
  }, [])

  return (
    <PortalLayout headerTitle="Phiếu nhập kho" headerSubtitle="Lịch sử nhập kho và trạng thái các phiếu">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none' }}>Linh kiện</Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate('/class-setup/admin/stock-inwards')} sx={{ textTransform: 'none' }}>Lập phiếu nhập</Button>
        </Box>
        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: 1 }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#faf9ff' }}>{['Mã phiếu', 'Nhà cung cấp', 'Ngày nhận', 'Tổng tiền', 'Trạng thái', 'Số dòng', ''].map((head) => <TableCell key={head}>{head}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {receipts.map((receipt) => <TableRow key={receipt.receiptId} hover>
                <TableCell>{receipt.receiptCode || receipt.receiptId}</TableCell>
                <TableCell>{receipt.supplierName || '—'}</TableCell>
                <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                <TableCell>{formatMoney(receipt.totalAmount)} ₫</TableCell>
                <TableCell><Chip size="small" label={receipt.status || '—'} color={receipt.status === 'Completed' ? 'success' : 'default'} /></TableCell>
                <TableCell>{receipt.lineCount ?? receipt.items?.length ?? '—'}</TableCell>
                <TableCell><Button size="small" onClick={() => navigate(`/class-setup/admin/stock-receipts/${receipt.receiptId}`)} sx={{ textTransform: 'none' }}>Chi tiết</Button></TableCell>
              </TableRow>)}
              {receipts.length === 0 && <TableRow><TableCell colSpan={7} align="center">Chưa có phiếu nhập.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>Phiếu nhập được ghi nhận vào tồn kho ngay sau khi lưu thành công.</Typography>
      </Box>
    </PortalLayout>
  )
}
