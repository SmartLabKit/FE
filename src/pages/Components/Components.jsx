import { useEffect, useState } from 'react'
import {
  Add as AddIcon, Inventory as InventoryIcon, ReceiptLong as ReceiptIcon,
} from '@mui/icons-material'
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

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
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.createdComponentName
    ? `Đã lưu "${location.state.createdComponentName}". Tồn kho chưa thay đổi.`
    : '')

  useEffect(() => {
    let active = true
    inventoryService.getComponents()
      .then((items) => { if (active) setComponents(items) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách linh kiện.')) })
    return () => { active = false }
  }, [])

  const filtered = components.filter((component) => (
    `${component.componentName} ${component.componentCode} ${component.categoryName}`.toLowerCase().includes(query.toLowerCase())
  ))
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
          ].map(([label, value, icon]) => <Grid key={label} size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ color: '#0865ce' }}>{icon}</Box><Box><Typography color="text.secondary" fontSize={12}>{label}</Typography><Typography fontWeight={800} fontSize={21}>{value}</Typography></Box>
            </CardContent></Card>
          </Grid>)}
        </Grid>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '6px 6px 0 0' }}>
          <Typography sx={{ fontWeight: 800, color: '#182238' }}>Danh sách linh kiện</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã, danh mục" />
            {canManage && (
              <>
                <Button startIcon={<ReceiptIcon />} variant="outlined" onClick={() => navigate('/class-setup/admin/stock-receipts')} sx={{ textTransform: 'none' }}>Phiếu nhập</Button>
                <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate('/class-setup/admin/components/new')} sx={{ textTransform: 'none' }}>Tạo linh kiện</Button>
              </>
            )}
          </Box>
        </Box>
        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderTop: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                <TableCell>Tên linh kiện</TableCell>
                <TableCell>Mã</TableCell>
                <TableCell>Danh mục</TableCell>
                <TableCell>Loại quản lý</TableCell>
                <TableCell>Tổng tồn</TableCell>
                <TableCell>Khả dụng</TableCell>
                <TableCell>Trạng thái</TableCell>
                {canManage && <TableCell sx={{ width: 80 }}>Thao tác</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((component) => <TableRow key={component.componentId} hover>
                <TableCell>{component.componentName}</TableCell>
                <TableCell>{component.componentCode}</TableCell>
                <TableCell>{component.categoryName || '—'}</TableCell>
                <TableCell><Chip size="small" label={component.trackingType || '—'} /></TableCell>
                <TableCell>{Number(component.totalQuantity || 0).toLocaleString('vi-VN')} {component.unit || ''}</TableCell>
                <TableCell>{Number(component.availableQuantity || 0).toLocaleString('vi-VN')}</TableCell>
                <TableCell><Chip size="small" label={component.isLowStock ? 'Sắp hết' : component.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động'} color={component.isLowStock ? 'warning' : 'success'} /></TableCell>
                {canManage && (
                  <TableCell><Button size="small" onClick={() => navigate(`/class-setup/admin/components/${component.componentId}/edit`)} sx={{ textTransform: 'none' }}>Sửa</Button></TableCell>
                )}
              </TableRow>)}
              {filtered.length === 0 && <TableRow><TableCell colSpan={canManage ? 8 : 7} align="center">Không có linh kiện phù hợp.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PortalLayout>
  )
}
