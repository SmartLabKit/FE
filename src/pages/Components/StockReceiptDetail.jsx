import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
  FactCheckOutlined as CheckIcon,
  Inventory2Outlined as ComponentsIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getVietnamDateInputValue,
  isValidYmdDate,
  toReceiptReceivedAtIso,
  toSafeInvoiceDateIso,
} from '../../utils/dateFormatting'
import ReceiptExcelCheckDialog from './ReceiptExcelCheckDialog'
import { INVOICE_ACCEPT, invoiceFileError } from './invoiceFile'
import { receiptStatusOf } from './inventoryLabels'

const getLines = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const getUnits = (line) => (Array.isArray(line.units) ? line.units : [])
const money = (value) => Number(value || 0).toLocaleString('vi-VN')
const formatDateTime = (value) => formatVietnamDateTime(value)
const formatDate = (value) => formatVietnamDate(value)

// Chuyển chuỗi YYYY-MM-DD sang dd/mm/yyyy
const formatDateDisplay = (dateStr) => (!dateStr ? '—' : formatVietnamDate(dateStr))

export default function StockReceiptDetail() {
  const { receiptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState(null)
  const [confirmRequest, setConfirmRequest] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)

  // Edit dialog state (Thiết kế đúng theo hình 2: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày xuất hóa đơn, Ghi chú)
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
    setEditReceivedAt(getVietnamDateInputValue(receipt?.receivedAt))
    setEditInvoiceDate(receipt?.invoiceDate ? getVietnamDateInputValue(receipt.invoiceDate) : '')
    setEditNote(receipt?.note || '')
    setEditError('')
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editSupplier.trim()) {
      setEditError('Vui lòng nhập tên nhà cung cấp.')
      return
    }
    const todayVn = getVietnamDateInputValue()
    if (!editReceivedAt || !isValidYmdDate(editReceivedAt)) {
      setEditError('Ngày nhập kho không hợp lệ.')
      return
    }
    if (editReceivedAt > todayVn) {
      setEditError('Ngày nhập kho không được ở tương lai.')
      return
    }
    if (editInvoiceDate) {
      if (!isValidYmdDate(editInvoiceDate)) {
        setEditError('Ngày xuất hóa đơn không hợp lệ.')
        return
      }
      if (editInvoiceDate > todayVn) {
        setEditError('Ngày xuất hóa đơn không được ở tương lai.')
        return
      }
      if (editInvoiceDate > editReceivedAt) {
        setEditError('Ngày xuất hóa đơn không được sau ngày nhập kho thực tế.')
        return
      }
    }
    setEditBusy(true)
    setEditError('')

    const receivedDateUnchanged = editReceivedAt === getVietnamDateInputValue(receipt?.receivedAt)
    const isoReceivedAt =
      editReceivedAt && !receivedDateUnchanged ? toReceiptReceivedAtIso(editReceivedAt) : receipt?.receivedAt
    const isoInvoiceDate = editInvoiceDate ? toSafeInvoiceDateIso(editInvoiceDate) : null
    const noteVal = editNote.trim() || null

    // Chỉ cập nhật các trường được phép: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày xuất hóa đơn, Ghi chú
    const payload = {
      supplierName: editSupplier.trim(),
      invoiceNumber: editInvoiceNumber.trim() || null,
      receivedAt: isoReceivedAt,
      invoiceDate: isoInvoiceDate,
      note: noteVal,
    }

    try {
      await inventoryService.updateStockReceipt(receiptId, payload)
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
    const invalid = invoiceFileError(file)
    if (invalid) return setError(invalid)
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

  const cancelReceipt = () =>
    setConfirmRequest({
      title: 'Hủy phiếu nhập?',
      message: 'Số hàng của phiếu sẽ bị trừ khỏi tồn kho. Không hoàn tác được; nếu sai mặt hàng, hãy tạo phiếu mới sau khi hủy.',
      confirmText: 'Hủy phiếu',
      reasonLabel: 'Lý do hủy phiếu',
      onConfirm: doCancelReceipt,
    })

  const doCancelReceipt = async (reason) => {
    setBusy(true)
    setError('')
    try {
      await inventoryService.cancelStockReceipt(receiptId, reason)
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
  const currentNote = receipt?.note || ''
  const currentInvoiceDate = receipt?.invoiceDate || ''
  const showsCreatedAt = Boolean(receipt?.createdAt) && formatDate(receipt.createdAt) !== formatDate(receipt.receivedAt)

  return (
    <PortalLayout headerTitle="Chi tiết phiếu nhập" headerSubtitle="Thông tin chứng từ, hàng hóa và hóa đơn">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>
            Nhập kho
          </Button>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {receipt && !isCancelled && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<ComponentsIcon />}
                  onClick={() => navigate(`/class-setup/admin/components?received=receipt&receipt=${receiptId}`)}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Xem linh kiện của phiếu
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => setCheckOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Đối chiếu với Excel
                </Button>
              </>
            )}
            {receipt?.invoiceUrl && (
              <Button
                variant="outlined"
                href={receipt.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Xem hóa đơn
              </Button>
            )}
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
        {location.state?.invoiceError && receipt && !receipt.invoiceUrl && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" component="label" size="small" disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Tải lại hóa đơn
                <input
                  type="file"
                  hidden
                  accept={INVOICE_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    uploadInvoice(file)
                  }}
                />
              </Button>
            }
          >
            Phiếu đã lưu và nhập kho, nhưng chưa tải lên được tệp hóa đơn: {location.state.invoiceError}
          </Alert>
        )}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        {receipt && (
          <>
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={800}>{receipt.receiptCode || receipt.receiptId}</Typography>
                  <Chip label={receiptStatusOf(receipt.status).label} color={isCancelled ? 'default' : 'success'} />
                </Box>
                {isCancelled && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Đã hủy{receipt.cancelledAt ? ` lúc ${formatDateTime(receipt.cancelledAt)}` : ''}
                    {receipt.cancelledByName ? ` bởi ${receipt.cancelledByName}` : ''}
                    {receipt.cancelReason ? `. Lý do: ${receipt.cancelReason}` : ''}
                  </Alert>
                )}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography color="text.secondary" fontSize={13}>Nhà cung cấp</Typography>
                    <Typography fontWeight={600}>{receipt.supplierName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <Typography color="text.secondary" fontSize={13}>Số hóa đơn</Typography>
                    <Typography fontWeight={600}>{receipt.invoiceNumber || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <Typography color="text.secondary" fontSize={13}>Ngày nhập kho</Typography>
                    <Typography fontWeight={600}>{formatDateTime(receipt.receivedAt)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <Typography color="text.secondary" fontSize={13}>Ngày xuất hóa đơn</Typography>
                    <Typography fontWeight={600}>{currentInvoiceDate ? formatDate(currentInvoiceDate) : '—'}</Typography>
                  </Grid>
                  {showsCreatedAt && (
                    <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                      <Typography color="text.secondary" fontSize={13}>Ngày tạo phiếu</Typography>
                      <Typography fontWeight={600} fontSize={13.5}>{formatDateTime(receipt.createdAt)}</Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                    <Typography color="text.secondary" fontSize={13}>Tổng tiền</Typography>
                    <Typography fontWeight={700} color="primary">{money(receipt.totalAmount)} ₫</Typography>
                  </Grid>

                  {currentNote && (
                    <Grid size={{ xs: 12 }}>
                      <Typography color="text.secondary" fontSize={13}>Ghi chú</Typography>
                      <Typography fontWeight={600} sx={{ whiteSpace: 'pre-wrap' }}>{currentNote}</Typography>
                    </Grid>
                  )}
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
                    const units = getUnits(line)
                    const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0)
                    return (
                      <TableRow key={line.receiptItemId || line.id || idx} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {line.componentName || '—'}
                          <Typography sx={{ color: '#0058be', fontWeight: 700, fontSize: 12 }}>{line.componentCode}</Typography>
                        </TableCell>
                        <TableCell>{Number(line.quantity || 0).toLocaleString('vi-VN')}</TableCell>
                        <TableCell>
                          {Number(line.unitPrice || 0) === 0 ? (
                            <Chip size="small" label="0 ₫ (Cho tặng)" color="info" variant="outlined" sx={{ fontSize: 11 }} />
                          ) : (
                            `${money(line.unitPrice)} ₫`
                          )}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{money(lineTotal)} ₫</TableCell>
                        <TableCell>{line.cabinetName || line.cabinetCode || '—'}</TableCell>
                        <TableCell>
                          {units.length > 0 ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {units.map((unit) => (
                                <Chip
                                  key={unit.itemId}
                                  size="small"
                                  label={[unit.itemCode, unit.serialNumber, unit.hardwareVersion].filter(Boolean).join(' · ')}
                                />
                              ))}
                            </Box>
                          ) : (
                            '—'
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

            {/* NGÀY THÁNG (Gồm Ngày nhận và Ngày xuất hóa đơn) */}
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
                    Ngày nhập kho (thực tế)
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
                    max={getVietnamDateInputValue()}
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

                {/* Dòng Ngày xuất hóa đơn */}
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
                    Ngày xuất hóa đơn
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 14, color: editInvoiceDate ? '#1e293b' : '#94a3b8' }}>
                      {editInvoiceDate ? formatDateDisplay(editInvoiceDate) : '—'}
                    </Typography>
                    {editInvoiceDate && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditInvoiceDate('')
                        }}
                        sx={{ p: 0.25, zIndex: 2, color: '#94a3b8' }}
                        title="Xóa ngày xuất hóa đơn"
                      >
                        <CloseIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                    <ChevronRightIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                  </Box>
                  <input
                    ref={invoiceDateInputRef}
                    type="date"
                    max={editReceivedAt || getVietnamDateInputValue()}
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
      {checkOpen && (
        <ReceiptExcelCheckDialog receiptCode={receipt.receiptCode} lines={lines} onClose={() => setCheckOpen(false)} />
      )}
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </PortalLayout>
  )
}
