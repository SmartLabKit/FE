import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import CreateIssueReportDialog from '../IssueReports/CreateIssueReportDialog'
import { cabinetAccepts, cabinetLabel, formatDate, itemStatusOf, rowsOf, toDateInput } from './inventoryLabels'

const PAGE_SIZE = 20
const headCellSx = { fontWeight: 700, color: '#334155' }

function EditItemDialog({ itemId, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    inventoryService.getComponentItem(itemId)
      .then((item) => {
        if (!active) return
        setForm({
          itemCode: item.itemCode,
          componentName: item.componentName,
          serialNumber: item.serialNumber || '',
          hardwareVersion: item.hardwareVersion || '',
          warrantyExpiresAt: toDateInput(item.warrantyExpiresAt),
          condition: item.condition || '',
          note: item.note || '',
        })
      })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải thông tin thiết bị.')) })
    return () => { active = false }
  }, [itemId])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.updateComponentItem(itemId, {
        serialNumber: form.serialNumber.trim() || null,
        hardwareVersion: form.hardwareVersion.trim() || null,
        warrantyExpiresAt: form.warrantyExpiresAt || null,
        condition: form.condition.trim() || null,
        note: form.note.trim() || null,
      })
      onSaved('Đã cập nhật thông tin thiết bị.')
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể cập nhật thiết bị.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Sửa thiết bị {form ? `${form.itemCode} · ${form.componentName}` : ''}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!form ? (
          !error && <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Serial" value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} fullWidth />
            <TextField label="Phiên bản phần cứng" value={form.hardwareVersion} onChange={(event) => update('hardwareVersion', event.target.value)} fullWidth />
            <TextField
              type="date"
              label="Hết hạn bảo hành"
              value={form.warrantyExpiresAt}
              onChange={(event) => update('warrantyExpiresAt', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField label="Tình trạng" value={form.condition} onChange={(event) => update('condition', event.target.value)} fullWidth />
            <TextField label="Ghi chú" value={form.note} onChange={(event) => update('note', event.target.value)} multiline minRows={2} fullWidth />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !form} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MoveItemDialog({ item, cabinets, onClose, onSaved }) {
  const [toCabinetId, setToCabinetId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const targets = cabinets.filter((cabinet) => cabinet.cabinetId !== item.cabinetId && cabinetAccepts(cabinet, item.trackingType))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.moveComponentItems({
        componentId: item.componentId,
        fromCabinetId: item.cabinetId,
        fromStatus: item.status,
        itemIds: [item.itemId],
        toCabinetId,
        reason: reason.trim() || null,
      })
      onSaved(`Đã chuyển ${item.itemCode} sang tủ mới.`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể chuyển thiết bị.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Chuyển tủ · {item.itemCode}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Tủ đích" value={toCabinetId} onChange={(event) => setToCabinetId(event.target.value)} required fullWidth>
            {targets.map((cabinet) => (
              <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>{cabinetLabel(cabinet)}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Lý do (không bắt buộc)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || !toCabinetId} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang chuyển...' : 'Chuyển tủ'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RetireItemDialog({ item, onClose, onSaved }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await inventoryService.retireComponentItem(item.itemId, { status: 'Retired', reason: reason.trim() })
      const shortages = result?.reservationShortages || []
      onSaved(
        shortages.length
          ? `Đã ghi nhận. Lưu ý: lab đang thiếu hàng cho các đơn ${shortages.flatMap((line) => line.requestCodes || []).join(', ')}.`
          : `Đã thanh lý ${item.itemCode}.`,
        shortages.length ? 'warning' : 'success',
      )
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể cập nhật trạng thái thiết bị.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Thanh lý · {item.itemCode}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Dùng cho thiết bị cũ, hết hạn dùng hoặc nhập nhầm. Thiết bị hỏng, cháy hoặc mất do nhân viên lab ghi nhận ở Sự cố thiết bị.
          </Alert>
          <TextField label="Lý do (bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2} required fullWidth />
          <Alert severity="warning">Thiết bị thanh lý sẽ ra khỏi hệ thống, muốn dùng lại phải nhập phiếu mới.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" color="error" onClick={save} disabled={saving || !reason.trim()}>
          {saving ? 'Đang lưu...' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Tab "Từng thiết bị" của trang Chi tiết tủ: các thiết bị quản lý theo từng chiếc (REUSABLE / HIGH_VALUE) trong tủ.
 * - canManage (COMPONENT_MANAGE): sửa thông tin, thanh lý thiết bị cũ.
 * - canReport (LabStaff của lab chứa tủ): ghi nhận thiết bị hỏng / cháy / mất qua báo cáo sự cố.
 * - canMove (COMPONENT_MANAGE, hoặc LabStaff của lab chứa tủ): chuyển tủ; chỉ chuyển giữa các tủ cùng lab.
 * - Thiết bị bị mất (Lost) tìm lại được thì dùng "Đưa về kho" để chuyển về trạng thái Sẵn sàng.
 */
export default function CabinetItemsTab({ cabinet, cabinets, canManage, canMove, canReport, onChanged, showToast }) {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
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
        const data = await inventoryService.getComponentItems({
          cabinetId: cabinet.cabinetId,
          status: status || undefined,
          page,
          size: PAGE_SIZE,
        })
        if (active) setResult(data)
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách thiết bị.'))
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [cabinet.cabinetId, status, page, reloadKey])

  const items = rowsOf(result)

  const handleSaved = (message, severity = 'success') => {
    setDialog(null)
    showToast(message, severity)
    setReloadKey((key) => key + 1)
    onChanged()
  }

  const restoreLostItem = async (item) => {
    try {
      await inventoryService.moveComponentItems({
        componentId: item.componentId,
        fromCabinetId: item.cabinetId,
        fromStatus: 'Lost',
        itemIds: [item.itemId],
        toStatus: 'Available',
        reason: 'Tìm lại được thiết bị',
      })
      handleSaved(`Đã đưa ${item.itemCode} về kho.`)
    } catch (restoreError) {
      showToast(extractErrorMessage(restoreError, 'Không thể đưa thiết bị về kho.'), 'error')
    }
  }

  return (
    <>
      <Box sx={{ p: 2, display: 'flex', gap: 1.5, borderBottom: '1px solid #eef0f6' }}>
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Tất cả trạng thái</MenuItem>
          {['Available', 'Borrowed', 'Lost'].map((value) => <MenuItem key={value} value={value}>{itemStatusOf(value).label}</MenuItem>)}
        </TextField>
      </Box>
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#faf9ff' }}>
              {['Mã thiết bị', 'Linh kiện', 'Serial', 'Bảo hành đến', 'Tình trạng', 'Trạng thái', ''].map((head) => (
                <TableCell key={head} sx={headCellSx}>{head}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : items.map((item) => {
              const itemStatus = itemStatusOf(item.status)
              return (
                <TableRow key={item.itemId} hover>
                  <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{item.itemCode}</TableCell>
                  <TableCell>{item.componentName}</TableCell>
                  <TableCell>{item.serialNumber || '—'}</TableCell>
                  <TableCell>{formatDate(item.warrantyExpiresAt)}</TableCell>
                  <TableCell>{item.condition || '—'}</TableCell>
                  <TableCell><Chip size="small" color={itemStatus.color} label={itemStatus.label} sx={{ fontWeight: 600, fontSize: 11 }} /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {canManage && (
                      <Button size="small" onClick={() => setDialog({ type: 'edit', item })} sx={{ textTransform: 'none' }}>Sửa</Button>
                    )}
                    {canMove && item.status === 'Available' && (
                      <Button size="small" onClick={() => setDialog({ type: 'move', item })} sx={{ textTransform: 'none' }}>Chuyển tủ</Button>
                    )}
                    {canManage && item.status === 'Lost' && (
                      <Button size="small" onClick={() => restoreLostItem(item)} sx={{ textTransform: 'none' }}>Đưa về kho</Button>
                    )}
                    {canReport && item.status === 'Available' && (
                      <Button size="small" color="warning" onClick={() => setDialog({ type: 'issue', item })} sx={{ textTransform: 'none' }}>
                        Báo hỏng / mất
                      </Button>
                    )}
                    {canManage && item.status === 'Available' && (
                      <Button size="small" color="error" onClick={() => setDialog({ type: 'retire', item })} sx={{ textTransform: 'none' }}>
                        Thanh lý
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>Tủ không có thiết bị quản lý theo từng chiếc.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={result?.totalCount || 0}
        page={page - 1}
        onPageChange={(_, nextPage) => setPage(nextPage + 1)}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
      />

      {dialog?.type === 'edit' && <EditItemDialog itemId={dialog.item.itemId} onClose={() => setDialog(null)} onSaved={handleSaved} />}
      {dialog?.type === 'move' && <MoveItemDialog item={dialog.item} cabinets={cabinets} onClose={() => setDialog(null)} onSaved={handleSaved} />}
      {dialog?.type === 'issue' && (
        <CreateIssueReportDialog
          initialCode={dialog.item.itemCode}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setReloadKey((key) => key + 1)
            onChanged()
          }}
        />
      )}
      {dialog?.type === 'retire' && <RetireItemDialog item={dialog.item} onClose={() => setDialog(null)} onSaved={handleSaved} />}
    </>
  )
}
