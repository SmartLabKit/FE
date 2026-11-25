import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'
import { receiptStatusOf } from './inventoryLabels'

// Format hiển thị ngày theo chuẩn vi-VN: dd/mm/yyyy
const formatDate = (value) => formatVietnamDate(value)

// Chuyển đổi giá trị ngày sang YYYY-MM-DD theo giờ địa phương để so sánh chính xác
const toYMD = (val) => getVietnamDateInputValue(val)

const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN')

export default function StockReceipts() {
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState([])
  const [error, setError] = useState('')

  // Các state tìm kiếm và lọc
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // State phân trang: mặc định 10 phiếu 1 trang, cho phép đổi 10, 20, 30
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
    let active = true
    inventoryService
      .getStockReceipts()
      .then((items) => {
        if (active) setReceipts(items)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách phiếu nhập.'))
      })
    return () => {
      active = false
    }
  }, [])

  // Trích xuất danh sách nhà cung cấp duy nhất từ dữ liệu thực tế
  const suppliers = useMemo(() => {
    const set = new Set()
    receipts.forEach((r) => {
      if (r.supplierName?.trim()) {
        set.add(r.supplierName.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [receipts])

  // Trích xuất danh sách trạng thái thực tế có trong danh sách
  const statuses = useMemo(() => {
    const set = new Set(['Completed', 'Cancelled'])
    receipts.forEach((r) => {
      if (r.status?.trim()) {
        set.add(r.status.trim())
      }
    })
    return Array.from(set)
  }, [receipts])

  // Lọc dữ liệu theo từ khóa tìm kiếm, trạng thái, nhà cung cấp và khoảng ngày nhận
  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      // 1. Tìm theo từ khóa: mã phiếu, số hóa đơn / số chứng từ, nhà cung cấp
      if (keyword.trim()) {
        const query = keyword.trim().toLowerCase()
        const code = String(receipt.receiptCode || receipt.receiptId || '').toLowerCase()
        const supplier = String(receipt.supplierName || '').toLowerCase()
        const invoice = String(receipt.invoiceNumber || receipt.InvoiceNumber || '').toLowerCase()
        if (!code.includes(query) && !supplier.includes(query) && !invoice.includes(query)) {
          return false
        }
      }

      // 2. Lọc theo trạng thái
      if (statusFilter && receipt.status !== statusFilter) {
        return false
      }

      // 3. Lọc theo nhà cung cấp
      if (supplierFilter && receipt.supplierName !== supplierFilter) {
        return false
      }

      // 4. Lọc từ ngày nhận
      const receiptDateYMD = toYMD(receipt.receivedAt)
      if (fromDate) {
        if (!receiptDateYMD || receiptDateYMD < fromDate) {
          return false
        }
      }

      // 5. Lọc đến ngày nhận
      if (toDate) {
        if (!receiptDateYMD || receiptDateYMD > toDate) {
          return false
        }
      }

      return true
    })
  }, [receipts, keyword, statusFilter, supplierFilter, fromDate, toDate])

  // Dữ liệu cắt theo trang hiện tại
  const paginatedReceipts = useMemo(() => {
    const start = page * rowsPerPage
    return filteredReceipts.slice(start, start + rowsPerPage)
  }, [filteredReceipts, page, rowsPerPage])

  // Xử lý chuyển trang
  const handleChangePage = (_, newPage) => {
    setPage(newPage)
  }

  // Xử lý thay đổi số lượng dòng hiển thị trên mỗi trang (10, 20, 30)
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  // Reset về trang 0 khi thay đổi bất kỳ bộ lọc nào
  const handleKeywordChange = (e) => {
    setKeyword(e.target.value)
    setPage(0)
  }

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value)
    setPage(0)
  }

  const handleSupplierChange = (e) => {
    setSupplierFilter(e.target.value)
    setPage(0)
  }

  const handleFromDateChange = (e) => {
    const val = e.target.value
    setFromDate(val)
    // Nếu ngày bắt đầu vượt quá ngày kết thúc, tự động đồng bộ ngày kết thúc để tránh khoảng ngày vô nghĩa
    if (val && toDate && val > toDate) {
      setToDate(val)
    }
    setPage(0)
  }

  const handleToDateChange = (e) => {
    const val = e.target.value
    setToDate(val)
    if (val && fromDate && val < fromDate) {
      setFromDate(val)
    }
    setPage(0)
  }

  // Đặt lại toàn bộ bộ lọc
  const handleResetFilters = () => {
    setKeyword('')
    setStatusFilter('')
    setSupplierFilter('')
    setFromDate('')
    setToDate('')
    setPage(0)
  }

  return (
    <PortalLayout headerTitle="Nhập kho" headerSubtitle="Các lần nhập hàng và trạng thái phiếu">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Nút điều hướng đầu trang */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/class-setup/admin/components')}
            sx={{ textTransform: 'none', color: '#1976d2', fontWeight: 500 }}
          >
            Linh kiện
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => navigate('/class-setup/admin/stock-inwards')}
            sx={{ textTransform: 'none', borderRadius: 1.5, px: 2 }}
          >
            Nhập hàng mới
          </Button>
        </Box>

        {/* Khung tìm kiếm và bộ lọc (Thiết kế đồng bộ theo "Thông tin phiếu" bên Nhập hàng mới) */}
        <Card
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(0)
          }}
          variant="outlined"
          sx={{ borderColor: '#d8dced', boxShadow: 'none', mb: 2.5, bgcolor: '#ffffff' }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography sx={{ mb: 0.5, fontWeight: 800, color: '#182238' }}>Thông tin phiếu</Typography>
            <Typography sx={{ mb: 2, color: '#697386', fontSize: 12 }}>
              Tìm kiếm phiếu nhập theo nhà cung cấp, số hóa đơn / mã phiếu, ngày nhận và trạng thái.
            </Typography>

            <Grid container spacing={2}>
              {/* Hàng 1: Nhà cung cấp & Số hóa đơn / Mã phiếu */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Nhà cung cấp"
                  value={supplierFilter}
                  onChange={handleSupplierChange}
                >
                  <MenuItem value="">Tất cả nhà cung cấp</MenuItem>
                  {suppliers.map((sup) => (
                    <MenuItem key={sup} value={sup}>
                      {sup}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Số hóa đơn"
                  placeholder="Nhập số hóa đơn, số chứng từ hoặc mã phiếu..."
                  value={keyword}
                  onChange={handleKeywordChange}
                />
              </Grid>

              {/* Hàng 2: Ngày nhận (Từ ngày nhận & Đến ngày nhận) */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Từ ngày nhận"
                  value={fromDate}
                  onChange={handleFromDateChange}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: toDate || getVietnamDateInputValue() },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Đến ngày nhận"
                  value={toDate}
                  onChange={handleToDateChange}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      min: fromDate || undefined,
                      max: getVietnamDateInputValue(),
                    },
                  }}
                />
              </Grid>

              {/* Hàng 3: Trạng thái & Các nút thao tác */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Trạng thái"
                  value={statusFilter}
                  onChange={handleStatusChange}
                >
                  <MenuItem value="">Tất cả trạng thái</MenuItem>
                  {statuses.map((st) => (
                    <MenuItem key={st} value={st}>
                      {receiptStatusOf(st).label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: { xs: 'flex-start', md: 'flex-end' },
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleResetFilters}
                    disabled={!keyword && !statusFilter && !supplierFilter && !fromDate && !toDate}
                    sx={{ textTransform: 'none', height: 44, px: 2.5 }}
                  >
                    Xóa bộ lọc
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SearchIcon />}
                    sx={{ textTransform: 'none', height: 44, px: 3 }}
                  >
                    Tìm kiếm
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Bảng danh sách phiếu nhập kho */}
        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '8px 8px 0 0' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                {['Mã phiếu', 'Nhà cung cấp', 'Ngày nhập kho', 'Ngày xuất hóa đơn', 'Tổng tiền', 'Trạng thái', 'Số dòng', ''].map((head) => (
                  <TableCell key={head} sx={{ fontWeight: 600, color: '#334155' }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedReceipts.map((receipt) => {
                const invDate = receipt.invoiceDate || ''
                return (
                  <TableRow key={receipt.receiptId} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{receipt.receiptCode || receipt.receiptId}</TableCell>
                    <TableCell>{receipt.supplierName || '—'}</TableCell>
                    <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                    <TableCell>{invDate ? formatDate(invDate) : '—'}</TableCell>
                    <TableCell>{formatMoney(receipt.totalAmount)} ₫</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={receiptStatusOf(receipt.status).label}
                        color={receiptStatusOf(receipt.status).color}
                      />
                    </TableCell>
                    <TableCell>{receipt.lineCount ?? receipt.items?.length ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => navigate(`/class-setup/admin/stock-receipts/${receipt.receiptId}`)}
                        sx={{ textTransform: 'none', fontWeight: 500 }}
                      >
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredReceipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {receipts.length === 0
                      ? 'Chưa có phiếu nhập.'
                      : 'Không tìm thấy phiếu nhập nào phù hợp với bộ lọc.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Thanh phân trang: Mặc định 10 phiếu/trang, cho phép chọn 10, 20, 30 */}
        <TablePagination
          component="div"
          count={filteredReceipts.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 30]}
          labelRowsPerPage="Số phiếu mỗi trang:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
          sx={{
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderTop: 0,
            borderRadius: '0 0 8px 8px',
          }}
        />

        <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>
          Phiếu nhập được ghi nhận vào tồn kho ngay sau khi lưu thành công.
        </Typography>
      </Box>
    </PortalLayout>
  )
}