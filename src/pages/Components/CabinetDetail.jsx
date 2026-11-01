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

  const contents = cabinet?.components || cabinet?.items || cabinet?.stocks || []
  return (
    <PortalLayout headerTitle="Chi tiết tủ lưu trữ" headerSubtitle="Danh sách linh kiện hiện đang được cất trong tủ">
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/cabinets')} sx={{ mb: 2, textTransform: 'none' }}>Danh sách tủ</Button>
        {error && <Alert severity="error">{error}</Alert>}
        {cabinet && <>
          <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Box><Typography variant="h6" fontWeight={800}>{cabinet.cabinetCode || cabinet.code}</Typography><Typography>{cabinet.cabinetName || cabinet.name || 'Tủ lưu trữ'}</Typography><Typography color="text.secondary">{cabinet.labRoomCode || cabinet.labRoomName || cabinet.roomName}</Typography></Box>
              <Chip label={cabinet.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động'} color={cabinet.isActive === false ? 'default' : 'success'} />
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent>
              <Typography sx={{ mb: 1, fontWeight: 800 }}>Hàng trong tủ</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell>Linh kiện</TableCell><TableCell>Mã</TableCell><TableCell>Tồn trong tủ</TableCell><TableCell>Loại quản lý</TableCell></TableRow></TableHead>
                <TableBody>{contents.map((item, index) => <TableRow key={item.componentId || item.stockId || index}>
                  <TableCell>{item.componentName || item.name || '—'}</TableCell><TableCell>{item.componentCode || '—'}</TableCell><TableCell>{item.quantity ?? item.totalQuantity ?? 0} {item.unit || ''}</TableCell><TableCell>{item.trackingType || '—'}</TableCell>
                </TableRow>)}
                  {contents.length === 0 && <TableRow><TableCell colSpan={4} align="center">Tủ hiện chưa có hàng.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>}
      </Box>
    </PortalLayout>
  )
}
