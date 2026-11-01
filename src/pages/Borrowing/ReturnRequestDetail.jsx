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
  AccessTime as AccessTimeIcon,
  DownloadOutlined as DownloadIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
} from '@mui/icons-material'
import { useNavigate, useParams, useSearchParams, Link as RouterLink } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { borrowService } from '../../services/borrowService'

/**
 * ReturnRequestDetail Component (Actor: Sinh viên)
 * Chi tiết phiếu trả linh kiện TR-2026-014 (Hỗ trợ 2 trạng thái):
 * - Trạng thái A (Ảnh 3 & 4): Chờ Lab tiếp nhận & kiểm tra
 * - Trạng thái B (Ảnh mới): Trả linh kiện thành công · Đã xác nhận & hoàn tất
 */
export default function ReturnRequestDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [returnReq, setReturnReq] = useState(null)

  // Trạng thái demo: 'pending' (Chờ Lab - Ảnh 3 & 4) | 'completed' (Thành công - Ảnh mới)
  const [demoStatus, setDemoStatus] = useState(() => {
    return searchParams.get('status') === 'completed' ? 'completed' : 'pending'
  })

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        setLoading(true)
        const req = await borrowService.getReturnRequestById(id || 'TR-2026-014')
        if (isMounted) {
          setReturnReq(req)
          if (req.status === 'Returned') {
            setDemoStatus('completed')
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết phiếu trả:', err)
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
        currentRole="Sinh viên"
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </PortalLayout>
    )
  }

  const req = returnReq || {
    requestCode: 'TR-2026-014',
    returnId: 'TR-2026-014',
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
    originalBorrowCode: 'BR-2026-1020',
    submittedAt: '2026-10-29T09:15:00.000Z',
    returnDate: '29/10/2026',
    returnLocation: 'Phòng thực hành IoT · B1-302',
    note: 'Nhóm đã hoàn thành mô hình IoT, xin trả 1 ESP32 DevKit và 2 cảm biến DHT22 đã nhận.',
    components: [
      {
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        returnQuantity: 1,
        goodQuantity: 1,
        damagedQuantity: 0,
        dueDate: '29/10/2026',
      },
      {
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        returnQuantity: 2,
        goodQuantity: 2,
        damagedQuantity: 0,
        dueDate: '29/10/2026',
      },
    ],
  }

  const totalReturnCount = (req.components || []).reduce(
    (sum, item) => sum + (item.returnQuantity || 1),
    0
  )

  const isCompleted = demoStatus === 'completed'

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
      currentRole="Sinh viên"
      currentUser={{ name: 'Lê Hoàng Nam', roleLabel: 'SINH VIÊN · 20214589' }}
      activeMenuKey="borrow"
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Thanh công cụ chuyển đổi trạng thái Demo nhanh */}
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            bgcolor: isCompleted ? '#f0fdf4' : '#eff6ff',
            border: `1px dashed ${isCompleted ? '#86efac' : '#60a5fa'}`,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: isCompleted ? '#166534' : '#1e40af', fontWeight: 700 }}>
              📌 Chuyển đổi trạng thái demo:
            </Typography>
            <Button
              size="small"
              variant={!isCompleted ? 'contained' : 'outlined'}
              onClick={() => setDemoStatus('pending')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 1,
                bgcolor: !isCompleted ? '#0058be' : 'transparent',
                borderColor: '#0058be',
                color: !isCompleted ? '#ffffff' : '#0058be',
              }}
            >
              1️⃣ Chờ Lab tiếp nhận (Ảnh 3 & 4)
            </Button>
            <Button
              size="small"
              variant={isCompleted ? 'contained' : 'outlined'}
              onClick={() => setDemoStatus('completed')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 1,
                bgcolor: isCompleted ? '#16a34a' : 'transparent',
                borderColor: '#16a34a',
                color: isCompleted ? '#ffffff' : '#16a34a',
                '&:hover': { bgcolor: isCompleted ? '#15803d' : '#f0fdf4' },
              }}
            >
              2️⃣ Trả thành công (Ảnh mới)
            </Button>
          </Box>

          <Button
            size="small"
            variant="outlined"
            startIcon={<AdminPanelSettingsIcon />}
            onClick={() => navigate(`/borrow/return/confirm/${req.requestCode || 'TR-2026-014'}`)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 12,
              borderColor: '#94a3b8',
              color: '#334155',
            }}
          >
            Mở màn hình Lab xác nhận (Ảnh 5) 👉
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
            Đơn mượn của tôi
          </Button>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            / Trả linh kiện
          </Typography>
        </Box>

        {/* Main Heading */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            {isCompleted ? 'Trả linh kiện thành công' : `Phiếu trả ${req.requestCode || 'TR-2026-014'}`}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {isCompleted
              ? `Phiếu trả ${req.requestCode || 'TR-2026-014'} · ${req.teamName || 'Nhóm 07 – IoT'} · Kết quả nhánh bình thường`
              : `Yêu cầu đã gửi · 29/10/2026, 09:15 · ${req.teamName || 'Nhóm 07 – IoT'}`}
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
            {isCompleted ? 'Lab đã xác nhận nhận đủ 3/3 linh kiện' : 'Đã gửi phiếu trả đến Lab'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#166534', mt: 0.2 }}>
            {isCompleted
              ? 'Tất cả linh kiện bình thường. Tồn khả dụng đã được cập nhật lúc 09:45, 29/10/2026. Phiếu trả của bạn đã hoàn tất.'
              : 'Phiếu đã vào hàng đợi thu hồi. Bạn sẽ nhận được thông báo sau khi Lab kiểm tra và xác nhận.'}
          </Typography>
        </Alert>

        {/* 3-Step Stepper */}
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
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {isCompleted ? <CheckIcon sx={{ fontSize: 18 }} /> : '2'}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCompleted ? 600 : 700,
                    color: isCompleted ? '#0f172a' : '#0058be',
                  }}
                >
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
                    bgcolor: isCompleted ? '#0058be' : '#f1f5f9',
                    color: isCompleted ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {isCompleted ? <CheckIcon sx={{ fontSize: 18 }} /> : '3'}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCompleted ? 600 : 500,
                    color: isCompleted ? '#0f172a' : '#64748b',
                  }}
                >
                  Xác nhận & cập nhật kho
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* ======================= TRẠNG THÁI A: CHỜ LAB (ẢNH 3 & 4) ======================= */}
        {!isCompleted && (
          <>
            {/* Chi tiết phiếu trả Box */}
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pb: 2,
                  mb: 2.5,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                  Chi tiết phiếu trả
                </Typography>
                <Chip
                  label="Chờ Lab"
                  size="small"
                  sx={{
                    bgcolor: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: '999px',
                  }}
                />
              </Box>

              {/* Rows thông tin */}
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

              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    NGÀY TRẢ DỰ KIẾN
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                    {req.returnDate || '29/10/2026'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    ĐỊA ĐIỂM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                    {req.returnLocation || 'Phòng IoT · B1-302'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    TỔNG ĐỀ NGHỊ TRẢ
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                    {req.components?.length || 2} loại · {totalReturnCount} chiếc
                  </Typography>
                </Grid>
              </Grid>

              {/* Bảng linh kiện */}
              <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5, mb: 2.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Linh kiện</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        SL trả
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Hạn trả</TableCell>
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
                        <TableCell sx={{ color: '#0f172a' }}>
                          {comp.dueDate || '29/10/2026'}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label="Chờ Lab kiểm tra"
                            size="small"
                            sx={{
                              bgcolor: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 600,
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

              {req.note && (
                <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic', fontSize: 13 }}>
                  Ghi chú: {req.note}
                </Typography>
              )}
            </Paper>

            {/* 2 Cards Theo dõi & Bước tiếp theo */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    height: '100%',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                    Theo dõi xử lý
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20, mt: 0.2 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          Đã gửi phiếu trả
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          29/10/2026, 09:15 · {req.leaderName || 'Lê Hoàng Nam'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <AccessTimeIcon sx={{ color: '#0284c7', fontSize: 20, mt: 0.2 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          Chờ Lab tiếp nhận
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Phiếu đã vào hàng đợi thu hồi
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                      Bước tiếp theo
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.8 }}>
                      Mang đủ 3 linh kiện đến Lab để bàn giao
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.5 }}>
                      Lab sẽ tải ảnh trả lên, kiểm tra từng linh kiện và đối chiếu với bằng chứng bàn giao.
                      Tồn khả dụng chưa thay đổi khi phiếu đang chờ xử lý.
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2.5 }}>
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
                      Về danh sách đơn
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        {/* ======================= TRẠNG THÁI B: TRẢ THÀNH CÔNG (ẢNH MỚI) ======================= */}
        {isCompleted && (
          <Grid container spacing={3}>
            {/* Cột Trái (Box Chi tiết kết quả trả & Xác nhận cập nhật tồn kho) */}
            <Grid item xs={12} md={8}>
              {/* Box 1: Chi tiết kết quả trả */}
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
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 2,
                    mb: 2.5,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                    Chi tiết kết quả trả
                  </Typography>
                  <Chip
                    label="Hoàn tất"
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

                {/* Rows thông tin */}
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

                {/* Bảng linh kiện */}
                <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5, mb: 3 }}>
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

                {/* 3 thông số chân bảng */}
                <Grid container spacing={3} sx={{ pt: 1, borderTop: '1px dashed #e2e8f0', mb: 1.5 }}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      ĐÃ TRẢ
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                      2 loại · 3 chiếc
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      CÒN PHẢI TRẢ TRONG PHIẾU
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                      0 chiếc
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      NHÂN VIÊN XÁC NHẬN
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                      Trần Thị Lan
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                  Kết quả áp dụng cho các linh kiện trong phiếu {req.requestCode || 'TR-2026-014'}, liên kết đơn mượn {req.originalBorrowCode || 'BR-2026-1020'}.
                </Typography>
              </Paper>

              {/* Box 2: Xác nhận cập nhật tồn kho */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#ffffff',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 2,
                    mb: 2,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                    Xác nhận cập nhật tồn kho
                  </Typography>
                  <Chip
                    label="Đã đồng bộ"
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

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 22, mt: 0.3 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>
                      +1 ESP32 DevKit · +2 cảm biến DHT22 vào kho khả dụng
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                      Khả dụng sau trả: ESP32 12 chiếc · DHT22 20 chiếc.
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
                      3 chiếc đạt kiểm tra · Không phát sinh hư hỏng hoặc biên bản sự cố.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* Cột Phải (Card Theo dõi xử lý & Thao tác) */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#ffffff',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 2.5 }}>
                  Theo dõi xử lý
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3 }}>
                  {/* Event 1 */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20, mt: 0.2 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Đã gửi phiếu trả
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        29/10/2026, 09:15 · {req.leaderName || 'Lê Hoàng Nam'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Event 2 */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20, mt: 0.2 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Lab đã kiểm tra
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        29/10/2026, 09:35 · Trần Thị Lan
                      </Typography>
                    </Box>
                  </Box>

                  {/* Event 3 */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20, mt: 0.2 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Đã xác nhận & cập nhật kho
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        29/10/2026, 09:45 · Hoàn tất
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, mb: 3 }}>
                  Biên nhận đã được lưu để nhóm tra cứu. Bạn không cần thực hiện thêm thao tác cho phiếu trả này.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.print()}
                    fullWidth
                    sx={{
                      borderColor: '#cbd5e1',
                      color: '#334155',
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 1.5,
                      py: 1,
                      '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                    }}
                  >
                    Tải biên nhận trả
                  </Button>

                  <Button
                    component={RouterLink}
                    to="/borrow/supplementary"
                    variant="contained"
                    startIcon={<ArrowBackIcon />}
                    fullWidth
                    sx={{
                      bgcolor: '#0058be',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 1.5,
                      py: 1,
                      '&:hover': { bgcolor: '#00479e' },
                    }}
                  >
                    Về danh sách đơn
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </PortalLayout>
  )
}
