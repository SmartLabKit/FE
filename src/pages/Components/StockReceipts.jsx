import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  CalendarTodayOutlined as CalendarIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'

// Format hiển thị ngày theo chuẩn vi-VN: dd/mm/yyyy
const formatDate = (value) => formatVietnamDate(value)

// Hiển thị ngày đã chọn dạng dd/mm/yyyy trên ô chọn ngày
const formatDateDisplay = (dateStr) => (!dateStr ? 'Chọn ngày' : formatVietnamDate(dateStr))

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

  // Ref cho 2 input date ẩn để kích hoạt date picker khi click vào ô
  const fromDateInputRef = useRef(null)
  const toDateInputRef = useRef(null)

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
      // 1. Tìm theo mã phiếu hoặc nhà cung cấp
      if (keyword.trim()) {
        const query = keyword.trim().toLowerCase()
        const code = String(receipt.receiptCode || receipt.receiptId || '').toLowerCase()
        const supplier = String(receipt.supplierName || '').toLowerCase()
        if (!code.includes(query) && !supplier.includes(query)) {
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

  return (
    <PortalLayout headerTitle="Phiếu nhập kho" headerSubtitle="Lịch sử nhập kho và trạng thái các phiếu">
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
            Lập phiếu nhập
          </Button>
        </Box>

        {/* Khung tìm kiếm và bộ lọc (Thiết kế đồng bộ theo hình thứ 2) */}
        <Box
          sx={{
            bgcolor: '#f4f5f7',
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            mb: 2.5,
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Thanh tìm kiếm từ khóa (Mã phiếu, nhà cung cấp) */}
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              setPage(0)
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#ffffff',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              p: '4px 6px 4px 18px',
              mb: 2,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              '&:focus-within': {
                borderColor: '#cbd5e1',
              },
            }}
          >
            <InputBase
              fullWidth
              placeholder="Tìm mã phiếu, nhà cung cấp..."
              value={keyword}
              onChange={handleKeywordChange}
              sx={{
                fontSize: 14,
                color: '#1e293b',
                '& ::placeholder': {
                  color: '#9ca3af',
                  opacity: 1,
                },
              }}
            />
            <Button
              type="submit"
              variant="text"
              startIcon={<SearchIcon sx={{ fontSize: 19, color: '#64748b' }} />}
              sx={{
                borderRadius: '9999px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                color: '#475569',
                px: 2,
                py: 0.6,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 14,
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: '#f8fafc',
                  borderColor: '#cbd5e1',
                },
              }}
            >
              Tìm kiếm
            </Button>
          </Box>

          {/* Lưới các bộ lọc: Trạng thái, Nhà cung cấp, Từ ngày nhận, Đến ngày nhận */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              columnGap: 2.5,
              rowGap: 1.75,
            }}
          >
            {/* Cột 1: Trạng thái */}
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: '#374151', mb: 0.75 }}>
                Trạng thái
              </Typography>
              <Select
                value={statusFilter}
                onChange={handleStatusChange}
                displayEmpty
                size="small"
                fullWidth
                renderValue={(selected) => {
                  if (!selected) {
                    return <span style={{ color: '#64748b' }}>Tất cả trạng thái</span>
                  }
                  return selected
                }}
                IconComponent={ArrowDownIcon}
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: '9999px',
                  height: 40,
                  fontSize: 14,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e2e8f0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#cbd5e1',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                  },
                  '& .MuiSelect-select': {
                    py: 1,
                    px: 2,
                  },
                  '& .MuiSelect-icon': {
                    color: '#94a3b8',
                    right: 12,
                  },
                }}
              >
                <MenuItem value="">Tất cả trạng thái</MenuItem>
                {statuses.map((st) => (
                  <MenuItem key={st} value={st}>
                    {st}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Cột 2: Nhà cung cấp */}
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: '#374151', mb: 0.75 }}>
                Nhà cung cấp
              </Typography>
              <Select
                value={supplierFilter}
                onChange={handleSupplierChange}
                displayEmpty
                size="small"
                fullWidth
                renderValue={(selected) => {
                  if (!selected) {
                    return <span style={{ color: '#64748b' }}>Tất cả nhà cung cấp</span>
                  }
                  return selected
                }}
                IconComponent={ArrowDownIcon}
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: '9999px',
                  height: 40,
                  fontSize: 14,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e2e8f0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#cbd5e1',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                  },
                  '& .MuiSelect-select': {
                    py: 1,
                    px: 2,
                  },
                  '& .MuiSelect-icon': {
                    color: '#94a3b8',
                    right: 12,
                  },
                }}
              >
                <MenuItem value="">Tất cả nhà cung cấp</MenuItem>
                {suppliers.map((sup) => (
                  <MenuItem key={sup} value={sup}>
                    {sup}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Cột 3: Từ ngày nhập kho */}
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: '#374151', mb: 0.75 }}>
                Từ ngày nhập kho
              </Typography>
              <Box
                onClick={() => fromDateInputRef.current?.showPicker?.()}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#ffffff',
                  borderRadius: '9999px',
                  border: '1px solid #e2e8f0',
                  height: 40,
                  px: 2,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  '&:hover': {
                    borderColor: '#cbd5e1',
                  },
                }}
              >
                <CalendarIcon sx={{ fontSize: 18, color: '#94a3b8', mr: 1.25, flexShrink: 0 }} />
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: 14,
                    color: fromDate ? '#1e293b' : '#64748b',
                    userSelect: 'none',
                  }}
                >
                  {formatDateDisplay(fromDate)}
                </Typography>
                {fromDate ? (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFromDate('')
                      setPage(0)
                    }}
                    sx={{
                      p: 0.25,
                      color: '#94a3b8',
                      zIndex: 2,
                      '&:hover': { color: '#475569', bgcolor: '#f1f5f9' },
                    }}
                    title="Xóa ngày bắt đầu"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                ) : (
                  <ArrowDownIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                )}
                {/* Input date ẩn để mở picker của trình duyệt khi click */}
                <input
                  ref={fromDateInputRef}
                  type="date"
                  max={toDate || getVietnamDateInputValue()}
                  value={fromDate}
                  onChange={handleFromDateChange}
                  onClick={(e) => e.target.showPicker?.()}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 1,
                  }}
                />
              </Box>
            </Box>

            {/* Cột 4: Đến ngày nhập kho */}
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: '#374151', mb: 0.75 }}>
                Đến ngày nhập kho
              </Typography>
              <Box
                onClick={() => toDateInputRef.current?.showPicker?.()}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#ffffff',
                  borderRadius: '9999px',
                  border: '1px solid #e2e8f0',
                  height: 40,
                  px: 2,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  '&:hover': {
                    borderColor: '#cbd5e1',
                  },
                }}
              >
                <CalendarIcon sx={{ fontSize: 18, color: '#94a3b8', mr: 1.25, flexShrink: 0 }} />
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: 14,
                    color: toDate ? '#1e293b' : '#64748b',
                    userSelect: 'none',
                  }}
                >
                  {formatDateDisplay(toDate)}
                </Typography>
                {toDate ? (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setToDate('')
                      setPage(0)
                    }}
                    sx={{
                      p: 0.25,
                      color: '#94a3b8',
                      zIndex: 2,
                      '&:hover': { color: '#475569', bgcolor: '#f1f5f9' },
                    }}
                    title="Xóa ngày kết thúc"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                ) : (
                  <ArrowDownIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                )}
                {/* Input date ẩn để mở picker của trình duyệt khi click */}
                <input
                  ref={toDateInputRef}
                  type="date"
                  min={fromDate || undefined}
                  max={getVietnamDateInputValue()}
                  value={toDate}
                  onChange={handleToDateChange}
                  onClick={(e) => e.target.showPicker?.()}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 1,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Bảng danh sách phiếu nhập kho */}
        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '8px 8px 0 0' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                {['Mã phiếu', 'Nhà cung cấp', 'Ngày nhập kho', 'Ngày hóa đơn', 'Tổng tiền', 'Trạng thái', 'Số dòng', ''].map((head) => (
                  <TableCell key={head} sx={{ fontWeight: 600, color: '#334155' }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedReceipts.map((receipt) => {
                const invDate =
                  receipt.invoiceDate ||
                  receipt.InvoiceDate ||
                  localStorage.getItem(`receipt_invoice_date_${receipt.receiptId}`) ||
                  ''
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
                        label={receipt.status || '—'}
                        color={receipt.status === 'Completed' ? 'success' : 'default'}
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
