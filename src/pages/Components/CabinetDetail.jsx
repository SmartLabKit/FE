import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardContent, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

export default function CabinetDetail() {
  const { cabinetId } = useParams()
  const navigate = useNavigate()
  const [cabinet, setCabinet] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    inventoryService.getCabinet(cabinetId)
      .then((data) => { if (active) setCabinet(data) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải thông tin tủ.')) })
    return () => { active = false }
  }, [cabinetId])

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
                <Typography variant="h6" fontWeight={800}>{cabinet.cabinetCode || cabinet.code}</Typography>
                <Typography>{cabinet.cabinetName || cabinet.name || 'Tủ lưu trữ'}</Typography>
                <Typography color="text.secondary">{cabinet.roomName || cabinet.labRoomName || cabinet.labRoomCode || cabinet.roomCode}</Typography>
              </Box>
              <Chip label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} color={isActive ? 'success' : 'default'} />
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent>
              <Typography sx={{ mb: 1.5, fontWeight: 800 }}>Hàng trong tủ ({contents.length} loại linh kiện)</Typography>
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
                    const trackingType = item.trackingType || '—'
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
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              trackingType === 'HIGH_VALUE'
                                ? 'Thiết bị đắt tiền'
                                : trackingType === 'SERIALIZED'
                                ? 'Theo dõi Serial'
                                : trackingType === 'CONSUMABLE'
                                ? 'Tiêu hao'
                                : trackingType
                            }
                            color={
                              trackingType === 'HIGH_VALUE'
                                ? 'secondary'
                                : trackingType === 'SERIALIZED'
                                ? 'primary'
                                : 'default'
                            }
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        </TableCell>
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
            </CardContent>
          </Card>
        </>}
      </Box>
    </PortalLayout>
  )
}
