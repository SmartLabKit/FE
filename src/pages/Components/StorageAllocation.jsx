import { useMemo, useState } from 'react'
import {
  Apps as ComponentIcon,
  CheckCircle as ConfirmIcon,
  Inventory2 as ShelfIcon,
  SwapVert as DragIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  allocateStockInward,
  getComponents,
  getStockInwardById,
} from './componentStore'

const rooms = [
  { name: 'Tủ A', description: 'Khu vực linh kiện điện tử', shelves: ['Kệ 1', 'Kệ 2', 'Kệ 3', 'Kệ 4'] },
  { name: 'Tủ B', description: 'Khu vực cảm biến & IoT', shelves: ['Kệ 1', 'Kệ 2', 'Kệ 3', 'Kệ 4'] },
]
const SHELF_TYPE_CAPACITY = 6

export default function StorageAllocation() {
  const { inwardId } = useParams()
  const navigate = useNavigate()
  const inward = useMemo(() => getStockInwardById(inwardId), [inwardId])
  const components = useMemo(() => getComponents(), [])
  const lineItems = inward?.items || (inward?.componentCode
    ? [{
        componentCode: inward.componentCode,
        componentName: inward.componentName,
        quantity: inward.quantity,
        location: inward.location,
      }]
    : [])
  const [activeCode, setActiveCode] = useState(lineItems[0]?.componentCode || '')
  const [selectedLocations, setSelectedLocations] = useState({})
  const [error, setError] = useState('')

  const getShelfComponents = (location) => components
    .filter((item) => item.location === location && Number(item.stock || 0) > 0)

  const handleConfirm = () => {
    setError('')
    const missingLocation = lineItems.find((item) => !selectedLocations[item.componentCode])
    if (missingLocation) {
      setError(`Vui lòng chọn vị trí lưu trữ cho ${missingLocation.componentName}.`)
      setActiveCode(missingLocation.componentCode)
      return
    }

    try {
      allocateStockInward(inward.id, selectedLocations)
      navigate('/class-setup/admin/components', {
        state: {
          allocatedComponentName: lineItems.map((item) => item.componentName).join(', '),
        },
      })
    } catch (allocationError) {
      setError(allocationError.message || 'Không thể phân bổ linh kiện. Vui lòng thử lại.')
    }
  }

  return (
    <PortalLayout
      headerTitle="Phân bổ vị trí lưu trữ"
      headerSubtitle="Bước 4: Đưa linh kiện vào tủ và kệ cụ thể trong phòng Lab"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {!inward || lineItems.length === 0 ? (
          <Alert severity="warning">
            Không tìm thấy phiếu nhập cần phân bổ. Hãy tạo phiếu nhập kho trước.
          </Alert>
        ) : inward.status === 'Hoàn tất' ? (
          <Alert severity="success">
            Phiếu nhập {inward.id} đã được phân bổ vào kho.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card variant="outlined" sx={{ p: 2.5, borderColor: '#d8dced', borderRadius: 1, boxShadow: 'none' }}>
                <Typography sx={{ mb: 2, color: '#182238', fontWeight: 800, fontSize: 14 }}>
                  Sơ đồ kho lưu trữ
                </Typography>

                <Grid container spacing={1.5}>
                  {rooms.map((room) => (
                    <Grid key={room.name} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ p: 1.25, border: '1px solid #d8dced', borderRadius: 1, bgcolor: '#faf9ff' }}>
                        <Box sx={{ mb: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                          <Box>
                            <Typography sx={{ color: '#263247', fontWeight: 800, fontSize: 12 }}>{room.name}</Typography>
                            <Typography sx={{ color: '#697386', fontSize: 9 }}>{room.description}</Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={`${room.shelves.reduce((sum, shelf) => sum + getShelfComponents(`${room.name}, ${shelf}`).length, 0)}/${room.shelves.length * SHELF_TYPE_CAPACITY} vị trí`}
                            sx={{ height: 18, bgcolor: '#edf0ff', color: '#0865ce', fontSize: 9, fontWeight: 700 }}
                          />
                        </Box>

                        <Box sx={{ display: 'grid', gap: 0.75 }}>
                          {room.shelves.map((shelf) => {
                            const shelfLocation = `${room.name}, ${shelf}`
                            const shelfComponents = getShelfComponents(shelfLocation)
                            const isSelected = selectedLocations[activeCode] === shelfLocation
                            const fillBars = Math.min(SHELF_TYPE_CAPACITY, shelfComponents.length)

                            return (
                              <Button
                                key={shelfLocation}
                                onClick={() => {
                                  setSelectedLocations((current) => ({ ...current, [activeCode]: shelfLocation }))
                                  setError('')
                                }}
                                sx={{
                                  p: 1,
                                  minHeight: 48,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  border: '1px solid',
                                  borderColor: isSelected ? '#0865ce' : '#d8dced',
                                  borderRadius: 1,
                                  bgcolor: isSelected ? '#edf3ff' : '#fff',
                                  color: '#263247',
                                  textTransform: 'none',
                                  '&:hover': { bgcolor: isSelected ? '#edf3ff' : '#f6f8fc', borderColor: '#0865ce' },
                                }}
                              >
                                <Box sx={{ minWidth: 120 }}>
                                  <Typography sx={{ fontSize: 10, fontWeight: 800 }}>{shelf}</Typography>
                                  <Typography sx={{ color: '#697386', fontSize: 9 }}>
                                    {shelfComponents.length}/{SHELF_TYPE_CAPACITY} loại linh kiện
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                                  {Array.from({ length: SHELF_TYPE_CAPACITY }, (_, index) => (
                                    <Box
                                      key={index}
                                      sx={{
                                        width: 14,
                                        height: 6,
                                        borderRadius: 4,
                                        bgcolor: index < fillBars || isSelected ? '#0865ce' : '#e0e5ff',
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Button>
                            )
                          })}
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Alert
                  icon={<DragIcon fontSize="small" />}
                  severity="info"
                  sx={{
                    mt: 2,
                    py: 0,
                    bgcolor: '#f1f3ff',
                    color: '#596477',
                    '& .MuiAlert-icon': { color: '#0865ce' },
                    fontSize: 10,
                  }}
                >
                  Chọn linh kiện ở danh sách bên phải, sau đó chọn tủ và kệ lưu trữ.
                </Alert>

                {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ConfirmIcon />}
                  onClick={handleConfirm}
                  sx={{
                    mt: 2,
                    py: 1,
                    bgcolor: '#0865ce',
                    textTransform: 'none',
                    fontSize: 12,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#0757b2', boxShadow: 'none' },
                  }}
                >
                  Xác nhận phân bổ
                </Button>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant="outlined" sx={{ p: 2.25, borderColor: '#d8dced', borderRadius: 1, boxShadow: 'none' }}>
                <Typography sx={{ mb: 0.5, color: '#182238', fontWeight: 800, fontSize: 14 }}>
                  Linh kiện cần phân bổ
                </Typography>
                <Typography sx={{ mb: 1.5, color: '#697386', fontSize: 10 }}>
                  Phiếu nhập {inward.id} · {inward.supplier}
                </Typography>

                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  {lineItems.map((item) => {
                    const component = components.find((entry) => entry.code === item.componentCode)
                    const isActive = item.componentCode === activeCode
                    return (
                      <Button
                        key={item.componentCode}
                        onClick={() => setActiveCode(item.componentCode)}
                        sx={{
                          p: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          border: '1px solid',
                          borderColor: isActive ? '#0865ce' : '#d8dced',
                          borderRadius: 1,
                          bgcolor: isActive ? '#f1f4ff' : '#fff',
                          textAlign: 'left',
                          textTransform: 'none',
                          color: '#263247',
                          '&:hover': { bgcolor: '#f1f4ff' },
                        }}
                      >
                        <Box sx={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#0865ce', bgcolor: '#edf0ff', borderRadius: 0.75 }}>
                          <ComponentIcon sx={{ fontSize: 15 }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ color: '#263247', fontWeight: 800, fontSize: 10 }}>{item.componentCode}</Typography>
                          <Typography sx={{ color: '#697386', fontSize: 9, overflowWrap: 'anywhere' }}>
                            {item.componentName || component?.name || item.componentCode}
                          </Typography>
                          <Typography sx={{ mt: 0.35, color: '#596477', fontSize: 9 }}>
                            {Number(item.quantity).toLocaleString('vi-VN')} chiếc · {selectedLocations[item.componentCode] || 'Chưa chọn vị trí'}
                          </Typography>
                        </Box>
                        <Chip label={Number(item.quantity).toLocaleString('vi-VN')} size="small" sx={{ height: 20, bgcolor: '#edf0ff', color: '#0865ce', fontSize: 9, fontWeight: 800 }} />
                      </Button>
                    )
                  })}
                </Box>

                <Box sx={{ mt: 1.5, p: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, border: '1px solid #d8dced', borderRadius: 1 }}>
                  <ShelfIcon sx={{ fontSize: 15, color: '#0865ce' }} />
                  <Typography sx={{ color: '#596477', fontSize: 10 }}>
                    Đã chọn vị trí cho {Object.keys(selectedLocations).filter((code) => lineItems.some((item) => item.componentCode === code)).length}/{lineItems.length} linh kiện
                  </Typography>
                </Box>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </PortalLayout>
  )
}
