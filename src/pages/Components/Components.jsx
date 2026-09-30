import {
  Add as AddIcon,
  Category as CategoryIcon,
  Inventory2 as InventoryIcon,
  Widgets as WidgetsIcon,
} from '@mui/icons-material'
import {
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
import PortalLayout from '../../components/layout/PortalLayout'

const summaryCards = [
  { label: 'Tổng linh kiện', value: '1,248', icon: <InventoryIcon /> },
  { label: 'Danh mục', value: '12', icon: <CategoryIcon /> },
  { label: 'Tồn kho', value: '3,856', icon: <InventoryIcon /> },
  { label: 'Cần nhập thêm', value: '8', icon: <WidgetsIcon /> },
]

const components = [
  { name: 'Điện trở kim loại 10kΩ', code: 'RES-10K-01', category: 'Điện trở', stock: '500', location: 'A-02' },
  { name: 'Tụ gốm 10uF', code: 'CAP-10U-02', category: 'Tụ điện', stock: '300', location: 'A-03' },
  { name: 'Arduino Uno R3', code: 'MCU-ARD-01', category: 'Vi điều khiển', stock: '15', location: 'B-01' },
  { name: 'Breadboard 400 điểm', code: 'BRD-SLD-05', category: 'Khay hàn', stock: '50', location: 'C-02' },
  { name: 'LED đỏ 5mm', code: 'LED-RED-01', category: 'LED', stock: '100', location: 'D-01' },
  { name: 'Probe oscilloscope 100MHz', code: 'PRB-OSC-01', category: 'Dụng cụ đo', stock: '10', location: 'E-01' },
]

export default function Components() {
  return (
    <PortalLayout
      headerTitle="Danh mục linh kiện"
      headerSubtitle="Quản lý danh mục linh kiện và theo dõi tồn kho"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {summaryCards.map((card) => (
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
                      {card.value}
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
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
                    {component.stock} Kệ {component.location}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, borderColor: '#d8dced' }}>
                    <Chip
                      label="Sẵn sàng"
                      size="small"
                      sx={{
                        height: 20,
                        borderRadius: 0.5,
                        bgcolor: '#edf0ff',
                        color: '#0865ce',
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
              Showing 1 to 6 of 124 components
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
