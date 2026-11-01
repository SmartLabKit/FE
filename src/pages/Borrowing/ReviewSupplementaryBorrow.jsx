import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { borrowService, MOCK_SUPPLEMENTARY_REQUESTS } from '../../services/borrowService'
import { useAuth } from '../../context/AuthContext'

/**
 * ReviewSupplementaryBorrow Component (Actor: GIẢNG VIÊN - Lecturer)
 * Màn hình xem xét, đối chiếu tồn kho và Phê duyệt / Từ chối yêu cầu mượn bổ sung (Ảnh 4)
 */
export default function ReviewSupplementaryBorrow() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const [requestDetail, setRequestDetail] = useState(MOCK_SUPPLEMENTARY_REQUESTS[0])
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Tải chi tiết yêu cầu
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

  // Giảng viên bấm Duyệt yêu cầu
  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await borrowService.approveSupplementaryBorrow(
        requestDetail.projectId || requestDetail.supplementaryId,
        'Giảng viên đã phê duyệt yêu cầu mượn bổ sung.'
      )
      setToast({
        open: true,
        message: 'Đã phê duyệt yêu cầu! Đơn được chuyển vào hàng đợi Lab để chuẩn bị.',
        severity: 'success',
      })
      setTimeout(() => {
        navigate(`/borrow/supplementary/${requestDetail.supplementaryId}`)
      }, 800)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Phê duyệt thất bại', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // Giảng viên bấm Từ chối yêu cầu
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setToast({
        open: true,
        message: 'Vui lòng nhập lý do từ chối để thông báo cho sinh viên!',
        severity: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      await borrowService.rejectSupplementaryBorrow(
        requestDetail.projectId || requestDetail.supplementaryId,
        rejectReason.trim()
      )
      setToast({
        open: true,
        message: 'Đã gửi quyết định từ chối tới sinh viên.',
        severity: 'info',
      })
      setTimeout(() => {
        navigate(`/borrow/supplementary/${requestDetail.supplementaryId}`)
      }, 800)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Từ chối thất bại', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const reviewerName = user?.name || requestDetail.lecturerName || 'Nguyễn Văn Minh'

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto' }}>
        {/* Navigation Breadcrumb */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
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
            Danh sách chờ duyệt
          </Button>
          <Typography sx={{ color: '#81899a', fontSize: 13 }}>/</Typography>
          <Typography sx={{ color: '#556070', fontSize: 13, fontWeight: 600 }}>
            Mượn bổ sung
          </Typography>
        </Box>

        {/* Page Title */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Xem xét yêu cầu bổ sung
          </Typography>
          <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
            {requestDetail.requestCode || 'BS-2026-014'} · {requestDetail.teamName} · Gửi lúc 09:15, 22/10/2026
          </Typography>
        </Box>

        {/* 2-Column Grid: Cột trái (Thông tin đề nghị & Linh kiện) & Cột phải (Quyết định của GV) */}
        <Grid container spacing={3}>
          {/* CỘT TRÁI */}
          <Grid item xs={12} md={7.5}>
            {/* Box 1: Thông tin người đề nghị */}
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
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16, mb: 2 }}>
                Thông tin người đề nghị
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    HỌ VÀ TÊN
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.leaderName}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    MÃ SỐ SINH VIÊN
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.leaderCode}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    NHÓM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {requestDetail.teamName}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    ĐƠN MƯỢN GỐC
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be', mt: 0.2 }}>
                    {requestDetail.originalBorrowCode}
                  </Typography>
                </Grid>
              </Grid>

              <Box sx={{ pt: 1, borderTop: '1px solid #f0f2f5' }}>
                <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block', mb: 0.5 }}>
                  LÝ DO BỔ SUNG
                </Typography>
                <Typography variant="body2" sx={{ color: '#131b2e', fontWeight: 500 }}>
                  {requestDetail.reason}
                </Typography>
              </Box>
            </Paper>

            {/* Box 2: Linh kiện đề nghị */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                  Linh kiện đề nghị
                </Typography>
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                  {requestDetail.components.length} loại ·{' '}
                  {requestDetail.components.reduce((s, i) => s + i.quantity, 0)} chiếc · Hạn trả{' '}
                  {requestDetail.dueDate || '29/10/2026'}
                </Typography>
              </Box>

              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5, mb: 2 }}>
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

              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, fontStyle: 'italic', display: 'block' }}>
                Số lượng theo đề nghị của sinh viên, không chỉnh sửa tại bước phê duyệt.
              </Typography>
            </Paper>
          </Grid>

          {/* CỘT PHẢI: QUYẾT ĐỊNH CỦA GIẢNG VIÊN */}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                    Quyết định của giảng viên
                  </Typography>
                  <Chip
                    label="Chờ duyệt"
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

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block' }}>
                    NGƯỜI XEM XÉT
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                    {reviewerName}
                  </Typography>
                </Box>

                {/* Box Thông tin đối chiếu */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: 1.5,
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#1e293b', fontWeight: 800, fontSize: 11, display: 'block', mb: 1 }}>
                    Thông tin để đối chiếu
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#475569', fontSize: 12 }}>
                      • ESP32 DevKit: 1 chiếc / tồn 12
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', fontSize: 12 }}>
                      • Cảm biến DHT22: 2 chiếc / tồn 20
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', fontSize: 12 }}>
                      • Hạn trả không vượt đơn gốc: 29/10/2026
                    </Typography>
                  </Box>
                </Paper>

                {/* Hướng dẫn phê duyệt */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, display: 'block', mb: 0.5 }}>
                    • <strong>Duyệt yêu cầu:</strong> thông báo sinh viên và tự động đưa đơn vào hàng đợi Lab để chuẩn bị linh kiện.
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, display: 'block' }}>
                    • <strong>Từ chối:</strong> thông báo lý do cho sinh viên.
                  </Typography>
                </Box>

                {/* Nút Duyệt yêu cầu */}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleApprove}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                  sx={{
                    bgcolor: '#0058be',
                    py: 1.2,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    boxShadow: 'none',
                    mb: 3,
                    '&:hover': { bgcolor: '#0049a3' },
                  }}
                >
                  Duyệt yêu cầu
                </Button>

                <Divider sx={{ my: 2 }} />

                {/* Ô Lý do từ chối */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                    Lý do từ chối (bắt buộc nếu từ chối)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do để thông báo cho sinh viên..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 } }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, mt: 0.5, display: 'block' }}>
                    Lý do sẽ được gửi kèm quyết định. Không cần nhập nếu duyệt yêu cầu.
                  </Typography>
                </Box>

                {/* Nút Từ chối */}
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={handleReject}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CloseIcon />}
                  sx={{
                    py: 1,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    borderColor: '#fca5a5',
                    color: '#dc2626',
                    '&:hover': { bgcolor: '#fef2f2', borderColor: '#ef4444' },
                  }}
                >
                  Từ chối
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
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
