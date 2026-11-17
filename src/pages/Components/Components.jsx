import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  GridView as GridViewIcon,
  Inventory as InventoryIcon,
  ReceiptLong as ReceiptIcon,
} from '@mui/icons-material'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const TRACKING_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại quản lý' },
  { value: 'HIGH_VALUE', label: 'HIGH_VALUE (Giá thành cao)' },
  { value: 'CONSUMABLE', label: 'CONSUMABLE (Tiêu hao)' },
  { value: 'REUSABLE', label: 'REUSABLE (Tái sử dụng)' },
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
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.createdComponentName
    ? `Đã lưu "${location.state.createdComponentName}". Tồn kho chưa thay đổi.`
    : '')

  useEffect(() => {
    let active = true
    inventoryService.getComponents()
      .then((items) => {
        if (active) {
          setComponents(items)
          setLoading(false)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(extractErrorMessage(loadError, 'Không thể tải danh sách linh kiện.'))
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  const handleQueryChange = (event) => {
    setQuery(event.target.value)
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

  const filtered = components.filter((component) => {
    // Lọc theo Loại quản lý (HIGH_VALUE / CONSUMABLE / REUSABLE)
    if (typeFilter) {
      const cType = String(component.trackingType || '').toUpperCase()
      if (cType !== typeFilter.toUpperCase()) return false
    }

    // Lọc theo từ khóa tìm kiếm
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const searchTarget = `${component.componentName || ''} ${component.componentCode || ''} ${component.categoryName || ''} ${component.trackingType || ''}`.toLowerCase()
      if (!searchTarget.includes(q)) return false
    }

    return true
  })

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  const totalQuantity = components.reduce((sum, component) => sum + Number(component.totalQuantity || 0), 0)
  const availableQuantity = components.reduce((sum, component) => sum + Number(component.availableQuantity || 0), 0)

  return (
    <PortalLayout
      headerTitle={canManage ? 'Quản lý linh kiện' : 'Tra cứu linh kiện'}
      headerSubtitle={canManage ? 'Danh mục linh kiện và tồn kho hiện tại' : 'Tra cứu thông tin linh kiện phục vụ môn học và đồ án'}
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

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
            {/* Quick filter chips */}
            <Box sx={{ display: 'flex', gap: 0.8, ml: { xs: 0, sm: 1 }, flexWrap: 'wrap' }}>
              {TRACKING_TYPE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.value === '' ? 'Tất cả' : opt.value}
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
              label="Lọc theo loại"
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              sx={{ minWidth: 190 }}
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
              placeholder="Tìm tên, mã, danh mục..."
              sx={{ minWidth: 200 }}
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
              Dạng lưới (Catalog)
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
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Mã</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Danh mục</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Loại quản lý</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tổng tồn</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Khả dụng</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Trạng thái</TableCell>
                <TableCell sx={{ width: canManage ? 110 : 70, fontWeight: 700, color: '#334155' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#0058be', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Đang tải danh sách linh kiện...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Không có linh kiện phù hợp với bộ lọc.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((component) => (
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
                    <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{component.componentCode}</TableCell>
                    <TableCell>{component.categoryName || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={component.trackingType || '—'}
                        color={
                          component.trackingType === 'HIGH_VALUE'
                            ? 'secondary'
                            : component.trackingType === 'CONSUMABLE'
                              ? 'warning'
                              : component.trackingType === 'REUSABLE'
                                ? 'primary'
                                : 'default'
                        }
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>{Number(component.totalQuantity || 0).toLocaleString('vi-VN')} {component.unit || ''}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{Number(component.availableQuantity || 0).toLocaleString('vi-VN')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={component.isLowStock ? 'Sắp hết' : component.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                        color={component.isLowStock ? 'warning' : 'success'}
                        sx={{ fontWeight: 600, fontSize: 11 }}
                      />
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
                ))
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
