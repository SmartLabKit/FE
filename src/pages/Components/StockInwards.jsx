import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  CancelOutlined as CancelIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import {
  getVietnamDateInputValue,
  toReceiptReceivedAtIso,
  toSafeInvoiceDateIso,
} from '../../utils/dateFormatting'

const today = getVietnamDateInputValue()
const defaultWarrantyDate = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const newLine = () => ({
  key: `${Date.now()}-${Math.random()}`,
  componentId: '',
  quantity: '1',
  unitPrice: '0',
  cabinetId: '',
  serialsText: '',
  version: '1.0',
  warrantyExpiresAt: defaultWarrantyDate(),
})
const lineArray = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const serialList = (value) => (Array.isArray(value) ? value : [])

export default function StockInwards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [components, setComponents] = useState([])
  const [cabinets, setCabinets] = useState([])
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [receivedAt, setReceivedAt] = useState(getVietnamDateInputValue())
  const [invoiceDate, setInvoiceDate] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)

  const componentMap = useMemo(
    () => new Map(components.map((item) => [item.componentId, item])),
    [components]
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [componentList, cabinetList] = await Promise.all([
          inventoryService.getComponents(),
          inventoryService.getCabinets(),
        ])
        if (!active) return
        setComponents(componentList)
        setCabinets(cabinetList)
        if (editId) {
          const receipt = await inventoryService.getStockReceipt(editId)
          if (!active) return
          setSupplier(receipt.supplierName || '')
          setInvoiceNumber(receipt.invoiceNumber || '')
          setReceivedAt(getVietnamDateInputValue(receipt.receivedAt) || getVietnamDateInputValue())
          const rawInvDate =
            receipt.invoiceDate ||
            receipt.InvoiceDate ||
            localStorage.getItem(`receipt_invoice_date_${editId}`) ||
            ''
          setInvoiceDate(getVietnamDateInputValue(rawInvDate))
          setNote(
            receipt.note ||
              receipt.notes ||
              receipt.description ||
              receipt.remark ||
              receipt.remarks ||
              localStorage.getItem(`receipt_note_${editId}`) ||
              ''
          )
          setLines(
            lineArray(receipt).map((line) => {
              const units = line.units || line.Units || []
              const firstUnit = units[0] || {}
              return {
                ...newLine(),
                componentId: line.componentId || '',
                componentName: line.componentName || line.componentCode || '',
                cabinetName: line.cabinetName || line.cabinetCode || '',
                quantity: String(line.quantity ?? ''),
                unitPrice: String(line.unitPrice ?? ''),
                cabinetId: line.cabinetId || '',
                serialsText:
                  units.length > 0
                    ? units.map((u) => u.serialNumber || u.SerialNumber || '').filter(Boolean).join('\n')
                    : serialList(line.serialNumbers || line.serials)
                        .map((serial) => (typeof serial === 'string' ? serial : serial.serialNumber))
                        .join('\n'),
                version: firstUnit.hardwareVersion || firstUnit.HardwareVersion || line.version || '1.0',
                warrantyExpiresAt: firstUnit.warrantyExpiresAt
                  ? firstUnit.warrantyExpiresAt.slice(0, 10)
                  : defaultWarrantyDate(),
              }
            })
          )
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu nhập kho.'))
      } finally {
        if (active) setInitialLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [editId])

  const updateLine = (key, patch) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const selectedComponent = (line) => componentMap.get(line.componentId)

  // Hủy phiếu hiện tại và tạo phiếu mới khi có sai sót về mặt hàng
  const handleCancelAndRecreate = async () => {
    if (!editId) return
    if (!window.confirm('Bạn có chắc chắn muốn hủy phiếu nhập này? Sau khi hủy, hệ thống sẽ mở form tạo phiếu mới.')) {
      return
    }
    setLoading(true)
    try {
      await inventoryService.cancelStockReceipt(editId)
      navigate('/class-setup/admin/stock-inwards')
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiếu nhập.'))
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const todayVn = getVietnamDateInputValue()
    if (!supplier.trim()) return setError('Vui lòng nhập nhà cung cấp.')
    if (!receivedAt) return setError('Vui lòng chọn ngày nhận hàng.')
    if (receivedAt > todayVn) return setError('Ngày nhận hàng không được ở tương lai.')
    if (invoiceDate && invoiceDate > todayVn) return setError('Ngày hóa đơn không được ở tương lai.')

    const noteVal = note.trim() || null
    const isoReceivedAt = toReceiptReceivedAtIso(receivedAt)
    const isoInvoiceDate = toSafeInvoiceDateIso(invoiceDate)

    // TRƯỜNG HỢP SỬA PHIẾU: Chỉ được sửa các thông tin Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày hóa đơn, Ghi chú
    if (editId) {
      setLoading(true)
      try {
        const payload = {
          supplierName: supplier.trim(),
          invoiceNumber: invoiceNumber.trim() || null,
          receivedAt: isoReceivedAt,
          invoiceDate: isoInvoiceDate,
          note: noteVal,
          notes: noteVal,
          description: noteVal,
          remarks: noteVal,
          SupplierName: supplier.trim(),
          InvoiceNumber: invoiceNumber.trim() || null,
          ReceivedAt: isoReceivedAt,
          InvoiceDate: isoInvoiceDate,
        }

        await inventoryService.updateStockReceipt(editId, payload)

        if (invoiceDate) {
          localStorage.setItem(`receipt_invoice_date_${editId}`, invoiceDate)
        } else {
          localStorage.removeItem(`receipt_invoice_date_${editId}`)
        }

        if (noteVal) {
          localStorage.setItem(`receipt_note_${editId}`, noteVal)
        } else {
          localStorage.removeItem(`receipt_note_${editId}`)
        }

        navigate(`/class-setup/admin/stock-receipts/${editId}`)
      } catch (saveError) {
        setError(extractErrorMessage(saveError, 'Không thể cập nhật phiếu nhập.'))
      } finally {
        setLoading(false)
      }
      return
    }

    // TRƯỜNG HỢP TẠO MỚI PHIẾU NHẬP
    if (lines.length === 0) return setError('Cần ít nhất một dòng hàng.')
    for (const [index, line] of lines.entries()) {
      const comp = selectedComponent(line)
      const compName = comp ? `${comp.componentCode} - ${comp.componentName}` : `Dòng #${index + 1}`
      if (!line.componentId) return setError(`Vui lòng chọn linh kiện ở dòng #${index + 1}.`)
      if (!line.cabinetId) return setError(`Vui lòng chọn tủ cất cho ${compName}.`)
      const q = Number(line.quantity)
      if (!Number.isInteger(q) || q <= 0) return setError(`Số lượng của ${compName} phải là số nguyên > 0.`)
      const p = Number(line.unitPrice)
      if (Number.isNaN(p) || p < 0) return setError(`Đơn giá của ${compName} không hợp lệ.`)
      if (comp?.trackingType === 'HIGH_VALUE') {
        const serials = line.serialsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (serials.length !== q) {
          return setError(
            `Linh kiện giá trị cao "${comp.componentName}" yêu cầu đúng ${q} số serial (hiện có ${serials.length}).`
          )
        }
        const set = new Set(serials)
        if (set.size !== serials.length) {
          return setError(`Danh sách serial của "${comp.componentName}" bị trùng lặp. Mỗi máy phải có serial riêng.`)
        }
        if (!line.warrantyExpiresAt) {
          return setError(`Vui lòng chọn ngày "Bảo hành đến" cho ${compName}.`)
        }
      }
    }

    const payload = {
      supplierName: supplier.trim(),
      invoiceNumber: invoiceNumber.trim() || null,
      receivedAt: isoReceivedAt,
      invoiceDate: isoInvoiceDate,
      note: noteVal,
      notes: noteVal,
      description: noteVal,
      remarks: noteVal,
      items: lines.map((line) => {
        const comp = selectedComponent(line)
        const isHighValue = comp?.trackingType === 'HIGH_VALUE'
        const serialNumbers = isHighValue
          ? line.serialsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined
        return {
          componentId: line.componentId,
          cabinetId: line.cabinetId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          ...(isHighValue
            ? {
                warrantyExpiresAt: line.warrantyExpiresAt ? `${line.warrantyExpiresAt}T00:00:00Z` : undefined,
                serialNumbers,
                version: (line.version || '1.0').trim(),
              }
            : {}),
        }
      }),
    }

    setLoading(true)
    try {
      const receipt = await inventoryService.createStockReceipt(payload)
      const id = receipt?.receiptId || receipt?.id
      if (!id) throw new Error('Phiếu đã gửi nhưng API không trả receiptId.')
      if (invoiceDate) {
        localStorage.setItem(`receipt_invoice_date_${id}`, invoiceDate)
      }
      if (noteVal) {
        localStorage.setItem(`receipt_note_${id}`, noteVal)
      } else {
        localStorage.removeItem(`receipt_note_${id}`)
      }
      navigate(`/class-setup/admin/stock-receipts/${id}`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu phiếu nhập.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout
      headerTitle={editId ? 'Sửa thông tin phiếu nhập' : 'Lập phiếu nhập kho'}
      headerSubtitle={
        editId
          ? 'Chỉ được sửa Nhà cung cấp, Số hóa đơn, Ngày nhận và Ngày hóa đơn. Không được sửa mặt hàng.'
          : 'Chọn tủ cất trên từng dòng; lưu phiếu là hàng vào kho ngay'
      }
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() =>
              navigate(editId ? `/class-setup/admin/stock-receipts/${editId}` : '/class-setup/admin/stock-receipts')
            }
            sx={{ textTransform: 'none' }}
          >
            {editId ? 'Chi tiết phiếu nhập' : 'Danh sách phiếu nhập'}
          </Button>
          <Button onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none' }}>
            Danh sách linh kiện
          </Button>
        </Box>

        <Card
          component="form"
          onSubmit={handleSubmit}
          variant="outlined"
          sx={{ borderColor: '#d8dced', boxShadow: 'none' }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography sx={{ mb: 0.5, fontWeight: 800, color: '#182238' }}>Thông tin phiếu</Typography>
            <Typography sx={{ mb: 2, color: '#697386', fontSize: 12 }}>
              {editId
                ? 'Chỉ chỉnh sửa thông tin chứng từ. Hàng hóa đã vào kho không thể sửa trực tiếp.'
                : 'Linh kiện cần được khai báo trước. Việc khai báo không làm tăng tồn kho.'}
            </Typography>

            {editId && (
              <Alert severity="warning" sx={{ mb: 2.5 }}>
                <strong>Quy định:</strong> Không sửa được mặt hàng. Nếu sai sót về hàng hóa, vui lòng{' '}
                <strong>Hủy phiếu</strong> và tạo phiếu mới.
              </Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Các trường thông tin phiếu: Nhà cung cấp, Số hóa đơn, Ngày nhận, Ngày hóa đơn, Ghi chú */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  required
                  label="Nhà cung cấp"
                  placeholder="Nhập tên nhà cung cấp..."
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Số hóa đơn"
                  placeholder="Nhập số hóa đơn..."
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  required
                  type="date"
                  label="Ngày nhận"
                  value={receivedAt}
                  onChange={(event) => setReceivedAt(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: getVietnamDateInputValue() },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày hóa đơn"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: getVietnamDateInputValue() },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Ghi chú"
                  placeholder="Không bắt buộc"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Grid>
            </Grid>

            {/* DÒNG HÀNG */}
            {editId ? (
              // KHI SỬA PHIẾU: Hiển thị bảng chỉ xem, KHÔNG CHO PHÉP SỬA MẶT HÀNG
              <Box sx={{ mt: 3 }}>
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    Mặt hàng đã nhập ({lines.length} dòng hàng — Chỉ xem, không thể sửa)
                  </Typography>
                </Box>
                <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9ff' }}>
                        {['Linh kiện', 'Số lượng', 'Đơn giá', 'Tủ lưu trữ', 'Thông tin máy / Serial'].map((head) => (
                          <TableCell key={head} sx={{ fontWeight: 600 }}>{head}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((line) => {
                        const comp = selectedComponent(line)
                        return (
                          <TableRow key={line.key}>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {comp ? `${comp.componentCode} — ${comp.componentName}` : line.componentName || '—'}
                            </TableCell>
                            <TableCell>{line.quantity}</TableCell>
                            <TableCell>{Number(line.unitPrice || 0).toLocaleString('vi-VN')} ₫</TableCell>
                            <TableCell>
                              {cabinets.find((c) => c.cabinetId === line.cabinetId)?.cabinetName || line.cabinetName || '—'}
                            </TableCell>
                            <TableCell>
                              {line.serialsText ? (
                                <Typography sx={{ fontSize: 12, whiteSpace: 'pre-line' }}>{line.serialsText}</Typography>
                              ) : (
                                line.version ? `Version: ${line.version}` : '—'
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography sx={{ color: '#94a3b8', fontSize: 12.5, mt: 1.5 }}>
                  Không sửa được mặt hàng. Hãy hủy phiếu và tạo phiếu mới nếu thông tin hàng hóa bị sai.
                </Typography>
              </Box>
            ) : (
              // KHI TẠO MỚI PHIẾU: Cho phép thêm dòng hàng và chỉnh sửa linh kiện bình thường
              <Box sx={{ mt: 3 }}>
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800 }}>Dòng hàng</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setLines((current) => [...current, newLine()])}
                    sx={{ textTransform: 'none' }}
                  >
                    Thêm dòng
                  </Button>
                </Box>
                <TableContainer sx={{ border: '1px solid #d8dced' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9ff' }}>
                        {['Linh kiện', 'Số lượng', 'Đơn giá', 'Tủ cất', 'Thông tin máy (Serial / Version / Bảo hành)', ''].map(
                          (head, idx) => (
                            <TableCell key={head || idx}>{head}</TableCell>
                          )
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((line) => {
                        const component = selectedComponent(line)
                        const isHighValue = component?.trackingType === 'HIGH_VALUE'
                        return (
                          <TableRow key={line.key}>
                            <TableCell sx={{ minWidth: 240 }}>
                              <TextField
                                fullWidth
                                required
                                select
                                size="small"
                                label="Chọn linh kiện"
                                value={line.componentId}
                                onChange={(event) => updateLine(line.key, { componentId: event.target.value })}
                              >
                                {components.map((item) => (
                                  <MenuItem key={item.componentId} value={item.componentId}>
                                    {item.componentCode} — {item.componentName} ({item.trackingType})
                                  </MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell sx={{ minWidth: 105 }}>
                              <TextField
                                required
                                type="number"
                                size="small"
                                label="SL"
                                value={line.quantity}
                                onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 145 }}>
                              <TextField
                                required
                                type="number"
                                size="small"
                                label="Đơn giá"
                                value={line.unitPrice}
                                onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 210 }}>
                              <TextField
                                fullWidth
                                required
                                select
                                size="small"
                                label="Tủ lưu trữ"
                                value={line.cabinetId}
                                onChange={(event) => updateLine(line.key, { cabinetId: event.target.value })}
                              >
                                {cabinets
                                  .filter((cabinet) => cabinet.isActive !== false)
                                  .map((cabinet) => (
                                    <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>
                                      {cabinet.cabinetCode} — {cabinet.cabinetName || cabinet.name}{' '}
                                      {cabinet.labRoomName ? `(${cabinet.labRoomName})` : ''}
                                    </MenuItem>
                                  ))}
                              </TextField>
                            </TableCell>
                            <TableCell sx={{ minWidth: 280 }}>
                              {isHighValue ? (
                                <Box sx={{ display: 'grid', gap: 1 }}>
                                  <TextField
                                    required
                                    size="small"
                                    label={
                                      Number(line.quantity) > 1
                                        ? `Serial (${line.quantity} máy, mỗi dòng 1 serial) *`
                                        : 'Số Serial *'
                                    }
                                    placeholder={Number(line.quantity) > 1 ? 'SN-001\nSN-002' : 'VD: SE2027_2351_2132'}
                                    multiline={Number(line.quantity) > 1}
                                    minRows={Number(line.quantity) > 1 ? 2 : 1}
                                    value={line.serialsText}
                                    onChange={(event) => updateLine(line.key, { serialsText: event.target.value })}
                                  />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                    <TextField
                                      required
                                      size="small"
                                      label="Version *"
                                      value={line.version}
                                      onChange={(event) => updateLine(line.key, { version: event.target.value })}
                                    />
                                    <TextField
                                      required
                                      type="date"
                                      size="small"
                                      label="Bảo hành đến *"
                                      value={line.warrantyExpiresAt}
                                      onChange={(event) =>
                                        updateLine(line.key, { warrantyExpiresAt: event.target.value })
                                      }
                                      slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                  </Box>
                                </Box>
                              ) : (
                                <Typography color="text.secondary" fontSize={12}>
                                  {component ? component.trackingType : 'Chọn linh kiện'}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                aria-label="Xóa dòng"
                                color="error"
                                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                              >
                                <DeleteIcon />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {initialLoading && (
              <Typography sx={{ mt: 1 }} color="text.secondary">
                Đang tải dữ liệu…
              </Typography>
            )}

            {/* Các nút bấm hành động */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                onClick={() =>
                  navigate(editId ? `/class-setup/admin/stock-receipts/${editId}` : '/class-setup/admin/stock-receipts')
                }
                sx={{ textTransform: 'none' }}
              >
                Hủy
              </Button>

              {editId && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  disabled={loading}
                  onClick={handleCancelAndRecreate}
                  sx={{ textTransform: 'none' }}
                >
                  Hủy phiếu và tạo phiếu mới
                </Button>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={loading || initialLoading}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {loading ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Lưu phiếu và nhập kho'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
