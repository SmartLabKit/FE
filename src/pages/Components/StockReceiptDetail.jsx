import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon, CancelOutlined as CancelIcon, Edit as EditIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const getLines = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const getSerials = (line) => Array.isArray(line.serialNumbers || line.serials) ? (line.serialNumbers || line.serials) : []
const money = (value) => Number(value || 0).toLocaleString('vi-VN')
const date = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—'

const toDatetimeLocal = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromDatetimeLocal = (val) => {
  if (!val) return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const getReceiptNote = (r, id) => {
  if (!r) return ''
  return (
    r.note ||
    r.notes ||
    r.description ||
    r.remark ||
    r.remarks ||
    (id ? localStorage.getItem(`receipt_note_${id}`) : '') ||
    ''
  )
}

export default function StockReceiptDetail() {
  const { receiptId } = useParams()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState('')
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('')
  const [editReceivedAt, setEditReceivedAt] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const load = useCallback(async () => {
    try {
      setReceipt(await inventoryService.getStockReceipt(receiptId))
    } catch (loadError) {
      setError(extractErrorMessage(loadError, 'Không thể tải chi tiết phiếu nhập.'))
    }
  }, [receiptId])

  useEffect(() => {
    let active = true
    inventoryService.getStockReceipt(receiptId)
      .then((data) => { if (active) setReceipt(data) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải chi tiết phiếu nhập.')) })
    return () => { active = false }
  }, [receiptId])

  const handleOpenEdit = () => {
    setEditSupplier(receipt?.supplierName || '')
    setEditInvoiceNumber(receipt?.invoiceNumber || '')
    setEditReceivedAt(toDatetimeLocal(receipt?.receivedAt))
    setEditNote(getReceiptNote(receipt, receiptId))
    setEditError('')
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editSupplier.trim()) {
      setEditError('Vui lòng nhập tên nhà cung cấp.')
      return
    }
    setEditBusy(true)
    setEditError('')
    const rawLines = getLines(receipt)
    const isoReceivedAt = editReceivedAt ? fromDatetimeLocal(editReceivedAt) : receipt?.receivedAt
    const noteVal = editNote.trim() || null

    const basePayload = {
      supplierName: editSupplier.trim(),
      invoiceNumber: editInvoiceNumber.trim() || null,
      receivedAt: isoReceivedAt,
      note: noteVal,
      notes: noteVal,
      description: noteVal,
      remarks: noteVal,
    }

    const fullPayload = {
      ...basePayload,
      items: rawLines.map((line) => {
        const units = line.units || line.Units || []
        const serials = getSerials(line).map((s) => typeof s === 'string' ? s : s.serialNumber)
        return {
          componentId: line.componentId,
          cabinetId: line.cabinetId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          units,
          Units: units,
          ...(serials.length > 0 ? { serialNumbers: serials } : {}),
          ...(line.version ? { version: line.version } : {}),
        }
      }),
    }

    try {
      try {
        await inventoryService.updateStockReceipt(receiptId, fullPayload)
      } catch {
        // Fallback to base payload if backend schema does not accept items on update
        await inventoryService.updateStockReceipt(receiptId, basePayload)
      }

      if (noteVal) {
        localStorage.setItem(`receipt_note_${receiptId}`, noteVal)
      } else {
        localStorage.removeItem(`receipt_note_${receiptId}`)
      }

      setNotice('Cập nhật thông tin phiếu nhập và lưu ý thành công.')
      setEditOpen(false)
      await load()
    } catch (saveError) {
      setEditError(extractErrorMessage(saveError, 'Không thể cập nhật phiếu nhập.'))
    } finally {
      setEditBusy(false)
    }
  }

  const uploadInvoice = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await inventoryService.uploadReceiptInvoice(receiptId, file)
      setNotice('Đã đính kèm hóa đơn.')
      await load()
    } catch (uploadError) {
      setError(extractErrorMessage(uploadError, 'Không thể tải hóa đơn lên.'))
    } finally { setBusy(false) }
  }

  const removeInvoice = async () => {
    setBusy(true)
    setError('')
    try {
      await inventoryService.deleteReceiptInvoice(receiptId)
      setNotice('Đã xóa hóa đơn.')
      await load()
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa hóa đơn.'))
    } finally { setBusy(false) }
  }

  const cancelReceipt = async () => {
    if (!window.confirm('Hủy phiếu nhập này? Chỉ thực hiện được khi hàng chưa phát sinh giao dịch kho.')) return
    setBusy(true)
    setError('')
    try {
      setReceipt(await inventoryService.cancelStockReceipt(receiptId))
      setNotice('Đã gửi yêu cầu hủy phiếu.')
      await load()
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiếu nhập.'))
    } finally { setBusy(false) }
  }

  const lines = getLines(receipt)
  const isCancelled = /cancel/i.test(receipt?.status || '')
  const currentNote = getReceiptNote(receipt, receiptId)

  return (
    <PortalLayout headerTitle="Chi tiết phiếu nhập" headerSubtitle="Thông tin chứng từ, hàng hóa và hóa đơn">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>Danh sách phiếu</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              disabled={!receipt || isCancelled || receipt.status === 'Cancelled'}
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleOpenEdit}
              sx={{ textTransform: 'none' }}
            >
              Sửa phiếu
            </Button>
            <Button disabled={!receipt || isCancelled || receipt.status === 'Cancelled' || busy} color="error" startIcon={<CancelIcon />} onClick={cancelReceipt} sx={{ textTransform: 'none' }}>Hủy phiếu</Button>
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        {/* Thông báo lưu ý quy định sửa phiếu nhập kho */}
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2, bgcolor: '#f0f7ff', borderColor: '#b9e0fd', border: '1px solid' }}>
          <strong>Lưu ý:</strong> Hàng hóa trong phiếu nhập đã được hoàn tất và ghi nhận vào tồn kho. Theo quy định quản lý kho, không thể chỉnh sửa danh sách dòng hàng (linh kiện, số lượng, đơn giá). Bạn chỉ có thể cập nhật thông tin nhà cung cấp, chứng từ và chèn thêm lưu ý/ghi chú.
        </Alert>

        {receipt && <>
          <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight={800}>{receipt.receiptCode || receipt.receiptId}</Typography>
                <Chip label={receipt.status || '—'} color={isCancelled ? 'default' : 'success'} />
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Nhà cung cấp</Typography><Typography fontWeight={600}>{receipt.supplierName || '—'}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Số chứng từ</Typography><Typography fontWeight={600}>{receipt.invoiceNumber || '—'}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Ngày nhận</Typography><Typography fontWeight={600}>{date(receipt.receivedAt)}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Tổng tiền</Typography><Typography fontWeight={700} color="primary">{money(receipt.totalAmount)} ₫</Typography></Grid>
                
                {/* Phần hiển thị Lưu ý / Ghi chú */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mt: 1, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InfoIcon fontSize="small" sx={{ color: '#0284c7' }} /> Lưu ý / Ghi chú phiếu nhập:
                      </Typography>
                      <Button
                        size="small"
                        onClick={handleOpenEdit}
                        sx={{ textTransform: 'none', fontSize: 12, py: 0 }}
                      >
                        {currentNote ? 'Sửa lưu ý' : '+ Thêm lưu ý'}
                      </Button>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        color: currentNote ? '#1e293b' : '#94a3b8',
                        fontStyle: currentNote ? 'normal' : 'italic',
                      }}
                    >
                      {currentNote || 'Chưa có lưu ý hoặc ghi chú nào cho phiếu nhập này.'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent>
              <Typography sx={{ mb: 1.5, fontWeight: 800 }}>Dòng hàng nhập</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow sx={{ bgcolor: '#faf9ff' }}>{['Linh kiện', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Tủ cất', 'Serial / Version / Bảo hành'].map((heading) => <TableCell key={heading}>{heading}</TableCell>)}</TableRow></TableHead>
                <TableBody>{lines.map((line, index) => {
                  const units = line.units || line.Units || []
                  const hasUnits = units.length > 0
                  return <TableRow key={line.receiptLineId || line.id || index}>
                    <TableCell>{line.componentName || line.componentCode || line.componentId || '—'}</TableCell>
                    <TableCell>{line.quantity ?? '—'}</TableCell>
                    <TableCell>{money(line.unitPrice)} ₫</TableCell>
                    <TableCell>{money(line.totalAmount ?? Number(line.quantity || 0) * Number(line.unitPrice || 0))} ₫</TableCell>
                    <TableCell>{line.cabinetCode || line.cabinetName || '—'}</TableCell>
                    <TableCell>
                      {hasUnits ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {units.map((u, uIdx) => (
                            <Box key={u.itemId || u.serialNumber || uIdx} sx={{ fontSize: 12 }}>
                              <strong>{u.serialNumber || u.SerialNumber || '—'}</strong>
                              {(u.hardwareVersion || u.HardwareVersion) && (
                                <Chip size="small" label={`v${u.hardwareVersion || u.HardwareVersion}`} sx={{ height: 18, fontSize: 10, ml: 0.5 }} />
                              )}
                              {(u.warrantyExpiresAt || u.WarrantyExpiresAt) && (
                                <Chip
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  label={`BH đến: ${new Date(u.warrantyExpiresAt || u.WarrantyExpiresAt).toLocaleDateString('vi-VN')}`}
                                  sx={{ height: 18, fontSize: 10, ml: 0.5 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        [...getSerials(line).map((item) => typeof item === 'string' ? item : item.serialNumber), line.version].filter(Boolean).join(' · ') || '—'
                      )}
                    </TableCell>
                  </TableRow>
                })}</TableBody>
              </Table></TableContainer>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box><Typography fontWeight={800}>Hóa đơn / chứng từ</Typography><Typography color="text.secondary" fontSize={12}>{receipt.invoiceUrl || receipt.invoiceFileName || 'Chưa đính kèm hóa đơn'}</Typography></Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button component="label" variant="outlined" disabled={busy} sx={{ textTransform: 'none' }}>Tải hóa đơn<input hidden type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => uploadInvoice(event.target.files?.[0])} /></Button>
                {(receipt.invoiceUrl || receipt.invoiceFileName) && <Button color="error" disabled={busy} onClick={removeInvoice} sx={{ textTransform: 'none' }}>Xóa hóa đơn</Button>}
              </Box>
            </CardContent>
          </Card>
        </>}

        {/* Modal chỉnh sửa thông tin nhà cung cấp và chèn thêm lưu ý */}
        <Dialog open={editOpen} onClose={() => !editBusy && setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Chỉnh sửa thông tin phiếu nhập</DialogTitle>
          <DialogContent dividers>
            <Alert severity="warning" sx={{ mb: 2, fontSize: 13 }}>
              Hàng hóa đã được ghi nhận vào kho. Bạn chỉ có thể cập nhật thông tin nhà cung cấp, chứng từ và chèn thêm lưu ý/ghi chú. Dòng hàng linh kiện không thể thay đổi.
            </Alert>
            {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                required
                label="Nhà cung cấp"
                value={editSupplier}
                onChange={(e) => setEditSupplier(e.target.value)}
                disabled={editBusy}
              />
              <TextField
                fullWidth
                label="Số chứng từ"
                value={editInvoiceNumber}
                onChange={(e) => setEditInvoiceNumber(e.target.value)}
                disabled={editBusy}
              />
              <TextField
                fullWidth
                label="Ngày nhận"
                type="datetime-local"
                value={editReceivedAt}
                onChange={(e) => setEditReceivedAt(e.target.value)}
                disabled={editBusy}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Lưu ý / Ghi chú"
                placeholder="Nhập nội dung lưu ý, ghi chú nhà cung cấp hoặc thông tin bổ sung cho phiếu..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                disabled={editBusy}
                helperText="Lưu ý sẽ được hiển thị trên phiếu nhập để tra cứu sau này."
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setEditOpen(false)} disabled={editBusy} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={editBusy} sx={{ textTransform: 'none' }}>
              {editBusy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PortalLayout>
  )
}
