import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  DownloadOutlined as DownloadIcon,
  VisibilityOutlined as VisibilityIcon,
} from '@mui/icons-material'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { borrowService } from '../../services/borrowService'

/**
 * ConfirmReturnRequest Component (Actor: Nhân viên Lab)
 * Xác nhận trả · Bình thường (Ảnh 5 - MF5.2)
 * Nhánh A: Tất cả linh kiện bình thường sau kiểm tra & Cập nhật tồn khả dụng
 */
export default function ConfirmReturnRequest() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [returnReq, setReturnReq] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        setLoading(true)
        const req = await borrowService.getReturnRequestById(id || 'TR-2026-014')
        if (isMounted) setReturnReq(req)
      } catch (err) {
        console.error('Lỗi khi tải phiếu trả:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <PortalLayout
        headerTitle="Quản lý mượn linh kiện"
        headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
        currentRole="Nhân viên Lab"
        currentUser={{ name: 'Trần Thị Lan', role: 'Nhân viên Lab' }}
        activeMenuKey="handover"
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </PortalLayout>
    )
  }

  const req = returnReq || {
    requestCode: 'TR-2026-014',
    originalBorrowCode: 'BR-2026-1020',
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
    components: [
      {
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        returnQuantity: 1,
        goodQuantity: 1,
        damagedQuantity: 0,
        stockBefore: 11,
        stockReturned: 1,
        stockAfter: 12,
        storageLocation: 'Tủ A · Ngăn A1',
      },
      {
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        returnQuantity: 2,
        goodQuantity: 2,
        damagedQuantity: 0,
        stockBefore: 18,
        stockReturned: 2,
        stockAfter: 20,
        storageLocation: 'Tủ A · Ngăn A2',
      },
    ],
  }

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
      currentRole="Nhân viên Lab"
      currentUser={{ name: 'Trần Thị Lan', role: 'Nhân viên Lab' }}
      activeMenuKey="handover"
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Quick Demo Switcher Bar */}
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            bgcolor: '#f0fdf4',
            border: '1px dashed #86efac',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>
            🔬 <strong>Góc nhìn Nhân viên Lab (Ảnh 5):</strong> Xác nhận trả bình thường, cập nhật ngay tồn kho khả dụng (+1 ESP32, +2 DHT22).
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => navigate(`/borrow/return/${req.requestCode || 'TR-2026-014'}`)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: '#0058be',
              borderColor: '#0058be',
            }}
          >
            👈 Xem góc nhìn Sinh viên (Ảnh 3 & 4)
          </Button>
        </Box>

        {/* Breadcrumb Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Button
            component={RouterLink}
            to="/borrow/supplementary"
            startIcon={<ArrowBackIcon fontSize="small" />}
            sx={{
              color: '#0058be',
              textTransform: 'none',
              fontWeight: 600,
              p: 0,
              minWidth: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
            }}
          >
            Danh sách phiếu trả
          </Button>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            / Trả linh kiện
          </Typography>
        </Box>

        {/* Heading */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Xác nhận trả · Bình thường
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {req.requestCode || 'TR-2026-014'} · Nhánh A: Tất cả linh kiện bình thường sau kiểm tra
          </Typography>
        </Box>

        {/* Alert Banner */}
        <Alert
          icon={<CheckCircleIcon sx={{ color: '#16a34a' }} />}
          sx={{
            mb: 3,
            bgcolor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            borderRadius: 2,
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
            Đã xác nhận trả 3/3 linh kiện và cập nhật tồn khả dụng
          </Typography>
          <Typography variant="body2" sx={{ color: '#166534', mt: 0.2 }}>
            Trần Thị Lan xác nhận lúc 09:45, 29/10/2026. Hệ thống đã gửi kết quả trả linh kiện đến {req.leaderName || 'Lê Hoàng Nam'}.
          </Typography>
        </Alert>

        {/* 3-Step Stepper (Cả 3 bước đều hoàn tất) */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            bgcolor: '#ffffff',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            {/* Step 1 */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#0058be',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  Gửi phiếu trả
                </Typography>
              </Box>
            </Grid>

            {/* Step 2 */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#0058be',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  Lab tiếp nhận & kiểm tra
                </Typography>
              </Box>
            </Grid>

            {/* Step 3 */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#0058be',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  Xác nhận & cập nhật kho
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Box 1: Biên nhận trả linh kiện */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            bgcolor: '#ffffff',
          }}
        >
          {/* Header Box */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              pb: 2,
              mb: 2.5,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                Biên nhận trả linh kiện
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
                Phiếu trả {req.requestCode || 'TR-2026-014'} · Đối chiếu bằng chứng hoàn tất
              </Typography>
            </Box>
            <Chip
              label="Đã trả"
              size="small"
              sx={{
                bgcolor: '#dcfce7',
                color: '#15803d',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: '999px',
              }}
            />
          </Box>

          {/* Info Row */}
          <Grid container spacing={3} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                TRƯỞNG NHÓM
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                {req.leaderName || 'Lê Hoàng Nam'} · {req.leaderCode || '20214589'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                NHÓM THỰC HÀNH
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                {req.teamName || 'Nhóm 07 – IoT'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                ĐƠN MƯỢN GỐC
              </Typography>
              <Typography
                variant="body2"
                component={RouterLink}
                to="/borrow/supplementary"
                sx={{
                  fontWeight: 700,
                  color: '#0058be',
                  textDecoration: 'none',
                  display: 'block',
                  mt: 0.5,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {req.originalBorrowCode || 'BR-2026-1020'}
              </Typography>
            </Grid>
          </Grid>

          {/* Table linh kiện */}
          <TableContainer
            sx={{
              border: '1px solid #f1f5f9',
              borderRadius: 1.5,
              mb: 3,
            }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Linh kiện</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    SL trả
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Đạt / Hỏng
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Kết quả
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(req.components || []).map((comp, idx) => (
                  <TableRow key={comp.componentCode || idx} hover>
                    <TableCell sx={{ py: 1.8 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                        {comp.componentName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {comp.componentCode}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#0f172a' }}>
                      {comp.returnQuantity || 1}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 500 }}>
                      {comp.goodQuantity !== undefined ? `${comp.goodQuantity} đạt / ${comp.damagedQuantity || 0} hỏng` : '1 đạt / 0 hỏng'}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label="Bình thường"
                        size="small"
                        sx={{
                          bgcolor: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: 12,
                          borderRadius: '999px',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Footer Info Box 1 */}
          <Grid container spacing={3} sx={{ pt: 1, borderTop: '1px dashed #e2e8f0' }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                KẾT QUẢ KIỂM TRA
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                3 đạt · 0 hỏng · 0 thiếu
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                BẰNG CHỨNG ĐÃ LƯU
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                1 ảnh trả + ảnh bàn giao
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                NGƯỜI XÁC NHẬN
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                Trần Thị Lan · 29/10, 09:45
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Box 2: Kết quả cập nhật tồn kho */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            bgcolor: '#ffffff',
          }}
        >
          {/* Header Box */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              pb: 2,
              mb: 2.5,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                Kết quả cập nhật tồn kho
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
                Chỉ cộng lại số lượng đã nhận và đạt kiểm tra
              </Typography>
            </Box>
            <Chip
              label="Cập nhật thành công"
              size="small"
              sx={{
                bgcolor: '#dcfce7',
                color: '#15803d',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: '999px',
              }}
            />
          </Box>

          {/* Table Kho */}
          <TableContainer
            sx={{
              border: '1px solid #f1f5f9',
              borderRadius: 1.5,
              mb: 2,
            }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Linh kiện</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Trước trả
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Nhập lại
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Khả dụng mới
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                    Vị trí lưu trữ
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(req.components || []).map((comp, idx) => (
                  <TableRow key={comp.componentCode || idx} hover>
                    <TableCell sx={{ py: 1.8 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                        {comp.componentName}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#64748b', fontWeight: 500 }}>
                      {comp.stockBefore || 11}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 700 }}>
                      +{comp.stockReturned || comp.returnQuantity || 1}
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#15803d', fontWeight: 800, fontSize: 15 }}>
                      {comp.stockAfter || 12}
                    </TableCell>
                    <TableCell sx={{ color: '#475569', fontWeight: 500 }}>
                      {comp.storageLocation || 'Tủ A · Ngăn A1'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Chú thích cập nhật kho */}
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
              Đã nhập lại: +1 ESP32 DevKit và +2 DHT22 · Nhật ký kho gắn với {req.requestCode || 'TR-2026-014'} · 09:45, 29/10/2026.
            </Typography>
          </Box>
        </Paper>

        {/* Bottom Bar: Action & Text */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            pt: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            Đã thu hồi đủ 3 chiếc trong phiếu. Không phát sinh biên bản sự cố ở nhánh bình thường.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => window.print()}
              sx={{
                borderColor: '#cbd5e1',
                color: '#334155',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
              }}
            >
              Tải biên nhận
            </Button>

            <Button
              component={RouterLink}
              to="/borrow/supplementary"
              variant="contained"
              startIcon={<ArrowBackIcon />}
              sx={{
                bgcolor: '#0058be',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                px: 2.5,
                borderRadius: 1.5,
                '&:hover': { bgcolor: '#00479e' },
              }}
            >
              Về danh sách phiếu trả
            </Button>
          </Box>
        </Box>
      </Container>
    </PortalLayout>
  )
}
