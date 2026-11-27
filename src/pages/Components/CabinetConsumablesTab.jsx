import { useEffect, useState, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import {
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { formatDateTime, rowsOf } from './inventoryLabels'

const headCellSx = { fontWeight: 700, color: '#334155' }

/**
 * Tab "Vật tư tiêu hao" của trang Chi tiết tủ: tồn vật tư tiêu hao trong tủ (chỉ xem; lệch số thì kiểm kê tủ).
 */
export default function CabinetConsumablesTab({ cabinet }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Dữ liệu đổi ở nơi khác thì tự tải lại
  const bumpReload = useCallback(() => setReloadKey((key) => key + 1), [])
  useEntityChanged(bumpReload)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await inventoryService.getConsumableStocks({ cabinetId: cabinet.cabinetId, page: 1, size: 100 })
        if (active) setStocks(rowsOf(data))
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải tồn vật tư tiêu hao.'))
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [cabinet.cabinetId, reloadKey])

  return (
    <>
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#faf9ff' }}>
              {['Linh kiện', 'Mã', 'Số lượng', 'Cập nhật lúc'].map((head) => (
                <TableCell key={head} sx={headCellSx}>{head}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : stocks.map((stock) => (
              <TableRow key={stock.componentId} hover>
                <TableCell sx={{ fontWeight: 600 }}>{stock.componentName}</TableCell>
                <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{stock.componentCode}</TableCell>
                <TableCell><Typography component="span" sx={{ fontWeight: 800 }}>{stock.quantity}</Typography></TableCell>
                <TableCell>{formatDateTime(stock.updatedAt)}</TableCell>
              </TableRow>
            ))}
            {!loading && stocks.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>Tủ không có vật tư tiêu hao.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}
