import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  CancelOutlined as CancelIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const getLines = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const getSerials = (line) =>
  Array.isArray(line.serialNumbers || line.serials) ? line.serialNumbers || line.serials : []
const money = (value) => Number(value || 0).toLocaleString('vi-VN')
const date = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Chuyển đổi giá trị ngày sang YYYY-MM-DD
const toYMD = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Chuyển chuỗi YYYY-MM-DD sang dd/mm/yyyy
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return dateStr
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

  // Edit dialog state (Thiết kế đúng theo hình 2: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày hóa đơn, Ghi chú)
  const [editOpen, setEditOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState('')
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('')
  const [editReceivedAt, setEditReceivedAt] = useState('')
  const [editInvoiceDate, setEditInvoiceDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  // Ref cho date input ẩn
  const receivedAtInputRef = useRef(null)
  const invoiceDateInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setReceipt(await inventoryService.getStockReceipt(receiptId))
    } catch (loadError) {
      setError(extractErrorMessage(loadError, 'Không thể tải chi tiết phiếu nhập.'))
    }
  }, [receiptId])

  useEffect(() => {
    let active = true
    inventoryService
      .getStockReceipt(receiptId)
      .then((data) => {
        if (active) setReceipt(data)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải chi tiết phiếu nhập.'))
      })
    return () => {
      active = false
    }
  }, [receiptId])

  const handleOpenEdit = () => {
    setEditSupplier(receipt?.supplierName || '')
    setEditInvoiceNumber(receipt?.invoiceNumber || '')
    setEditReceivedAt(toYMD(receipt?.receivedAt))
    const rawInvoiceDate =
      receipt?.invoiceDate ||
      receipt?.InvoiceDate ||
      localStorage.getItem(`receipt_invoice_date_${receiptId}`) ||
      ''
    setEditInvoiceDate(toYMD(rawInvoiceDate))
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
    const isoReceivedAt = editReceivedAt ? new Date(`${editReceivedAt}T00:00:00Z`).toISOString() : receipt?.receivedAt
    const isoInvoiceDate = editInvoiceDate ? new Date(`${editInvoiceDate}T00:00:00Z`).toISOString() : null
    const noteVal = editNote.trim() || null

    // Chỉ cập nhật các trường được phép: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày hóa đơn, Ghi chú
    const basePayload = {
      supplierName: editSupplier.trim(),
      invoiceNumber: editInvoiceNumber.trim() || null,
      receivedAt: isoReceivedAt,
      invoiceDate: isoInvoiceDate,
      note: noteVal,
      notes: noteVal,
      description: noteVal,
      remarks: noteVal,
      // PascalCase compatibility
      SupplierName: editSupplier.trim(),
      InvoiceNumber: editInvoiceNumber.trim() || null,
      ReceivedAt: isoReceivedAt,
      InvoiceDate: isoInvoiceDate,
    }

    const fullPayload = {
      ...basePayload,
      items: rawLines.map((line) => {
        const units = line.units || line.Units || []
        const serials = getSerials(line).map((s) => (typeof s === 'string' ? s : s.serialNumber))
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
        // Fallback gửi base payload nếu BE không nhận mảng items khi cập nhật
        await inventoryService.updateStockReceipt(receiptId, basePayload)
      }

      if (editInvoiceDate) {
        localStorage.setItem(`receipt_invoice_date_${receiptId}`, editInvoiceDate)
      } else {
        localStorage.removeItem(`receipt_invoice_date_${receiptId}`)
      }

      if (noteVal) {
        localStorage.setItem(`receipt_note_${receiptId}`, noteVal)
      } else {
        localStorage.removeItem(`receipt_note_${receiptId}`)
      }

      setNotice('Cập nhật thông tin phiếu nhập thành công.')
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
      setError(extractErrorMessage(uploadError, 'Không thể tải lên hóa đơn.'))
    } finally {
      setBusy(false)
    }
  }

  const deleteInvoice = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa tệp hóa đơn này?')) return
    setBusy(true)
    setError('')
    try {
      await inventoryService.deleteReceiptInvoice(receiptId)
      setNotice('Đã xóa hóa đơn đính kèm.')
      await load()
    } catch (delError) {
      setError(extractErrorMessage(delError, 'Không thể xóa hóa đơn.'))
    } finally {
      setBusy(false)
    }
  }

  const cancelReceipt = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phiếu nhập này? (Nếu có sai sót về hàng hóa, vui lòng hủy phiếu để tạo phiếu mới)')) return
    setBusy(true)
    setError('')
    try {
      await inventoryService.cancelStockReceipt(receiptId)
      setNotice('Đã hủy phiếu nhập thành công. Bạn có thể tạo phiếu mới.')
      await load()
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiếu nhập.'))
    } finally {
      setBusy(false)
    }
  }

  const lines = getLines(receipt)
  const isCancelled = receipt?.status === 'Cancelled'
  const currentNote = getReceiptNote(receipt, receiptId)
  const currentInvoiceDate =
    receipt?.invoiceDate ||
    receipt?.InvoiceDate ||
    localStorage.getItem(`receipt_invoice_date_${receiptId}`) ||
    ''

  return (
    <PortalLayout headerTitle="Chi tiết phiếu nhập" headerSubtitle="Thông tin chứng từ, hàng hóa và hóa đơn">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>
            Danh sách phiếu
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              disabled={!receipt || isCancelled || receipt.status === 'Cancelled'}
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleOpenEdit}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Sửa phiếu
            </Button>
            <Button
              disabled={!receipt || isCancelled || receipt.status === 'Cancelled' || busy}
              color="error"
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={cancelReceipt}
              sx={{ textTransform: 'none' }}
            >
              Hủy phiếu
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        {/* Thông báo quy định sửa phiếu nhập kho */}
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2, bgcolor: '#f0f7ff', borderColor: '#b9e0fd', border: '1px solid' }}>
          <strong>Quy định sửa phiếu:</strong> Chỉ được phép chỉnh sửa các thông tin: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày hóa đơn và Ghi chú. <strong>Không được sửa mặt hàng</strong>. Nếu có sai sót về hàng hóa, vui lòng bấm &quot;Hủy phiếu&quot; và tạo phiếu mới.
        </Alert>

        {receipt && (
          <>
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={800}>{receipt.receiptCode || receipt.receiptId}</Typography>
                  <Chip label={receipt.status || '—'} color={isCancelled ? 'default' : 'success'} />
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Typography color="text.secondary" fontSize={13}>Nhà cung cấp</Typography>
                    <Typography fontWeight={600}>{receipt.supplierName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Typography color="text.secondary" fontSize={13}>Số hóa đơn</Typography>
                    <Typography fontWeight={600}>{receipt.invoiceNumber || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Typography color="text.secondary" fontSize={13}>Ngày nhận</Typography>
                    <Typography fontWeight={600}>{date(receipt.receivedAt)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Typography color="text.secondary" fontSize={13}>Ngày hóa đơn</Typography>
                    <Typography fontWeight={600}>{currentInvoiceDate ? date(currentInvoiceDate) : '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Typography color="text.secondary" fontSize={13}>Tổng tiền</Typography>
                    <Typography fontWeight={700} color="primary">{money(receipt.totalAmount)} ₫</Typography>
                  </Grid>

                  {/* Phần hiển thị Lưu ý / Ghi chú */}
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ mt: 1, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <InfoIcon fontSize="small" sx={{ color: '#0284c7' }} /> Ghi chú phiếu nhập:
                        </Typography>
                        <Button
                          size="small"
                          onClick={handleOpenEdit}
                          sx={{ textTransform: 'none', fontSize: 12, py: 0 }}
                        >
                          {currentNote ? 'Sửa ghi chú' : '+ Thêm ghi chú'}
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
                        {currentNote || 'Không có ghi chú.'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Bảng dòng hàng (Chỉ xem) */}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Danh sách mặt hàng ({lines.length} dòng hàng)
            </Typography>
            <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: 1, mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#faf9ff' }}>
                    {['Linh kiện', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Tủ lưu trữ', 'Thông tin máy / Serial'].map((head) => (
                      <TableCell key={head} sx={{ fontWeight: 600 }}>{head}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, idx) => {
                    const serials = getSerials(line)
                    const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0)
                    return (
                      <TableRow key={line.receiptItemId || line.id || idx} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{line.componentName || line.componentCode || '—'}</TableCell>
                        <TableCell>{Number(line.quantity || 0).toLocaleString('vi-VN')}</TableCell>
                        <TableCell>{money(line.unitPrice)} ₫</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{money(lineTotal)} ₫</TableCell>
                        <TableCell>{line.cabinetName || line.cabinetCode || '—'}</TableCell>
                        <TableCell>
                          {serials.length > 0 ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {serials.map((s, i) => (
                                <Chip key={i} size="small" label={typeof s === 'string' ? s : s.serialNumber} />
                              ))}
                            </Box>
                          ) : (
                            line.version ? `Version: ${line.version}` : '—'
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Không có dòng hàng nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Quản lý tệp hóa đơn chứng từ */}
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography fontWeight={700}>Tệp hóa đơn đính kèm</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {receipt.invoicePath || receipt.invoiceUrl ? 'Đã có tệp hóa đơn được tải lên cho phiếu này.' : 'Chưa đính kèm tệp hóa đơn.'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {receipt.invoiceUrl && (
                    <Button variant="outlined" size="small" href={receipt.invoiceUrl} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none' }}>
                      Xem hóa đơn
                    </Button>
                  )}
                  {receipt.invoicePath && !isCancelled && (
                    <Button variant="outlined" color="error" size="small" onClick={deleteInvoice} sx={{ textTransform: 'none' }}>
                      Xóa tệp
                    </Button>
                  )}
                  <Button variant="contained" component="label" size="small" sx={{ textTransform: 'none' }}>
                    {receipt.invoicePath ? 'Thay tệp mới' : 'Tải lên hóa đơn'}
                    <input type="file" hidden onChange={(e) => uploadInvoice(e.target.files?.[0])} />
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {/* MODAL SỬA PHIẾU NHẬP (Thiết kế đúng theo hình thứ 2) */}
        <Dialog
          open={editOpen}
          onClose={() => !editBusy && setEditOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3.5,
              bgcolor: '#f4f5f7',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
            },
          }}
        >
          {/* Thanh tiêu đề: X | Sửa phiếu nhập | Lưu */}
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              bgcolor: '#ffffff',
              borderBottom: '1px solid #eef0f4',
            }}
          >
            <IconButton
              size="small"
              onClick={() => setEditOpen(false)}
              disabled={editBusy}
              sx={{ color: '#0058be', p: 0.5 }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>
              Sửa phiếu nhập
            </Typography>

            <Button
              onClick={handleSaveEdit}
              disabled={editBusy}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 15,
                color: '#0058be',
                minWidth: 'auto',
                p: 0.5,
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              {editBusy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogTitle>

          <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editError && <Alert severity="error" sx={{ mb: 1 }}>{editError}</Alert>}

            {/* NHÀ CUNG CẤP */}
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, mb: 0.75 }}>
                NHÀ CUNG CẤP
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Nhập nhà cung cấp..."
                value={editSupplier}
                onChange={(e) => setEditSupplier(e.target.value)}
                disabled={editBusy}
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                  },
                }}
              />
            </Box>

            {/* SỐ HÓA ĐƠN */}
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, mb: 0.75 }}>
                SỐ HÓA ĐƠN
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Nhập số hóa đơn..."
                value={editInvoiceNumber}
                onChange={(e) => setEditInvoiceNumber(e.target.value)}
                disabled={editBusy}
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                  },
                }}
              />
            </Box>

            {/* NGÀY THÁNG (Gồm Ngày nhận và Ngày hóa đơn) */}
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, mb: 0.75 }}>
                NGÀY THÁNG
              </Typography>
              <Box
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {/* Dòng Ngày nhận */}
                <Box
                  onClick={() => receivedAtInputRef.current?.showPicker?.()}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
                    Ngày nhận
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 14, color: editReceivedAt ? '#1e293b' : '#94a3b8' }}>
                      {editReceivedAt ? formatDateDisplay(editReceivedAt) : '—'}
                    </Typography>
                    <ChevronRightIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                  </Box>
                  <input
                    ref={receivedAtInputRef}
                    type="date"
                    value={editReceivedAt}
                    onChange={(e) => setEditReceivedAt(e.target.value)}
                    onClick={(e) => e.target.showPicker?.()}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                  />
                </Box>

                <Divider sx={{ borderColor: '#f1f5f9' }} />

                {/* Dòng Ngày hóa đơn */}
                <Box
                  onClick={() => invoiceDateInputRef.current?.showPicker?.()}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
                    Ngày hóa đơn
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 14, color: editInvoiceDate ? '#1e293b' : '#94a3b8' }}>
                      {editInvoiceDate ? formatDateDisplay(editInvoiceDate) : '—'}
                    </Typography>
                    <ChevronRightIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                  </Box>
                  <input
                    ref={invoiceDateInputRef}
                    type="date"
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    onClick={(e) => e.target.showPicker?.()}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* GHI CHÚ */}
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, mb: 0.75 }}>
                GHI CHÚ
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="Không bắt buộc"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                disabled={editBusy}
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                  },
                }}
              />
            </Box>

            {/* Chú thích quy định không sửa mặt hàng (Đúng theo hình thứ 2) */}
            <Typography sx={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.5 }}>
              Không sửa được mặt hàng. Hãy hủy phiếu và tạo phiếu mới.
            </Typography>
          </DialogContent>
        </Dialog>
      </Box>
    </PortalLayout>
  )
}
