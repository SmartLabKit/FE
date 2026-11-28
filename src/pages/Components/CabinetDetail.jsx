import { useEffect, useState, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardContent, Chip, Snackbar, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material'
import { ArrowBack as BackIcon, FactCheck as AuditIcon } from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import CabinetItemsTab from './CabinetItemsTab'
import CabinetConsumablesTab from './CabinetConsumablesTab'
import { rowsOf } from './inventoryLabels'
import { labName } from '../../utils/labLabel'

export default function CabinetDetail() {
  const { cabinetId } = useParams()
  const navigate = useNavigate()
  const { hasRole, hasPermission } = useAuth()
  const [cabinet, setCabinet] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Dữ liệu đổi ở nơi khác thì tự tải lại
  const bumpReload = useCallback(() => setReloadKey((key) => key + 1), [])
  useEntityChanged(bumpReload)
  const [tab, setTab] = useState('overview')
  const [cabinets, setCabinets] = useState([])
  const [rooms, setRooms] = useState([])
  const [startingAudit, setStartingAudit] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const isManager = hasRole('Admin') || hasRole('InventoryManager')
  const canManageItems = isManager || hasPermission('COMPONENT_MANAGE')
  const ownLab = rooms.some((room) => room.isMine && room.roomId === cabinet?.roomId)
  // Chuyển tủ, đưa về kho, thanh lý: chỉ nhân viên phụ trách lab chứa tủ (hoặc Admin); quản lý kho chỉ xem và sửa thông tin
  const canMove = hasRole('Admin') || (ownLab && hasPermission('BORROW_ISSUE'))
  const canAudit = ownLab && hasRole('LabStaff')
  // Tủ trống thì không có gì để kiểm
  const cabinetEmpty = Number(cabinet?.unitCount ?? 1) === 0 && Number(cabinet?.consumableQuantity ?? 1) === 0
  let auditLabel = 'Kiểm kê tủ này'
  if (cabinetEmpty) auditLabel = 'Tủ trống'
  const canReport = ownLab && hasRole('LabStaff')
  const showsItems = cabinet?.trackingType !== 'CONSUMABLE'
  const showsConsumables = !cabinet?.trackingType || cabinet.trackingType === 'CONSUMABLE'
  const targetCabinets = cabinets.filter((item) => item.roomId === cabinet?.roomId)

  useEffect(() => {
    let active = true
    inventoryService.getCabinet(cabinetId)
      .then((data) => { if (active) setCabinet(data) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải thông tin tủ.')) })
    return () => { active = false }
  }, [cabinetId, reloadKey])

  useEffect(() => {
    let active = true
    inventoryService.getCabinets()
      .then((items) => { if (active) setCabinets(items) })
      .catch(() => { if (active) setCabinets([]) })
    inventoryService.getLabRooms()
      .then((items) => { if (active) setRooms(items) })
      .catch(() => { if (active) setRooms([]) })
    return () => { active = false }
  }, [])

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const startAudit = async () => {
    setStartingAudit(true)
    try {
      const running = rowsOf(await inventoryService.getInventoryAudits({ cabinetId, status: 'InProgress', page: 1, size: 1 }))
      const audit = running[0] || await inventoryService.startInventoryAudit({ cabinetId })
      navigate(`/class-setup/admin/inventory-audits/${audit.auditId}`)
    } catch (auditError) {
      showToast(extractErrorMessage(auditError, 'Không thể bắt đầu kiểm kê.'), 'error')
      setStartingAudit(false)
    }
  }

  const contents = cabinet?.contents || cabinet?.Contents || cabinet?.components || cabinet?.items || cabinet?.stocks || []
  const isActive = cabinet
    ? (cabinet.isActive !== undefined ? cabinet.isActive : (cabinet.status ? cabinet.status.toLowerCase() === 'active' : true))
    : true

  return (
    <PortalLayout headerTitle="Chi tiết tủ lưu trữ" headerSubtitle="Danh sách linh kiện hiện đang được cất trong tủ">
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/cabinets')} sx={{ mb: 2, textTransform: 'none' }}>Danh sách tủ</Button>
        {error && <Alert severity="error">{error}</Alert>}
        {cabinet && <>
          <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>{cabinet.cabinetName || cabinet.name || cabinet.cabinetCode || 'Tủ lưu trữ'}</Typography>
                <Typography color="text.secondary">{labName(cabinet)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <Chip label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} color={isActive ? 'success' : 'default'} />
                {canAudit && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AuditIcon />}
                    onClick={startAudit}
                    disabled={startingAudit || cabinetEmpty}
                    title={cabinetEmpty ? 'Tủ đang trống, không có gì để kiểm kê' : undefined}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {startingAudit ? 'Đang mở...' : auditLabel}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 1, borderBottom: '1px solid #eef0f6' }}>
              <Tab value="overview" label="Tổng quan" sx={{ textTransform: 'none', fontWeight: 600 }} />
              {showsItems && <Tab value="items" label="Từng thiết bị" sx={{ textTransform: 'none', fontWeight: 600 }} />}
              {showsConsumables && <Tab value="consumables" label="Vật tư tiêu hao" sx={{ textTransform: 'none', fontWeight: 600 }} />}
            </Tabs>
            {tab === 'items' && showsItems && (
              <CabinetItemsTab
                cabinet={cabinet}
                cabinets={targetCabinets}
                canManage={canManageItems}
                canMove={canMove}
                canReport={canReport}
                onChanged={() => setReloadKey((key) => key + 1)}
                showToast={showToast}
              />
            )}
            {tab === 'consumables' && showsConsumables && (
              <CabinetConsumablesTab
                cabinet={cabinet}
                cabinets={targetCabinets}
                canMove={canMove}
                onChanged={() => setReloadKey((key) => key + 1)}
                showToast={showToast}
              />
            )}
            {tab === 'overview' && (
            <CardContent>
              <Typography sx={{ mb: 1.5, fontWeight: 800 }}>Hàng trong tủ ({contents.length} loại linh kiện)</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#faf9ff' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Linh kiện</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Mã</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tồn trong tủ</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Khả dụng</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Loại quản lý</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contents.map((item, index) => {
                      const totalQty = item.totalQuantity ?? item.quantity ?? 0
                      const availQty = item.availableQuantity ?? totalQty
                      return (
                        <TableRow key={item.componentId || item.stockId || index} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{item.componentName || item.name || '—'}</TableCell>
                          <TableCell>{item.componentCode || '—'}</TableCell>
                          <TableCell>
                            <strong>{totalQty}</strong> {item.unit || ''}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={`${availQty} khả dụng`}
                              color={availQty > 0 ? 'success' : 'default'}
                              variant="outlined"
                              sx={{ height: 22, fontSize: 11 }}
                            />
                          </TableCell>
                          <TableCell><TrackingTypeBadge type={item.trackingType} /></TableCell>
                        </TableRow>
                      )
                    })}
                    {contents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#6b7280' }}>
                          Tủ hiện chưa có hàng.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
            )}
          </Card>
        </>}
      </Box>
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
