import { useEffect, useState } from 'react'
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
import { cabinetLabel, formatDateTime, rowsOf } from './inventoryLabels'

const headCellSx = { fontWeight: 700, color: '#334155' }

function MoveStockDialog({ stock, cabinets, onClose, onSaved }) {
  const [toCabinetId, setToCabinetId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const targets = cabinets.filter((cabinet) => cabinet.cabinetId !== stock.cabinetId)
  const quantityValue = Number(quantity)
  const validQuantity = Number.isInteger(quantityValue) && quantityValue >= 1 && quantityValue <= stock.quantity

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.moveConsumableStock({
        componentId: stock.componentId,
        fromCabinetId: stock.cabinetId,
        toCabinetId,
        quantity: quantityValue,
        reason: reason.trim() || null,
      })
      onSaved(`Đã chuyển ${quantityValue} ${stock.componentName} sang tủ mới.`)
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
          <TextField select label="Tủ đích" value={toCabinetId} onChange={(event) => setToCabinetId(event.target.value)} required fullWidth>
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
            error={!validQuantity}
            helperText={`Hiện có ${stock.quantity} trong tủ`}
            slotProps={{ htmlInput: { min: 1, max: stock.quantity, step: 1 } }}
            fullWidth
          />
          <TextField label="Lý do (không bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !toCabinetId || !validQuantity} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang chuyển...' : 'Chuyển tủ'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function AdjustStockDialog({ stock, onClose, onSaved }) {
  const [countedQuantity, setCountedQuantity] = useState(stock.quantity)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const counted = Number(countedQuantity)
  const validCount = Number.isInteger(counted) && counted >= 0
  const difference = validCount ? counted - stock.quantity : 0

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await inventoryService.adjustConsumableStock({
        componentId: stock.componentId,
        cabinetId: stock.cabinetId,
        countedQuantity: counted,
        reason: reason.trim(),
      })
      const shortages = result?.reservationShortages || []
      onSaved(
        shortages.length
          ? `Đã điều chỉnh. Lưu ý: lab đang thiếu hàng cho các đơn ${shortages.flatMap((line) => line.requestCodes || []).join(', ')}.`
          : `Đã điều chỉnh tồn ${stock.componentName} thành ${counted}.`,
        shortages.length ? 'warning' : 'success',
      )
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể điều chỉnh tồn kho.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Điều chỉnh tồn · {stock.componentName}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            type="number"
            label="Số đếm thực tế"
            value={countedQuantity}
            onKeyDown={(e) => {
              if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
            }}
            onChange={(event) => setCountedQuantity(event.target.value)}
            error={!validCount}
            helperText={`Hệ thống đang ghi ${stock.quantity}${validCount && difference !== 0 ? ` · chênh lệch ${difference > 0 ? '+' : ''}${difference}` : ''}`}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            fullWidth
          />
          <TextField label="Lý do (bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2} required fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !validCount || difference === 0 || !reason.trim()} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang lưu...' : 'Điều chỉnh'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Tab "Vật tư tiêu hao" của trang Chi tiết tủ: tồn vật tư CONSUMABLE trong tủ.
 * - canMove (COMPONENT_MANAGE, hoặc LabStaff của lab chứa tủ): chuyển sang tủ khác; LabStaff chỉ chuyển trong lab đó.
 * - canAdjust (INVENTORY_AUDIT_APPROVE, quản lý kho): đặt lại tồn bằng số đếm thực tế, bắt buộc ghi lý do.
 */
export default function CabinetConsumablesTab({ cabinet, cabinets, canMove, canAdjust, onChanged, showToast }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [dialog, setDialog] = useState(null)

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

  const handleSaved = (message, severity = 'success') => {
    setDialog(null)
    showToast(message, severity)
    setReloadKey((key) => key + 1)
    onChanged()
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
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
                    <Button size="small" onClick={() => setDialog({ type: 'move', stock })} sx={{ textTransform: 'none' }}>Chuyển tủ</Button>
                  )}
                  {canAdjust && (
                    <Button size="small" onClick={() => setDialog({ type: 'adjust', stock })} sx={{ textTransform: 'none' }}>Điều chỉnh</Button>
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

      {dialog?.type === 'move' && <MoveStockDialog stock={dialog.stock} cabinets={cabinets} onClose={() => setDialog(null)} onSaved={handleSaved} />}
      {dialog?.type === 'adjust' && <AdjustStockDialog stock={dialog.stock} onClose={() => setDialog(null)} onSaved={handleSaved} />}
    </>
  )
}
