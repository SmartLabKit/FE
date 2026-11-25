import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  Inventory as InventoryIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  getComponentLatestPrice,
  getComponentShortCode,
  getDisplayCode,
  normalizeSearchText,
} from './componentHelpers'
import ComponentReceiptCell from './ComponentReceiptCell'
import {
  applyReceivedFilter,
  JUST_CREATED_OPTION,
  receiptByComponent,
  receivedAmount,
  receivedQuantity,
  RECEIVED_OPTIONS,
} from './receivedFilter'
import { formatVietnamDateTime } from '../../utils/dateFormatting'

const TRACKING_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại quản lý' },
  { value: 'HIGH_VALUE', label: 'Giá trị cao', short: 'Giá trị cao' },
  { value: 'CONSUMABLE', label: 'Tiêu hao', short: 'Tiêu hao' },
  { value: 'REUSABLE', label: 'Tái sử dụng', short: 'Tái sử dụng' },
]

export default function Components() {
  const { user, hasRole } = useAuth()
  const canManage =
    user?.roleLabel === 'ADMIN' ||
    user?.roleLabel === 'INVENTORYMANAGER' ||
    hasRole?.('Admin') ||
    hasRole?.('InventoryManager')

  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [receipts, setReceipts] = useState([])
  const [receiptDetail, setReceiptDetail] = useState(null)
  const [components, setComponents] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(
    location.state?.createdComponentName
      ? `Đã lưu "${location.state.createdComponentName}". Tồn kho chưa thay đổi.`
      : ''
  )

  useEffect(() => {
    let active = true
    Promise.all([
      inventoryService.getComponents(),
      inventoryService.getCategories().catch(() => []),
    ])
      .then(([items, catList]) => {
        if (active) {
          setComponents(items)
          setCategories(Array.isArray(catList) ? catList : [])
          setLoading(false)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(extractErrorMessage(loadError, 'Không thể tải danh sách linh kiện.'))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  // Ô lọc "Mới nhập" nằm trên đường dẫn để bấm từ phiếu nhập sang và tải lại trang vẫn giữ
  const createdIds = useMemo(() => location.state?.createdIds || [], [location.state])
  const receivedOptions = createdIds.length > 0 ? [...RECEIVED_OPTIONS, JUST_CREATED_OPTION] : RECEIVED_OPTIONS
  const receivedParam = searchParams.get('received') || ''
  const receivedFilter = canManage && receivedOptions.some((o) => o.value === receivedParam) ? receivedParam : ''
  const receiptId = receivedFilter === 'receipt' ? searchParams.get('receipt') || '' : ''
  const showsReceipt = ['today', '7', '30', 'receipt'].includes(receivedFilter)
  const showsCreatedAt = ['none', 'created'].includes(receivedFilter)

  const setReceivedFilter = (received, receipt = '') => {
    const next = new URLSearchParams(searchParams)
    next.delete('received')
    next.delete('receipt')
    if (received) next.set('received', received)
    if (receipt) next.set('receipt', receipt)
    setSearchParams(next, { replace: true, state: location.state })
    setPage(0)
  }

  useEffect(() => {
    if (receivedFilter !== 'receipt') return undefined
    let active = true
    inventoryService
      .getStockReceipts()
      .then((items) => {
        const usable = items.filter((r) => r.status === 'Completed')
        usable.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        if (active) setReceipts(usable)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách phiếu nhập.'))
      })
    return () => {
      active = false
    }
  }, [receivedFilter])

  useEffect(() => {
    if (!receiptId) return undefined
    let active = true
    inventoryService
      .getStockReceipt(receiptId)
      .then((data) => {
        if (active) setReceiptDetail(data)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải phiếu nhập.'))
      })
    return () => {
      active = false
    }
  }, [receiptId])

  // Danh sách danh mục duy nhất cho bộ lọc phân loại linh kiện
  const categoryOptions = useMemo(() => {
    const map = new Map()
    categories.forEach((c) => {
      const id = c.categoryId || c.id
      const name = c.categoryName || c.name
      if (id && name) map.set(id, name)
    })
    components.forEach((c) => {
      const id = c.categoryId || c.CategoryId
      const name = c.categoryName
      if (id && name && !map.has(id)) map.set(id, name)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [categories, components])

  const handleQueryChange = (event) => {
    setQuery(event.target.value)
    setPage(0)
  }

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value)
    setPage(0)
  }

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value)
    setPage(0)
  }

  const handleChangePage = (_event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const filtered = useMemo(() => {
    const normQuery = normalizeSearchText(query)
    const receiptLines = receiptByComponent(receiptDetail?.receiptId === receiptId ? receiptDetail : null)
    return applyReceivedFilter(components, receivedFilter, { receiptLines, createdIds }).filter((component) => {
      // 1. Lọc theo Danh mục linh kiện
      if (categoryFilter) {
        const compCatId = component.categoryId || component.CategoryId || ''
        if (compCatId !== categoryFilter && component.categoryName !== categoryFilter) {
          return false
        }
      }

      // 2. Lọc theo Loại quản lý (HIGH_VALUE / CONSUMABLE / REUSABLE)
      if (typeFilter) {
        const cType = String(component.trackingType || '').toUpperCase()
        if (cType !== typeFilter.toUpperCase()) return false
      }

      // 3. Tìm kiếm không dấu theo tên, mã hệ thống, mã viết tắt kiểu thuốc y tế, danh mục, hãng SX
      if (normQuery) {
        const shortCode = getComponentShortCode(component)
        const searchTarget = normalizeSearchText(
          `${component.componentName || ''} ${component.componentCode || ''} ${shortCode} ${component.categoryName || ''} ${component.manufacturer || ''} ${component.trackingType || ''}`
        )
        if (!searchTarget.includes(normQuery)) return false
      }

      return true
    })
  }, [components, categoryFilter, typeFilter, query, receivedFilter, receiptId, receiptDetail, createdIds])

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  const shownReceipts = showsReceipt ? filtered.map((component) => component.shownReceipt).filter(Boolean) : []
  const showsPrice = !showsReceipt && !showsCreatedAt

  const totalQuantity = components.reduce((sum, component) => sum + Number(component.totalQuantity || 0), 0)
  const availableQuantity = components.reduce((sum, component) => sum + Number(component.availableQuantity || 0), 0)

  return (
    <PortalLayout
      headerTitle={canManage ? 'Quản lý linh kiện' : 'Tra cứu linh kiện'}
      headerSubtitle={
        canManage
          ? 'Danh mục linh kiện, mã viết tắt tra cứu nhanh, giá nhập gần nhất và tồn kho hiện tại'
          : 'Tra cứu thông tin linh kiện phục vụ môn học và đồ án'
      }
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            ['Tổng linh kiện', components.length, <InventoryIcon />],
            ['Tổng tồn kho', totalQuantity.toLocaleString('vi-VN'), <InventoryIcon />],
            ['Khả dụng', availableQuantity.toLocaleString('vi-VN'), <InventoryIcon />],
          ].map(([label, value, icon]) => (
            <Grid key={label} size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: '#0865ce' }}>{icon}</Box>
                  <Box>
                    <Typography color="text.secondary" fontSize={12}>{label}</Typography>
                    <Typography fontWeight={800} fontSize={21}>{value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, color: '#182238' }}>Danh sách linh kiện</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {canManage && (
              <TextField
                select
                size="small"
                label="Mới nhập"
                value={receivedFilter}
                onChange={(e) => setReceivedFilter(e.target.value)}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                sx={{ minWidth: 185 }}
              >
                {receivedOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {receivedFilter === 'receipt' && (
              <Autocomplete
                size="small"
                options={receipts}
                value={receipts.find((r) => r.receiptId === receiptId) || null}
                onChange={(_event, receipt) => setReceivedFilter('receipt', receipt?.receiptId)}
                getOptionKey={(receipt) => receipt.receiptId}
                getOptionLabel={(receipt) =>
                  `${receipt.receiptCode} · ${receipt.supplierName} · ${formatVietnamDateTime(receipt.createdAt)}`
                }
                isOptionEqualToValue={(a, b) => a.receiptId === b.receiptId}
                noOptionsText="Không có phiếu nhập"
                renderInput={(params) => <TextField {...params} label="Phiếu nhập" placeholder="Chọn phiếu" />}
                sx={{ minWidth: { xs: 260, sm: 340 } }}
              />
            )}
            <TextField
              select
              size="small"
              label="Phân loại danh mục"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              sx={{ minWidth: 185 }}
            >
              <MenuItem value="">Tất cả danh mục</MenuItem>
              {categoryOptions.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Lọc theo loại"
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              sx={{ minWidth: 185 }}
            >
              {TRACKING_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              value={query}
              onChange={handleQueryChange}
              placeholder="Tìm tên, mã, mã viết tắt (VD: CBNDDA)..."
              sx={{ minWidth: 230 }}
            />
            {canManage && (
              <>
                <Button
                  startIcon={<ExcelIcon />}
                  variant="outlined"
                  onClick={() => navigate('/class-setup/admin/components/import')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: '#16a34a',
                    color: '#15803d',
                    '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' },
                  }}
                >
                  Nhập từ Excel
                </Button>
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  onClick={() => navigate('/class-setup/admin/components/new')}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                >
                  Tạo linh kiện
                </Button>
              </>
            )}
          </Box>
        </Box>

        {shownReceipts.length > 0 && (
          <Alert severity="info" sx={{ borderRadius: 0, border: '1px solid #d8dced', borderTop: 0 }}>
            <strong>{shownReceipts.length}</strong> linh kiện · nhập{' '}
            <strong>{shownReceipts.reduce((sum, r) => sum + receivedQuantity(r), 0).toLocaleString('vi-VN')}</strong> đơn vị · thành tiền{' '}
            <strong>{shownReceipts.reduce((sum, r) => sum + receivedAmount(r), 0).toLocaleString('vi-VN')} ₫</strong>
            {receivedFilter !== 'receipt' && ' (tính phiếu gần nhất của mỗi linh kiện)'}
          </Alert>
        )}

        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderTop: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tên linh kiện</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Mã</TableCell>
                {showsReceipt && (
                  <TableCell sx={{ fontWeight: 700, color: '#334155' }}>
                    {receivedFilter === 'receipt' ? 'Nhập theo phiếu' : 'Nhập gần nhất'}
                  </TableCell>
                )}
                {showsCreatedAt && <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Ngày khai báo</TableCell>}
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Danh mục</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Loại quản lý</TableCell>
                {showsPrice && <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Giá nhập gần nhất</TableCell>}
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tổng tồn</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Khả dụng</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tồn tối thiểu</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Trạng thái</TableCell>
                <TableCell sx={{ width: canManage ? 110 : 70, fontWeight: 700, color: '#334155' }}>
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#0058be', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Đang tải danh sách linh kiện...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {receivedFilter === 'receipt' && !receiptId
                      ? 'Chọn phiếu nhập để xem linh kiện của phiếu.'
                      : 'Không có linh kiện phù hợp với bộ lọc.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((component) => {
                  const refPrice = getComponentLatestPrice(component)
                  return (
                    <TableRow key={component.componentId} hover>
                      <TableCell
                        onClick={() => navigate(`/components/${component.componentId}`, { state: { component } })}
                        sx={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          '&:hover': { color: '#0058be', textDecoration: 'underline' },
                        }}
                        title="Xem chi tiết linh kiện"
                      >
                        {component.componentName}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: '#0058be', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                          {getDisplayCode(component)}
                        </Typography>
                      </TableCell>
                      {showsReceipt && (
                        <TableCell>
                          <ComponentReceiptCell receipt={component.shownReceipt} unit={component.unit} />
                        </TableCell>
                      )}
                      {showsCreatedAt && <TableCell>{formatVietnamDateTime(component.createdAt)}</TableCell>}
                      <TableCell>{component.categoryName || '—'}</TableCell>
                      <TableCell>
                        <TrackingTypeBadge type={component.trackingType} />
                      </TableCell>
                      {showsPrice && (
                        <TableCell sx={{ fontWeight: 600, color: refPrice > 0 ? '#0f172a' : '#94a3b8' }}>
                          {refPrice > 0 ? `${refPrice.toLocaleString('vi-VN')} ₫` : '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        {Number(component.totalQuantity || 0).toLocaleString('vi-VN')} {component.unit || ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {Number(component.availableQuantity || 0).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b' }}>
                        {component.minStock == null ? '—' : Number(component.minStock).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (component.isActive === false) {
                            return (
                              <Chip
                                size="small"
                                label="Ngừng hoạt động"
                                color="default"
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            )
                          }
                          const totalQty = Number(component.totalQuantity || 0)
                          const availQty = Number(component.availableQuantity || 0)
                          if (totalQty > 0 && availQty === 0) {
                            return (
                              <Chip
                                size="small"
                                label="Cho mượn hết"
                                color="info"
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            )
                          }
                          if (availQty === 0) {
                            return (
                              <Chip
                                size="small"
                                label="Hết hàng"
                                color="error"
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            )
                          }
                          if (component.isLowStock) {
                            return (
                              <Chip
                                size="small"
                                label="Sắp hết"
                                color="warning"
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            )
                          }
                          return (
                            <Chip
                              size="small"
                              label="Còn hàng"
                              color="success"
                              sx={{ fontWeight: 600, fontSize: 11 }}
                            />
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button
                            size="small"
                            onClick={() => navigate(`/components/${component.componentId}`, { state: { component } })}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                          >
                            Xem
                          </Button>
                          {canManage && (
                            <Button
                              size="small"
                              onClick={() => navigate(`/class-setup/admin/components/${component.componentId}/edit`)}
                              sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                              Sửa
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng mỗi trang:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
          sx={{
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderTop: 0,
            borderRadius: '0 0 6px 6px',
          }}
        />
      </Box>
    </PortalLayout>
  )
}
