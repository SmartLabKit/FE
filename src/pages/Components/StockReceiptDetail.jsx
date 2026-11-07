import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material'
import { ArrowBack as BackIcon, CancelOutlined as CancelIcon } from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const getLines = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const getSerials = (line) => Array.isArray(line.serialNumbers || line.serials) ? (line.serialNumbers || line.serials) : []
const money = (value) => Number(value || 0).toLocaleString('vi-VN')
const date = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—'

export default function StockReceiptDetail() {
  const { receiptId } = useParams()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

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

  return (
    <PortalLayout headerTitle="Chi tiết phiếu nhập" headerSubtitle="Thông tin chứng từ, hàng hóa và hóa đơn">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>Danh sách phiếu</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button disabled={!receipt || isCancelled || receipt.status === 'Cancelled'} onClick={() => navigate(`/class-setup/admin/stock-inwards?edit=${receiptId}`)} sx={{ textTransform: 'none' }}>Sửa phiếu</Button>
            <Button disabled={!receipt || isCancelled || receipt.status === 'Cancelled' || busy} color="error" startIcon={<CancelIcon />} onClick={cancelReceipt} sx={{ textTransform: 'none' }}>Hủy phiếu</Button>
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
        {receipt && <>
          <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight={800}>{receipt.receiptCode || receipt.receiptId}</Typography>
                <Chip label={receipt.status || '—'} color={isCancelled ? 'default' : 'success'} />
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Nhà cung cấp</Typography><Typography>{receipt.supplierName || '—'}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Số chứng từ</Typography><Typography>{receipt.invoiceNumber || '—'}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Ngày nhận</Typography><Typography>{date(receipt.receivedAt)}</Typography></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}><Typography color="text.secondary">Tổng tiền</Typography><Typography fontWeight={700}>{money(receipt.totalAmount)} ₫</Typography></Grid>
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
      </Box>
    </PortalLayout>
  )
}
