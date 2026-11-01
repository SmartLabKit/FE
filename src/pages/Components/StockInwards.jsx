import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon, ArrowBack as BackIcon, Delete as DeleteIcon,
} from '@mui/icons-material'
import {
  Alert, Box, Button, Card, CardContent, Grid, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const newLine = () => ({ key: `${Date.now()}-${Math.random()}`, componentId: '', quantity: '1', unitPrice: '', cabinetId: '', serialsText: '', version: '' })
const lineArray = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const serialList = (value) => Array.isArray(value) ? value : []

export default function StockInwards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [components, setComponents] = useState([])
  const [cabinets, setCabinets] = useState([])
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [receivedAt, setReceivedAt] = useState(today)
  const [lines, setLines] = useState([newLine()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)

  const componentMap = useMemo(() => new Map(components.map((item) => [item.componentId, item])), [components])

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
          setReceivedAt((receipt.receivedAt || today).slice(0, 10))
          setLines(lineArray(receipt).map((line) => ({
            ...newLine(),
            componentId: line.componentId || '',
            quantity: String(line.quantity ?? ''),
            unitPrice: String(line.unitPrice ?? ''),
            cabinetId: line.cabinetId || '',
            serialsText: serialList(line.serialNumbers || line.serials).map((serial) => typeof serial === 'string' ? serial : serial.serialNumber).join('\n'),
            version: line.version || '',
          })))
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu nhập kho.'))
      } finally {
        if (active) setInitialLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [editId])

  const updateLine = (key, patch) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))
  const selectedComponent = (line) => componentMap.get(line.componentId)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const preparedLines = lines.map((line) => {
      const quantity = Number(line.quantity)
      const component = selectedComponent(line)
      const serialNumbers = line.serialsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      return { line, component, quantity, unitPrice: Number(line.unitPrice), serialNumbers }
    })
    if (!supplier.trim()) return setError('Vui lòng nhập nhà cung cấp.')
    if (!preparedLines.length || preparedLines.some(({ line, quantity, unitPrice }) => (
      !line.componentId || !line.cabinetId || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0
    ))) return setError('Mỗi dòng cần có linh kiện, số lượng nguyên dương, đơn giá hợp lệ và tủ lưu trữ.')
    const invalidHighValue = preparedLines.find(({ line, component, quantity, serialNumbers }) => (
      component?.trackingType === 'HIGH_VALUE' && (serialNumbers.length !== quantity || serialNumbers.some((serial) => !serial.trim()) || !line.version.trim())
    ))
    if (invalidHighValue) return setError(`Linh kiện ${invalidHighValue.component?.componentName || ''} cần đúng ${invalidHighValue.quantity} serial và có version.`)
    const payload = {
      supplierName: supplier.trim(),
      invoiceNumber: invoiceNumber.trim() || null,
      receivedAt: `${receivedAt}T00:00:00Z`,
      items: preparedLines.map(({ line, quantity, unitPrice, serialNumbers, component }) => ({
        componentId: line.componentId,
        cabinetId: line.cabinetId,
        quantity,
        unitPrice,
        ...(component?.trackingType === 'HIGH_VALUE' ? { serialNumbers, version: line.version.trim() } : {}),
      })),
    }
    setLoading(true)
    try {
      const receipt = editId
        ? await inventoryService.updateStockReceipt(editId, payload)
        : await inventoryService.createStockReceipt(payload)
      const id = receipt?.receiptId || receipt?.id || editId
      if (!id) throw new Error('Phiếu đã gửi nhưng API không trả receiptId.')
      navigate(`/class-setup/admin/stock-receipts/${id}`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu phiếu nhập.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout headerTitle={editId ? 'Sửa phiếu nhập' : 'Lập phiếu nhập kho'} headerSubtitle="Chọn tủ cất trên từng dòng; lưu phiếu là hàng vào kho ngay">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>Danh sách phiếu nhập</Button>
          <Button onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none' }}>Danh sách linh kiện</Button>
        </Box>
        <Card component="form" onSubmit={handleSubmit} variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography sx={{ mb: 0.5, fontWeight: 800, color: '#182238' }}>Thông tin phiếu</Typography>
            <Typography sx={{ mb: 2, color: '#697386', fontSize: 12 }}>Linh kiện cần được khai báo trước. Việc khai báo không làm tăng tồn kho.</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth required label="Nhà cung cấp" value={supplier} onChange={(event) => setSupplier(event.target.value)} /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Số chứng từ" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth required type="date" label="Ngày nhận" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            </Grid>
            <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 800 }}>Dòng hàng</Typography>
              <Button startIcon={<AddIcon />} onClick={() => setLines((current) => [...current, newLine()])} sx={{ textTransform: 'none' }}>Thêm dòng</Button>
            </Box>
            <TableContainer sx={{ border: '1px solid #d8dced' }}>
              <Table size="small">
                <TableHead><TableRow sx={{ bgcolor: '#faf9ff' }}>{['Linh kiện', 'Số lượng', 'Đơn giá', 'Tủ cất', 'Serial / Version', ''].map((head) => <TableCell key={head}>{head}</TableCell>)}</TableRow></TableHead>
                <TableBody>{lines.map((line) => {
                  const component = selectedComponent(line)
                  const isHighValue = component?.trackingType === 'HIGH_VALUE'
                  return <TableRow key={line.key}>
                    <TableCell sx={{ minWidth: 240 }}><TextField fullWidth required select size="small" label="Chọn linh kiện" value={line.componentId} onChange={(event) => updateLine(line.key, { componentId: event.target.value })}>
                      {components.map((item) => <MenuItem key={item.componentId} value={item.componentId}>{item.componentCode} — {item.componentName} ({item.trackingType})</MenuItem>)}
                    </TextField></TableCell>
                    <TableCell sx={{ minWidth: 105 }}><TextField required type="number" size="small" label="SL" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} /></TableCell>
                    <TableCell sx={{ minWidth: 145 }}><TextField required type="number" size="small" label="Đơn giá" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} slotProps={{ htmlInput: { min: 0, step: 1 } }} /></TableCell>
                    <TableCell sx={{ minWidth: 210 }}><TextField fullWidth required select size="small" label="Tủ lưu trữ" value={line.cabinetId} onChange={(event) => updateLine(line.key, { cabinetId: event.target.value })}>
                      {cabinets.filter((cabinet) => cabinet.isActive !== false).map((cabinet) => <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>{cabinet.cabinetCode} — {cabinet.cabinetName || cabinet.name} {cabinet.labRoomName ? `(${cabinet.labRoomName})` : ''}</MenuItem>)}
                    </TextField></TableCell>
                    <TableCell sx={{ minWidth: 230 }}>{isHighValue ? <Box sx={{ display: 'grid', gap: 1 }}>
                      <TextField required size="small" label="Serial (mỗi dòng một serial)" multiline minRows={2} value={line.serialsText} onChange={(event) => updateLine(line.key, { serialsText: event.target.value })} />
                      <TextField required size="small" label="Version" value={line.version} onChange={(event) => updateLine(line.key, { version: event.target.value })} />
                    </Box> : <Typography color="text.secondary" fontSize={12}>{component ? component.trackingType : 'Chọn linh kiện'}</Typography>}</TableCell>
                    <TableCell><Button aria-label="Xóa dòng" color="error" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><DeleteIcon /></Button></TableCell>
                  </TableRow>
                })}</TableBody>
              </Table>
            </TableContainer>
            {initialLoading && <Typography sx={{ mt: 1 }} color="text.secondary">Đang tải dữ liệu…</Typography>}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button onClick={() => navigate('/class-setup/admin/stock-receipts')}>Hủy</Button>
              <Button type="submit" variant="contained" disabled={loading || initialLoading}>{loading ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Lưu phiếu và nhập kho'}</Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
