import { useState } from 'react'
import {
  Add as AddIcon,
  Category as CategoryIcon,
  Inventory as StockInIcon,
  Inventory2 as InventoryIcon,
  Widgets as WidgetsIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { getComponents, getStockInwards, INITIAL_COMPONENTS } from './componentStore'

const summaryCards = [
  { label: 'Tổng linh kiện', icon: <InventoryIcon /> },
  { label: 'Danh mục', icon: <CategoryIcon /> },
  { label: 'Tồn kho', icon: <InventoryIcon /> },
  { label: 'Cần nhập thêm', value: '8', icon: <WidgetsIcon /> },
]

export default function Components() {
  const navigate = useNavigate()
  const location = useLocation()
  const [components] = useState(getComponents)
  const [inwards] = useState(getStockInwards)
  const initialCodes = new Set(INITIAL_COMPONENTS.map((component) => component.code))
  const initialStock = INITIAL_COMPONENTS.reduce((total, component) => total + Number(component.stock), 0)
  const initialCategories = new Set(INITIAL_COMPONENTS.map((component) => component.category))
  const pendingAllocationCodes = new Set(
    inwards
      .filter((inward) => inward.status !== 'Hoàn tất')
      .flatMap((inward) => [
        inward.componentCode,
        ...(inward.items || []).map((item) => item.componentCode),
      ])
      .filter(Boolean)
  )
  const [notice, setNotice] = useState(() => {
    if (location.state?.allocatedComponentName) {
      return `"${location.state.allocatedComponentName}" đã được xếp kệ và chuyển sang trạng thái sẵn sàng.`
    }
    if (location.state?.createdComponentName) {
      return `Đã thêm "${location.state.createdComponentName}" vào danh mục. Linh kiện đang chờ nhập kho.`
    }
    return ''
  })
  const addedComponents = components.filter((component) => !initialCodes.has(component.code))
  const pendingComponent = components.find((component) => !component.location)
  const stockDelta = components.reduce((total, component) => total + Number(component.stock || 0), 0) - initialStock
  const addedCategories = new Set(addedComponents.map((component) => component.category))
  const newCategories = [...addedCategories].filter((category) => !initialCategories.has(category)).length
  const summaryValues = [
    (1248 + addedComponents.length).toLocaleString('en-US'),
    12 + newCategories,
    (3856 + stockDelta).toLocaleString('en-US'),
    '8',
  ]

  return (
    <PortalLayout
      headerTitle="Danh mục linh kiện"
      headerSubtitle="Quản lý danh mục linh kiện và theo dõi tồn kho"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {notice && (
          <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>
            {notice}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {summaryCards.map((card, index) => (
            <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card
                variant="outlined"
                sx={{ height: '100%', borderColor: '#d8dced', borderRadius: 1.5, boxShadow: 'none' }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '16px !important' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1.5,
                      bgcolor: '#edf0ff',
                      color: '#0865ce',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#657084', fontSize: 12 }}>{card.label}</Typography>
                    <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 21, lineHeight: 1.3 }}>
                      {summaryValues[index]}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            p: 2,
            mb: 0.5,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <Box>
            <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 14 }}>
              Danh mục linh kiện tổng
            </Typography>
            <Typography sx={{ color: '#697386', fontSize: 11 }}>
              Quản lý danh mục linh kiện và theo dõi tồn kho
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<StockInIcon />}
              onClick={() => navigate('/class-setup/admin/stock-inwards', {
                state: { componentCode: pendingComponent?.code },
              })}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                borderColor: '#0865ce',
                color: '#0865ce',
                fontSize: 12,
              }}
            >
              Nhập kho
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/class-setup/admin/components/new')}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                bgcolor: '#0865ce',
                fontSize: 12,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#0757b2', boxShadow: 'none' },
              }}
            >
              Khai báo mới
            </Button>
          </Box>
        </Box>

        <TableContainer
          sx={{
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderTop: 0,
            borderRadius: '0 0 6px 6px',
            overflowX: 'auto',
          }}
        >
          <Table size="small" aria-label="Danh mục linh kiện">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                {['Tên linh kiện', 'Mã linh kiện', 'Loại', 'Tồn kho / vị trí lưu trữ', 'Trạng thái'].map((heading) => (
                  <TableCell
                    key={heading}
                    sx={{ py: 1.25, color: '#6c7485', fontSize: 10, borderColor: '#d8dced', whiteSpace: 'nowrap' }}
                    align={heading === 'Tồn kho / vị trí lưu trữ' ? 'right' : 'left'}
                  >
                    {heading}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {components.map((component) => (
                <TableRow key={component.code} hover>
                  <TableCell sx={{ py: 1.5, color: '#263247', fontSize: 12, borderColor: '#d8dced', whiteSpace: 'nowrap' }}>
                    {component.name}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, color: '#596477', fontSize: 11, borderColor: '#d8dced', whiteSpace: 'nowrap' }}>
                    {component.code}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, color: '#596477', fontSize: 11, borderColor: '#d8dced', whiteSpace: 'nowrap' }}>
                    {component.category}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.5, color: '#263247', fontSize: 11, borderColor: '#d8dced', whiteSpace: 'nowrap' }}>
                    {component.stock ?? 0} {component.location ? `Kệ ${component.location}` : 'Chưa xếp kệ'}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, borderColor: '#d8dced' }}>
                    <Chip
                      label={component.location && Number(component.stock) > 0
                        ? 'Sẵn sàng'
                        : pendingAllocationCodes.has(component.code)
                          ? 'Chờ phân bổ'
                          : 'Chờ nhập kho'}
                      size="small"
                      sx={{
                        height: 20,
                        borderRadius: 0.5,
                        bgcolor: component.location && Number(component.stock) > 0 ? '#edf0ff' : '#fff3cd',
                        color: component.location && Number(component.stock) > 0 ? '#0865ce' : '#946200',
                        fontWeight: 700,
                        fontSize: 10,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box
            sx={{
              minHeight: 48,
              px: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              borderTop: '1px solid #d8dced',
            }}
          >
            <Typography sx={{ color: '#667085', fontSize: 11, whiteSpace: 'nowrap' }}>
              Showing 1 to {components.length} of {124 + addedComponents.length} components
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Button disabled size="small" variant="outlined" sx={{ textTransform: 'none', fontSize: 10 }}>
                Previous
              </Button>
              <Button size="small" variant="contained" sx={{ minWidth: 28, px: 1, fontSize: 10, boxShadow: 'none' }}>
                1
              </Button>
              <Button size="small" variant="outlined" sx={{ minWidth: 28, px: 1, fontSize: 10 }}>
                2
              </Button>
              <Button size="small" variant="outlined" sx={{ textTransform: 'none', fontSize: 10 }}>
                Next
              </Button>
            </Box>
          </Box>
        </TableContainer>
      </Box>
    </PortalLayout>
  )
}
