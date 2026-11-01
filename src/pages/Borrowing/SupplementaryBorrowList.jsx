import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
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
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassIcon,
  Cancel as CancelIcon,
  ArrowForward as ArrowForwardIcon,
  AssignmentReturn as AssignmentReturnIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  borrowService,
  MOCK_SUPPLEMENTARY_REQUESTS,
  MOCK_ORIGINAL_BORROWS,
  MOCK_RETURN_REQUESTS,
} from '../../services/borrowService'
import { useAuth } from '../../context/AuthContext'

/**
 * SupplementaryBorrowList Component
 * Danh sách Đơn mượn, Phiếu mượn bổ sung (MF5.1) & Phiếu trả linh kiện (MF5.2)
 */
export default function SupplementaryBorrowList() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isLecturer = user?.roleLabel === 'LECTURER' || user?.roles?.includes('Lecturer')

  const [supplementaryRequests, setSupplementaryRequests] = useState(MOCK_SUPPLEMENTARY_REQUESTS)
  const [returnRequests, setReturnRequests] = useState(MOCK_RETURN_REQUESTS)

  useEffect(() => {
    let ignore = false
    if (isLecturer) {
      borrowService.getPendingApprovalProjects().then((data) => {
        if (!ignore && data?.items) setSupplementaryRequests(data.items)
      }).catch(console.warn)
    }
    borrowService.getReturnRequests().then((data) => {
      if (!ignore && data) setReturnRequests(data)
    }).catch(console.warn)

    return () => {
      ignore = true
    }
  }, [isLecturer])

  const getStatusChip = (status) => {
    switch (status) {
      case 'PendingLecturer':
        return (
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '14px !important' }} />}
            label="Chờ giảng viên duyệt"
            size="small"
            sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Rejected':
        return (
          <Chip
            icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
            label="Bị từ chối"
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Approved':
        return (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
            label="Đã duyệt"
            size="small"
            sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
          />
        )
      default:
        return <Chip label={status || 'Bản nháp'} size="small" />
    }
  }

  const getReturnStatusChip = (status) => {
    switch (status) {
      case 'PendingLab':
        return (
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '14px !important' }} />}
            label="Chờ Lab kiểm tra"
            size="small"
            sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Returned':
        return (
          <Chip
            icon={<CheckIcon sx={{ fontSize: '14px !important' }} />}
            label="Đã trả"
            size="small"
            sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
          />
        )
      default:
        return <Chip label={status || 'Đang xử lý'} size="small" />
    }
  }

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
              {isLecturer ? 'Danh sách yêu cầu mượn chờ duyệt' : 'Đơn mượn của tôi & Mượn / Trả linh kiện'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
              {isLecturer
                ? 'Phê duyệt hoặc từ chối các yêu cầu mượn linh kiện bổ sung của sinh viên'
                : 'Theo dõi tiến trình mượn chính, gửi phiếu mượn bổ sung và tạo phiếu trả linh kiện cho Lab'}
            </Typography>
          </Box>

          {!isLecturer && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<AssignmentReturnIcon />}
                onClick={() => navigate('/borrow/return/create')}
                sx={{
                  borderColor: '#0058be',
                  color: '#0058be',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#eff6ff', borderColor: '#0058be' },
                }}
              >
                Tạo phiếu trả linh kiện (MF5.2)
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/borrow/supplementary/create')}
                sx={{
                  bgcolor: '#0058be',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0049a3' },
                }}
              >
                Tạo phiếu mượn bổ sung (MF5.1)
              </Button>
            </Box>
          )}
        </Box>

        {/* Bảng Phiếu trả linh kiện (MF5.2) */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #e4e6ef',
            bgcolor: '#ffffff',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                Phiếu trả linh kiện (MF5.2 - Return Process)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Quy trình trả linh kiện: Gửi phiếu trả → Lab tiếp nhận & kiểm tra → Xác nhận & cập nhật kho
              </Typography>
            </Box>
            <Chip
              label={`${returnRequests.length} phiếu`}
              size="small"
              sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
            />
          </Box>

          <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#fafbff' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ PHIẾU TRẢ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐƠN GỐC</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NHÓM / NGƯỜI TRẢ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGÀY TRẢ DỰ KIẾN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐỊA ĐIỂM</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnRequests.map((req) => (
                  <TableRow key={req.returnId || req.requestCode} hover>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be' }}>
                      {req.requestCode}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>
                      {req.originalBorrowCode}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                        {req.teamName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                        {req.leaderName} ({req.leaderCode})
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                      {req.returnDate}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#424754' }}>
                      {req.returnLocation}
                    </TableCell>
                    <TableCell>
                      {getReturnStatusChip(req.status)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {/* Chi tiết cho sinh viên (Ảnh 3 & 4) */}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/borrow/return/${req.returnId || req.requestCode}`)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            borderRadius: 1,
                            borderColor: '#dcdfe6',
                          }}
                        >
                          Chi tiết (SV)
                        </Button>

                        {/* Xác nhận trả cho Nhân viên Lab (Ảnh 5) */}
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => navigate(`/borrow/return/confirm/${req.returnId || req.requestCode}`)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            borderRadius: 1,
                            bgcolor: '#16a34a',
                            '&:hover': { bgcolor: '#15803d' },
                            boxShadow: 'none',
                          }}
                        >
                          Xác nhận trả (Lab)
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Bảng Phiếu mượn bổ sung (MF5.1) */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #e4e6ef',
            bgcolor: '#ffffff',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
              Phiếu mượn bổ sung (MF5.1 - Supplementary Borrowing)
            </Typography>
            <Chip
              label={`${supplementaryRequests.length} phiếu`}
              size="small"
              sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 800, fontSize: 11 }}
            />
          </Box>

          <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#fafbff' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ PHIẾU</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐƠN GỐC</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NHÓM / NGƯỜI ĐỀ NGHỊ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>GIẢNG VIÊN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {supplementaryRequests.map((req) => (
                  <TableRow key={req.supplementaryId || req.requestCode} hover>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be' }}>
                      {req.requestCode}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>
                      {req.originalBorrowCode}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                        {req.teamName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                        {req.leaderName} ({req.leaderCode})
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#424754', fontWeight: 600 }}>
                      {req.lecturerName}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                      {req.dueDate}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(req.status)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {/* Nút xem chi tiết cho sinh viên */}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/borrow/supplementary/${req.supplementaryId || req.requestCode}`)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            borderRadius: 1,
                            borderColor: '#dcdfe6',
                          }}
                        >
                          Chi tiết
                        </Button>

                        {/* Nút duyệt cho giảng viên */}
                        {isLecturer && req.status === 'PendingLecturer' && (
                          <Button
                            size="small"
                            variant="contained"
                            endIcon={<ArrowForwardIcon sx={{ fontSize: 13 }} />}
                            onClick={() => navigate(`/borrow/supplementary/review/${req.supplementaryId || req.requestCode}`)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: 11,
                              borderRadius: 1,
                              bgcolor: '#0058be',
                              boxShadow: 'none',
                            }}
                          >
                            Xem xét
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Bảng Đơn mượn gốc hiện tại */}
        {!isLecturer && (
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
              Đơn mượn chính hiện tại (Active Borrow Requests)
            </Typography>

            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ ĐƠN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐỀ TÀI / DỰ ÁN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LỚP MÔN HỌC</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>GIẢNG VIÊN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MOCK_ORIGINAL_BORROWS.map((b) => (
                    <TableRow key={b.borrowRequestId} hover>
                      <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be' }}>
                        {b.requestCode}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e' }}>
                        {b.projectTitle}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#424754' }}>
                        {b.classCode}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                        {b.dueDate}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#424754', fontWeight: 600 }}>
                        {b.lecturerName}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AssignmentReturnIcon sx={{ fontSize: 13 }} />}
                            onClick={() => navigate('/borrow/return/create')}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 11,
                              borderRadius: 1,
                              borderColor: '#dcdfe6',
                            }}
                          >
                            Trả linh kiện
                          </Button>
                          <Button
                            size="small"
                            variant="tonal"
                            startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                            onClick={() => navigate('/borrow/supplementary/create')}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 11,
                              borderRadius: 1,
                              bgcolor: '#eaedff',
                              color: '#0058be',
                            }}
                          >
                            Mượn bổ sung
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>
    </PortalLayout>
  )
}
