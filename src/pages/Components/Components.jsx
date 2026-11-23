import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  GridView as GridViewIcon,
  Inventory as InventoryIcon,
  ReceiptLong as ReceiptIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material'
import {
  Alert,
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
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  getComponentLatestPrice,
  getComponentShortCode,
  normalizeSearchText,
} from './componentHelpers'

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
    return components.filter((component) => {
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
  }, [components, categoryFilter, typeFilter, query])

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

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
            ['Có thể sử dụng', availableQuantity.toLocaleString('vi-VN'), <InventoryIcon />],
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
            <Chip
              label={`${filtered.length} / ${components.length} linh kiện`}
              size="small"
              sx={{ fontWeight: 600, fontSize: 11, bgcolor: '#f1f5f9' }}
            />
            <Box sx={{ display: 'flex', gap: 0.8, ml: { xs: 0, sm: 1 }, flexWrap: 'wrap' }}>
              {TRACKING_TYPE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.value === '' ? 'Tất cả' : opt.short}
                  size="small"
                  clickable
                  color={typeFilter === opt.value ? 'primary' : 'default'}
                  variant={typeFilter === opt.value ? 'filled' : 'outlined'}
                  onClick={() => handleTypeFilterChange(opt.value)}
                  sx={{
                    fontWeight: typeFilter === opt.value ? 700 : 500,
                    fontSize: 11,
                    bgcolor: typeFilter === opt.value ? '#0058be' : undefined,
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <Button
              startIcon={<GridViewIcon />}
              variant="outlined"
              onClick={() => navigate('/components/catalog')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#0058be',
                borderColor: '#0058be',
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#f0f7ff', borderColor: '#004aa3' },
              }}
            >
              Catalog
            </Button>
            {canManage && (
              <>
                <Button
                  startIcon={<ReceiptIcon />}
                  variant="outlined"
                  onClick={() => navigate('/class-setup/admin/stock-receipts')}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Phiếu nhập
                </Button>
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

        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderTop: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tên linh kiện</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Mã / Mã viết tắt</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Danh mục</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Loại quản lý</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Giá nhập gần nhất</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tổng tồn</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Khả dụng</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Trạng thái</TableCell>
                <TableCell sx={{ width: canManage ? 110 : 70, fontWeight: 700, color: '#334155' }}>
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#0058be', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Đang tải danh sách linh kiện...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Không có linh kiện phù hợp với bộ lọc.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((component) => {
                  const shortCode = getComponentShortCode(component)
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
                        <Typography sx={{ color: '#0058be', fontWeight: 700, fontSize: 13 }}>
                          {component.componentCode}
                        </Typography>
                        {shortCode && shortCode !== component.componentCode && (
                          <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                            {shortCode}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{component.categoryName || '—'}</TableCell>
                      <TableCell>
                        <TrackingTypeBadge type={component.trackingType} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: refPrice > 0 ? '#0f172a' : '#94a3b8' }}>
                        {refPrice > 0 ? `${refPrice.toLocaleString('vi-VN')} ₫` : '—'}
                      </TableCell>
                      <TableCell>
                        {Number(component.totalQuantity || 0).toLocaleString('vi-VN')} {component.unit || ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {Number(component.availableQuantity || 0).toLocaleString('vi-VN')}
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
                          if (totalQty === 0 || availQty === 0) {
                            return (
                              <Chip
                                size="small"
                                label="Hết hàng"
                                color="error"
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            )
                          }
                          const isLow =
                            component.isLowStock === true ||
                            (component.minStock != null &&
                              (totalQty <= Number(component.minStock) || availQty <= Number(component.minStock))) ||
                            (component.borrowableQuantity != null &&
                              component.minStock != null &&
                              Number(component.borrowableQuantity) <= Number(component.minStock))
                          if (isLow) {
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
                              label="Đang hoạt động"
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
