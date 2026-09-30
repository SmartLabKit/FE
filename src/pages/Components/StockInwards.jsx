import { useMemo, useState } from 'react'
import {
  ArrowBack as BackIcon,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
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
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  getPendingInboundComponents,
  getStockInwards,
  saveStockInward,
} from './componentStore'

const today = new Date()
const todayInputValue = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-')

const suppliers = [
  'Công ty TNHH Linh kiện Điện tử Việt',
  'Farnell Electronics',
  'Seeed Studio',
  'Adafruit Industries',
  'Digi-Key Electronics',
]

export default function StockInwards() {
  const location = useLocation()
  const navigate = useNavigate()
  const pendingComponents = useMemo(() => getPendingInboundComponents(), [])
  const [records] = useState(getStockInwards)
  const [selectedCodes, setSelectedCodes] = useState(() => (
    location.state?.componentCode &&
    pendingComponents.some((component) => component.code === location.state.componentCode)
      ? [location.state.componentCode]
      : []
  ))
  const [supplier, setSupplier] = useState('')
  const [date, setDate] = useState(todayInputValue)
  const [quantities, setQuantities] = useState(() => Object.fromEntries(
    pendingComponents.map((component) => [component.code, String(component.expectedQuantity || '')])
  ))
  const [unitPrices, setUnitPrices] = useState({})
  const [error, setError] = useState('')

  const selectedComponents = selectedCodes
    .map((code) => pendingComponents.find((component) => component.code === code))
    .filter(Boolean)

  const savedRecords = records.length - 7
  const nextSequence = 105 + savedRecords
  const inwardCode = `NK-${today.getFullYear()}-${String(nextSequence).padStart(3, '0')}`

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (selectedComponents.length === 0) {
      setError('Vui lòng chọn ít nhất một linh kiện đang chờ nhập kho.')
      return
    }
    if (!supplier) {
      setError('Vui lòng chọn nhà cung cấp.')
      return
    }

    const items = selectedComponents.map((component) => ({
      componentCode: component.code,
      quantity: Number(quantities[component.code]),
      unitPrice: Number(unitPrices[component.code] || 0),
    }))
    const invalidItem = items.find((item) => !Number.isInteger(item.quantity) || item.quantity < 1)
    if (invalidItem) {
      const component = selectedComponents.find((item) => item.code === invalidItem.componentCode)
      setError(`Số lượng thực nhận của ${component.name} phải là số nguyên lớn hơn 0.`)
      return
    }
    const invalidPrice = items.find((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)
    if (invalidPrice) {
      const component = selectedComponents.find((item) => item.code === invalidPrice.componentCode)
      setError(`Đơn giá của ${component.name} không hợp lệ.`)
      return
    }

    try {
      const record = saveStockInward({
        supplier,
        date,
        items,
        createdToday: date === todayInputValue,
      })
      navigate(`/class-setup/admin/storage-allocation/${record.id}`)
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu phiếu nhập kho. Vui lòng thử lại.')
    }
  }

  return (
    <PortalLayout
      headerTitle="Nhập kho linh kiện"
      headerSubtitle="Bước 3: Chọn linh kiện theo lô và ghi nhận số lượng thực nhận"
      headerSearchPlaceholder="Tìm linh kiện, mã linh kiện..."
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/class-setup/admin/components')}
            sx={{ textTransform: 'none', color: '#596477' }}
          >
            Quay lại danh mục
          </Button>
        </Box>

        <Card
          component="form"
          onSubmit={handleSubmit}
          variant="outlined"
          sx={{ borderColor: '#d8dced', borderRadius: 1, boxShadow: 'none' }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 14 }}>
                  Phiếu nhập kho
                </Typography>
                <Typography sx={{ color: '#697386', fontSize: 11 }}>
                  Chọn linh kiện chờ nhập, sau đó xác nhận số lượng thực nhận.
                </Typography>
              </Box>
              <Chip label={inwardCode} size="small" sx={{ bgcolor: '#edf0ff', color: '#0865ce', fontWeight: 800 }} />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField
                  fullWidth
                  required
                  select
                  size="small"
                  label="Nhà cung cấp"
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                >
                  {suppliers.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  type="date"
                  label="Ngày nhập"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            {pendingComponents.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Hiện không có linh kiện nào đang chờ nhập kho. Hãy khai báo linh kiện mới trước.
              </Alert>
            ) : (
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={pendingComponents}
                value={selectedComponents}
                onChange={(_, values) => {
                  setSelectedCodes(values.map((component) => component.code))
                  setError('')
                }}
                getOptionLabel={(component) => `${component.name} ${component.code}`}
                isOptionEqualToValue={(option, value) => option.code === value.code}
                renderOption={(props, component, { selected }) => (
                  <li {...props}>
                    <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
                    <Box>
                      <Typography sx={{ color: '#263247', fontSize: 11 }}>{component.name}</Typography>
                      <Typography sx={{ color: '#697386', fontSize: 10 }}>
                        {component.code} · SL dự kiến {Number(component.expectedQuantity || 1).toLocaleString('vi-VN')}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Tìm linh kiện chờ nhập kho"
                    placeholder="Nhập tên hoặc mã linh kiện"
                  />
                )}
                sx={{ mb: 2 }}
              />
            )}

            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ color: '#596477', fontSize: 11 }}>
                Linh kiện đã chọn
              </Typography>
              <Chip
                label={`${selectedCodes.length} đã chọn`}
                size="small"
                sx={{ bgcolor: '#edf0ff', color: '#0865ce', fontWeight: 700 }}
              />
            </Box>

            {selectedComponents.length > 0 && (
              <>
                <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
                  <Table size="small" aria-label="Chi tiết phiếu nhập kho">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9ff' }}>
                        {['Linh kiện', 'Mã linh kiện', 'SL dự kiến', 'SL thực nhận', 'Đơn giá (VND)'].map((heading) => (
                          <TableCell key={heading} sx={{ color: '#6c7485', fontSize: 9, whiteSpace: 'nowrap' }}>
                            {heading}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedComponents.map((component) => (
                        <TableRow key={component.code}>
                          <TableCell sx={{ color: '#263247', fontSize: 10, minWidth: 110 }}>{component.name}</TableCell>
                          <TableCell sx={{ color: '#596477', fontSize: 9, whiteSpace: 'nowrap' }}>{component.code}</TableCell>
                          <TableCell sx={{ color: '#596477', fontSize: 10 }}>
                            {Number(component.expectedQuantity || 1).toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell sx={{ minWidth: 105 }}>
                            <TextField
                              required
                              type="number"
                              size="small"
                              value={quantities[component.code] ?? ''}
                              onChange={(event) => setQuantities((current) => ({
                                ...current,
                                [component.code]: event.target.value,
                              }))}
                              slotProps={{ htmlInput: { min: 1, step: 1, 'aria-label': `Số lượng thực nhận ${component.name}` } }}
                              sx={{ width: 92, '& .MuiInputBase-input': { py: 0.75, px: 1, fontSize: 11 } }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 112 }}>
                            <TextField
                              type="number"
                              size="small"
                              value={unitPrices[component.code] ?? ''}
                              onChange={(event) => setUnitPrices((current) => ({
                                ...current,
                                [component.code]: event.target.value,
                              }))}
                              slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': `Đơn giá ${component.name}` } }}
                              sx={{ width: 100, '& .MuiInputBase-input': { py: 0.75, px: 1, fontSize: 11 } }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ color: '#596477', fontSize: 11 }}>
                    Tổng số lượng:{' '}
                    <strong>
                      {selectedComponents.reduce((sum, component) => sum + Number(quantities[component.code] || 0), 0).toLocaleString('vi-VN')}
                    </strong>
                  </Typography>
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{ textTransform: 'none', bgcolor: '#0865ce', fontSize: 11, boxShadow: 'none', '&:hover': { bgcolor: '#0757b2', boxShadow: 'none' } }}
                  >
                    Gửi phiếu &amp; tiếp tục phân bổ
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
