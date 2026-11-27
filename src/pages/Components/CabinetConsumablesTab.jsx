import { useEffect, useState, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { cabinetAccepts, cabinetLabel, formatDateTime, rowsOf } from './inventoryLabels'

const headCellSx = { fontWeight: 700, color: '#334155' }

const consumableTargets = (cabinets, fromCabinetId) =>
  cabinets.filter(
    (cabinet) => cabinet.cabinetId !== fromCabinetId && cabinet.status !== 'Inactive' && cabinetAccepts(cabinet, 'CONSUMABLE'),
  )

function MoveAllDialog({ cabinet, stocks, cabinets, onClose, onDone }) {
  const [toCabinetId, setToCabinetId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)

  const targets = consumableTargets(cabinets, cabinet.cabinetId)
  const lines = stocks.filter((stock) => stock.quantity > 0)

  const save = async () => {
    setSaving(true)
    setError('')
    setProgress(0)
    const failed = []
    for (const stock of lines) {
      try {
        await inventoryService.moveConsumableStock({
          componentId: stock.componentId,
          fromCabinetId: stock.cabinetId,
          toCabinetId,
          quantity: stock.quantity,
          reason: reason.trim() || null,
        })
      } catch (moveError) {
        failed.push(`${stock.componentName}: ${extractErrorMessage(moveError, 'không chuyển được')}`)
      }
      setProgress((count) => count + 1)
    }
    setSaving(false)
    const target = targets.find((item) => item.cabinetId === toCabinetId)
    const moved = lines.length - failed.length
    if (failed.length === 0) {
      onDone(`Đã chuyển hết ${moved} vật tư sang tủ ${target?.cabinetCode || 'mới'}.`, 'success')
      return
    }
    setError(`Đã chuyển ${moved}/${lines.length} vật tư. Chưa chuyển được:\n${failed.join('\n')}`)
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Chuyển hết sang tủ khác · {cabinet.cabinetCode}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="warning" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2">
            Chuyển toàn bộ {lines.length} vật tư đang có trong tủ, mỗi loại chuyển hết số lượng.
          </Typography>
          {targets.length === 0 && (
            <Alert severity="info">Lab này chưa có tủ Tiêu hao nào khác để chuyển sang.</Alert>
          )}
          <TextField
            select
            label="Chuyển đến tủ"
            value={toCabinetId}
            onChange={(event) => setToCabinetId(event.target.value)}
            helperText="Chỉ hiện tủ Tiêu hao trong cùng lab"
            disabled={targets.length === 0 || saving}
            required
            fullWidth
          >
            {targets.map((item) => (
              <MenuItem key={item.cabinetId} value={item.cabinetId}>{cabinetLabel(item)}</MenuItem>
            ))}
          </TextField>
          <TextField label="Lý do (không bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => (error ? onDone(null) : onClose())} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !toCabinetId || lines.length === 0 || Boolean(error)} sx={{ bgcolor: '#0058be' }}>
          {saving ? `Đang chuyển ${progress}/${lines.length}...` : 'Chuyển hết'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MoveStockDialog({ stock, cabinets, onClose, onSaved }) {
  const [toCabinetId, setToCabinetId] = useState('')
  const [quantity, setQuantity] = useState(String(stock.quantity))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const targets = consumableTargets(cabinets, stock.cabinetId)
  const amount = Number(quantity)
  const validAmount = Number.isInteger(amount) && amount >= 1 && amount <= stock.quantity

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.moveConsumableStock({
        componentId: stock.componentId,
        fromCabinetId: stock.cabinetId,
        toCabinetId,
        quantity: amount,
        reason: reason.trim() || null,
      })
      const target = targets.find((cabinet) => cabinet.cabinetId === toCabinetId)
      onSaved(`Đã chuyển ${amount} ${stock.componentName} sang tủ ${target?.cabinetCode || 'mới'}.`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể chuyển vật tư.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Chuyển tủ · {stock.componentName}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          {targets.length === 0 && (
            <Alert severity="info">Lab này chưa có tủ Tiêu hao nào khác để chuyển sang.</Alert>
          )}
          <TextField
            select
            label="Chuyển đến tủ"
            value={toCabinetId}
            onChange={(event) => setToCabinetId(event.target.value)}
            helperText="Chỉ hiện tủ Tiêu hao trong cùng lab"
            disabled={targets.length === 0}
            required
            fullWidth
          >
            {targets.map((cabinet) => (
              <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>{cabinetLabel(cabinet)}</MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label="Số lượng chuyển"
            value={quantity}
            onKeyDown={(e) => {
              if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
            }}
            onChange={(event) => setQuantity(event.target.value)}
            error={quantity !== '' && !validAmount}
            helperText={`Trong tủ đang có ${stock.quantity} ${stock.unit || ''}`.trim()}
            slotProps={{ htmlInput: { min: 1, max: stock.quantity, step: 1 } }}
            required
            fullWidth
          />
          <TextField label="Lý do (không bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !toCabinetId || !validAmount} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang chuyển...' : 'Chuyển tủ'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Tab "Vật tư tiêu hao" của trang Chi tiết tủ: tồn vật tư tiêu hao trong tủ. Lệch số thì kiểm kê tủ.
 * - canMove (quản lý kho, hoặc staff của lab chứa tủ): chuyển vật tư sang tủ Tiêu hao khác trong cùng lab.
 */
export default function CabinetConsumablesTab({ cabinet, cabinets, canMove, onChanged, showToast }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Dữ liệu đổi ở nơi khác thì tự tải lại
  const bumpReload = useCallback(() => setReloadKey((key) => key + 1), [])
  useEntityChanged(bumpReload)
  const [moving, setMoving] = useState(null)
  const [movingAll, setMovingAll] = useState(false)

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

  const handleMoved = (message, severity = 'success') => {
    setMoving(null)
    setMovingAll(false)
    if (message) showToast(message, severity)
    setReloadKey((key) => key + 1)
    onChanged()
  }

  const hasStock = stocks.some((stock) => stock.quantity > 0)

  return (
    <>
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      {canMove && hasStock && !loading && (
        <Stack direction="row" justifyContent="flex-end" sx={{ px: 2, pt: 2 }}>
          <Button variant="outlined" size="small" onClick={() => setMovingAll(true)} sx={{ textTransform: 'none' }}>
            Chuyển hết sang tủ khác
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#faf9ff' }}>
              {['Linh kiện', 'Mã', 'Số lượng', 'Cập nhật lúc', ''].map((head) => (
                <TableCell key={head} sx={headCellSx}>{head}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : stocks.map((stock) => (
              <TableRow key={stock.componentId} hover>
                <TableCell sx={{ fontWeight: 600 }}>{stock.componentName}</TableCell>
                <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{stock.componentCode}</TableCell>
                <TableCell><Typography component="span" sx={{ fontWeight: 800 }}>{stock.quantity}</Typography></TableCell>
                <TableCell>{formatDateTime(stock.updatedAt)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {canMove && stock.quantity > 0 && (
                    <Button size="small" onClick={() => setMoving(stock)} sx={{ textTransform: 'none' }}>Chuyển tủ</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && stocks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>Tủ không có vật tư tiêu hao.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {movingAll && (
        <MoveAllDialog cabinet={cabinet} stocks={stocks} cabinets={cabinets} onClose={() => setMovingAll(false)} onDone={handleMoved} />
      )}
      {moving && <MoveStockDialog stock={moving} cabinets={cabinets} onClose={() => setMoving(null)} onSaved={handleMoved} />}
    </>
  )
}
