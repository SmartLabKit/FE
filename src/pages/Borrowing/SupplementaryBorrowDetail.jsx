import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Snackbar,
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
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { borrowService, MOCK_SUPPLEMENTARY_REQUESTS } from '../../services/borrowService'

/**
 * SupplementaryBorrowDetail Component (Actor: Sinh viên)
 * Hiển thị chi tiết phiếu mượn bổ sung:
 * - Trạng thái Chờ duyệt (Ảnh 3): Stepper 3 bước, Thông tin đang xem xét
 * - Trạng thái Bị từ chối (Ảnh 5): Banner từ chối, Lý do từ chối, Nút Tạo lại yêu cầu
 */
export default function SupplementaryBorrowDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [requestDetail, setRequestDetail] = useState(MOCK_SUPPLEMENTARY_REQUESTS[0])
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Tải thông tin chi tiết phiếu
  useEffect(() => {
    let ignore = false
    const reqId = id || 'BS-2026-014'
    borrowService
      .getSupplementaryBorrowById(reqId)
      .then((data) => {
        if (!ignore && data) setRequestDetail(data)
      })
      .catch((err) => console.warn(err))
    return () => {
      ignore = true
    }
  }, [id])

  // Trạng thái phiếu
  const isRejected = requestDetail.status === 'Rejected'

  // Chuyển sang form tạo lại yêu cầu (sao chép nội dung cũ)
  const handleRecreateRequest = () => {
    navigate('/borrow/supplementary/create', {
      state: {
        prefill: {
          originalBorrowCode: requestDetail.originalBorrowCode,
          reason: requestDetail.reason,
          dueDate: requestDetail.dueDate,
          components: requestDetail.components,
        },
      },
    })
  }

  // Toggle nhanh giữa 2 trạng thái Chờ duyệt / Bị từ chối để tiện test & demo
  const handleToggleStatusDemo = () => {
    setRequestDetail((prev) => ({
      ...prev,
      status: prev.status === 'Rejected' ? 'PendingLecturer' : 'Rejected',
      reviewedAt: prev.status === 'Rejected' ? null : '2026-10-22T10:00:00.000Z',
      rejectReason:
        prev.status === 'Rejected'
          ? null
          : 'Nhu cầu bổ sung chưa được giải trình rõ cho bài thực hành hiện tại.',
    }))
    setToast({
      open: true,
      message: 'Đã đổi trạng thái demo giữa Chờ duyệt và Bị từ chối!',
      severity: 'info',
    })
  }

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto' }}>
        {/* Navigation Breadcrumb */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              onClick={() => navigate('/borrow/my-requests')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#0058be',
                fontSize: 13,
                p: 0,
                minWidth: 'auto',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              Đơn mượn của tôi
            </Button>
            <Typography sx={{ color: '#81899a', fontSize: 13 }}>/</Typography>
            <Typography sx={{ color: '#556070', fontSize: 13, fontWeight: 600 }}>
              Mượn bổ sung
            </Typography>
          </Box>

          <Button
            size="small"
            variant="outlined"
            onClick={handleToggleStatusDemo}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 1.5, borderColor: '#dcdfe6' }}
          >
            Chuyển demo: {isRejected ? 'Xem Chờ duyệt (Ảnh 3)' : 'Xem Bị từ chối (Ảnh 5)'}
          </Button>
        </Box>

        {/* Page Title & Status */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Phiếu bổ sung {requestDetail.requestCode || 'BS-2026-014'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
            {isRejected
              ? 'Kết quả xem xét · Nhánh từ chối'
              : 'Yêu cầu đã gửi · 22/10/2026, 09:15'}
          </Typography>
        </Box>

        {/* ==================== TRẠNG THÁI: CHỜ DUYỆT (ẢNH 3) ==================== */}
        {!isRejected && (
          <Box>
            {/* Banner xanh: Đã gửi yêu cầu */}
            <Alert
              severity="success"
              icon={<CheckCircleIcon sx={{ color: '#16a34a' }} />}
              sx={{
                mb: 3,
                borderRadius: 2,
                bgcolor: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                p: 1.8,
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14 }}>
                Đã gửi yêu cầu đến giảng viên {requestDetail.lecturerName || 'Nguyễn Văn Minh'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#15803d', fontSize: 12 }}>
                Bạn sẽ nhận được thông báo khi giảng viên có quyết định.
              </Typography>
            </Alert>

            {/* Stepper 3 bước tiến trình */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              {/* Bước 1: Gửi yêu cầu */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: '#0058be',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <CheckIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#131b2e' }}>
                  Gửi yêu cầu
                </Typography>
              </Box>

              <Divider sx={{ flex: 1, minWidth: 40, borderColor: '#0058be', display: { xs: 'none', sm: 'block' } }} />

              {/* Bước 2: Giảng viên duyệt */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: '#0058be',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  2
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#0058be' }}>
                  Giảng viên duyệt
                </Typography>
              </Box>

              <Divider sx={{ flex: 1, minWidth: 40, borderColor: '#e4e6ef', display: { xs: 'none', sm: 'block' } }} />

              {/* Bước 3: Chờ Lab chuẩn bị */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: '#f1f5f9',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  3
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>
                  Chờ Lab chuẩn bị
                </Typography>
              </Box>
            </Paper>

            {/* Chi tiết yêu cầu */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                  Chi tiết yêu cầu
                </Typography>
                <Chip
                  label="Chờ giảng viên"
                  size="small"
                  sx={{
                    bgcolor: '#fef3c7',
                    color: '#b45309',
                    fontWeight: 800,
                    fontSize: 11,
                    borderRadius: 1,
                  }}
                />
              </Box>

              {/* Metadata 3 cột */}
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                    TRƯỞNG NHÓM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.leaderName} · {requestDetail.leaderCode}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                    NHÓM THỰC HÀNH
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.teamName}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                    ĐƠN GỐC
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be', mt: 0.2 }}>
                    {requestDetail.originalBorrowCode}
                  </Typography>
                </Grid>
              </Grid>

              {/* Lý do bổ sung */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                  LÝ DO BỔ SUNG
                </Typography>
                <Typography variant="body2" sx={{ color: '#131b2e', mt: 0.4, fontWeight: 500 }}>
                  {requestDetail.reason}
                </Typography>
              </Box>

              {/* Bảng linh kiện */}
              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafbff' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>Linh kiện</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Số lượng</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>Hạn trả</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requestDetail.components.map((item) => (
                      <TableRow key={item.componentId} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
                            {item.componentName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                            {item.componentCode}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                          {item.quantity}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                          {item.dueDate}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* 2 Card thông tin dưới: Đang chờ xem xét & Bước tiếp theo */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    bgcolor: '#fafbff',
                    height: '100%',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e', mb: 2 }}>
                    Đang chờ xem xét
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                        GIẢNG VIÊN
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                        {requestDetail.lecturerName}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                        TIẾP NHẬN LÚC
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', mt: 0.2 }}>
                        22/10/2026, 09:15
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 12 }}>
                    Giảng viên sẽ xem xét nhu cầu, số lượng và hạn trả trước khi phê duyệt.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    bgcolor: '#ffffff',
                    height: '100%',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e', mb: 1.5 }}>
                    Bước tiếp theo
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13, mb: 0.5 }}>
                    Kết quả sau khi giảng viên duyệt
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5, display: 'block' }}>
                    Nếu được duyệt, hệ thống tự đưa đơn vào hàng đợi Lab. Nếu từ chối, bạn sẽ nhận được lý do để điều chỉnh và gửi lại yêu cầu.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ==================== TRẠNG THÁI: NHÁNH TỪ CHỐI (ẢNH 5) ==================== */}
        {isRejected && (
          <Box>
            {/* Banner đỏ Alert: Yêu cầu bị từ chối */}
            <Alert
              severity="error"
              icon={<CancelIcon sx={{ color: '#dc2626' }} />}
              sx={{
                mb: 3,
                borderRadius: 2,
                bgcolor: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                p: 1.8,
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14 }}>
                Yêu cầu bổ sung của bạn đã bị từ chối
              </Typography>
              <Typography variant="caption" sx={{ color: '#b91c1c', fontSize: 12 }}>
                Thông báo gửi đến {requestDetail.leaderName} lúc 10:00, 22/10/2026. Xem lý do bên dưới trước khi tạo lại yêu cầu.
              </Typography>
            </Alert>

            {/* Quyết định từ giảng viên */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                  Quyết định từ giảng viên
                </Typography>
                <Chip
                  label="Từ chối"
                  size="small"
                  sx={{
                    bgcolor: '#fee2e2',
                    color: '#dc2626',
                    fontWeight: 800,
                    fontSize: 11,
                    borderRadius: 1,
                  }}
                />
              </Box>

              <Grid container spacing={3} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    GIẢNG VIÊN
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.lecturerName}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    THỜI ĐIỂM QUYẾT ĐỊNH
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    22/10/2026, 10:00
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    KẾT QUẢ
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#dc2626', mt: 0.2 }}>
                    Không phê duyệt bổ sung
                  </Typography>
                </Grid>
              </Grid>

              {/* Box hồng lý do từ chối */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: '#fff1f2',
                  border: '1px solid #ffe4e6',
                }}
              >
                <Typography variant="caption" sx={{ color: '#e11d48', fontWeight: 800, fontSize: 10, display: 'block', mb: 0.5 }}>
                  LÝ DO TỪ CHỐI
                </Typography>
                <Typography variant="body2" sx={{ color: '#9f1239', fontWeight: 600, fontSize: 13 }}>
                  {requestDetail.rejectReason || 'Nhu cầu bổ sung chưa được giải trình rõ cho bài thực hành hiện tại.'}
                </Typography>
              </Box>
            </Paper>

            {/* 2 Cột: Cột trái (Nội dung đã đề nghị) & Cột phải (Tạo lại yêu cầu) */}
            <Grid container spacing={3}>
              {/* Cột trái: Nội dung đã đề nghị */}
              <Grid item xs={12} md={7.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16, mb: 2 }}>
                    Nội dung đã đề nghị
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                        TRƯỞNG NHÓM
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                        {requestDetail.leaderName} · {requestDetail.leaderCode}
                      </Typography>
                    </Grid>

                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                        NHÓM THỰC HÀNH
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                        {requestDetail.teamName}
                      </Typography>
                    </Grid>

                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                        ĐƠN GỐC
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be', mt: 0.2 }}>
                        {requestDetail.originalBorrowCode}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                      LÝ DO BỔ SUNG
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#131b2e', mt: 0.2 }}>
                      {requestDetail.reason}
                    </Typography>
                  </Box>

                  <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#fafbff' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>Linh kiện</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Số lượng</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>Hạn trả</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {requestDetail.components.map((item) => (
                          <TableRow key={item.componentId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
                                {item.componentName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                                {item.componentCode}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                              {item.quantity}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                              {item.dueDate}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Cột phải: Tạo lại yêu cầu */}
              <Grid item xs={12} md={4.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    bgcolor: '#ffffff',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 15, mb: 1.5 }}>
                      Tạo lại yêu cầu
                    </Typography>

                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13, mb: 1 }}>
                      Làm rõ nhu cầu cho bài thực hành hiện tại
                    </Typography>

                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5, display: 'block', mb: 3 }}>
                      Bạn có thể tạo phiếu mới từ nội dung này và bổ sung giải trình. Phiếu {requestDetail.requestCode} được giữ nguyên để tra cứu.
                    </Typography>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleRecreateRequest}
                      startIcon={<RefreshIcon />}
                      sx={{
                        bgcolor: '#0058be',
                        py: 1.2,
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: 13,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: '#0049a3' },
                      }}
                    >
                      Tạo lại yêu cầu
                    </Button>
                  </Box>

                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic', display: 'block', mt: 3 }}>
                    Quyết định này kết thúc yêu cầu hiện tại.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
