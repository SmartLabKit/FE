import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassIcon,
  Cancel as CancelIcon,
  ArrowForward as ArrowForwardIcon,
  AssignmentReturn as AssignmentReturnIcon,
  Check as CheckIcon,
  Update as UpdateIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  borrowService,
  MOCK_SUPPLEMENTARY_REQUESTS,
  MOCK_ORIGINAL_BORROWS,
  MOCK_RETURN_REQUESTS,
  MOCK_BORROW_EXTENSIONS,
} from '../../services/borrowService'
import { useAuth } from '../../context/AuthContext'

/**
 * SupplementaryBorrowList Component
 * Danh sách Đơn mượn, Mượn bổ sung (MF5.1), Trả linh kiện (MF5.2) & Quản lý Gia hạn (Extensions)
 */
export default function SupplementaryBorrowList() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isLecturer = user?.roleLabel === 'LECTURER' || user?.roles?.includes('Lecturer')

  const [supplementaryRequests, setSupplementaryRequests] = useState(MOCK_SUPPLEMENTARY_REQUESTS)
  const [returnRequests, setReturnRequests] = useState(MOCK_RETURN_REQUESTS)
  const [borrowRequests, setBorrowRequests] = useState(MOCK_ORIGINAL_BORROWS)
  const [extensions, setExtensions] = useState(MOCK_BORROW_EXTENSIONS)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // State Modal xin gia hạn (POST /api/borrow-requests/{id}/extensions)
  const [extDialogOpen, setExtDialogOpen] = useState(false)
  const [selectedBorrow, setSelectedBorrow] = useState(null)
  const [requestedDays, setRequestedDays] = useState(7)
  const [extReason, setExtReason] = useState('')
  const [extSubmitting, setExtSubmitting] = useState(false)

  // State Modal từ chối gia hạn (POST /api/borrow-extensions/{extensionId}/reject)
  const [rejectExtDialogOpen, setRejectExtDialogOpen] = useState(false)
  const [selectedExt, setSelectedExt] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Tải dữ liệu ban đầu
  useEffect(() => {
    let isMounted = true

    Promise.all([
      isLecturer ? borrowService.getPendingApprovalProjects() : Promise.resolve(null),
      borrowService.getReturnRequests(),
      borrowService.getMyBorrowRequests(),
      borrowService.getBorrowExtensions(),
    ])
      .then(([suppData, retData, myBorrows, extData]) => {
        if (!isMounted) return
        if (suppData?.items) setSupplementaryRequests(suppData.items)
        if (retData) setReturnRequests(retData)
        if (myBorrows?.items) setBorrowRequests(myBorrows.items)
        if (extData?.items) setExtensions(extData.items)
      })
      .catch((err) => {
        console.warn('Lỗi tải dữ liệu mượn trả:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isLecturer])

  const refreshData = async () => {
    try {
      const [suppData, retData, myBorrows, extData] = await Promise.all([
        isLecturer ? borrowService.getPendingApprovalProjects() : Promise.resolve(null),
        borrowService.getReturnRequests(),
        borrowService.getMyBorrowRequests(),
        borrowService.getBorrowExtensions(),
      ])

      if (suppData?.items) setSupplementaryRequests(suppData.items)
      if (retData) setReturnRequests(retData)
      if (myBorrows?.items) setBorrowRequests(myBorrows.items)
      if (extData?.items) setExtensions(extData.items)
    } catch (err) {
      console.warn('Lỗi tải lại dữ liệu mượn trả:', err)
    }
  }

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

  const getExtensionStatusChip = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '14px !important' }} />}
            label="Chờ duyệt gia hạn"
            size="small"
            sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Approved':
        return (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
            label="Đã duyệt gia hạn"
            size="small"
            sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Rejected':
        return (
          <Chip
            icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
            label="Từ chối gia hạn"
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11 }}
          />
        )
      default:
        return <Chip label={status} size="small" />
    }
  }

  // Mở modal xin gia hạn
  const handleOpenExtModal = (borrow) => {
    setSelectedBorrow(borrow)
    setRequestedDays(7)
    setExtReason('')
    setExtDialogOpen(true)
  }

  // Gửi xin gia hạn (POST /api/borrow-requests/{id}/extensions)
  const handleSubmitExtension = async () => {
    if (!selectedBorrow) return
    if (!extReason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do xin gia hạn', severity: 'warning' })
      return
    }

    setExtSubmitting(true)
    try {
      await borrowService.requestExtension(selectedBorrow.borrowRequestId, {
        requestedDays: Number(requestedDays),
        reason: extReason.trim(),
      })
      setToast({ open: true, message: 'Đã gửi yêu cầu gia hạn đến giảng viên thành công!', severity: 'success' })
      setExtDialogOpen(false)
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Xin gia hạn thất bại', severity: 'error' })
    } finally {
      setExtSubmitting(false)
    }
  }

  // Giảng viên duyệt gia hạn (POST /api/borrow-extensions/{extensionId}/approve)
  const handleApproveExtension = async (ext) => {
    try {
      await borrowService.approveExtension(ext.extensionId, { comment: 'Đã chấp thuận gia hạn đồ án' })
      setToast({ open: true, message: `Đã duyệt gia hạn cho đơn ${ext.requestCode}!`, severity: 'success' })
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Duyệt gia hạn thất bại', severity: 'error' })
    }
  }

  // Giảng viên mở modal từ chối gia hạn (POST /api/borrow-extensions/{extensionId}/reject)
  const handleOpenRejectExt = (ext) => {
    setSelectedExt(ext)
    setRejectReason('')
    setRejectExtDialogOpen(true)
  }

  // Gửi từ chối gia hạn
  const handleConfirmRejectExt = async () => {
    if (!selectedExt) return
    if (!rejectReason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do từ chối', severity: 'warning' })
      return
    }

    setRejectSubmitting(true)
    try {
      await borrowService.rejectExtension(selectedExt.extensionId, { reason: rejectReason.trim() })
      setToast({ open: true, message: `Đã từ chối gia hạn đơn ${selectedExt.requestCode}`, severity: 'info' })
      setRejectExtDialogOpen(false)
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Từ chối thất bại', severity: 'error' })
    } finally {
      setRejectSubmitting(false)
    }
  }

  // Hủy đơn mượn (POST /api/borrow-requests/{id}/cancel)
  const handleCancelBorrow = async (borrow) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đơn mượn ${borrow.requestCode}?`)) return
    try {
      await borrowService.cancelBorrowRequest(borrow.borrowRequestId, { reason: 'Nhóm chủ động hủy đơn' })
      setToast({ open: true, message: `Đã hủy đơn mượn ${borrow.requestCode} thành công`, severity: 'success' })
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Hủy đơn thất bại', severity: 'error' })
    }
  }

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto', py: 3 }}>
        {/* Header Bar */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
              {isLecturer ? 'Danh sách yêu cầu mượn & gia hạn chờ duyệt' : 'Đơn mượn của tôi & Mượn / Trả / Gia hạn'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
              {isLecturer
                ? 'Phê duyệt hoặc từ chối các yêu cầu mượn bổ sung và xin gia hạn thời gian mượn của sinh viên'
                : 'Theo dõi tiến trình đơn mượn, gửi phiếu mượn bổ sung, xin gia hạn và tạo phiếu trả cho Lab'}
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

        {/* ===================== BẢNG 1: ĐƠN MƯỢN CHÍNH HIỆN TẠI & XIN GIA HẠN ===================== */}
        {!isLecturer && (
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
                  Đơn mượn chính hiện tại (Active Borrow Requests)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  GET /api/borrow-requests/my · Hỗ trợ xin gia hạn thời gian mượn trước khi quá hạn
                </Typography>
              </Box>
              <Chip
                label={`${borrowRequests.length} đơn`}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 800, fontSize: 11 }}
              />
            </Box>

            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ ĐƠN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐỀ TÀI / DỰ ÁN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LỚP MÔN HỌC</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {borrowRequests.map((b) => (
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
                      <TableCell>
                        <Chip
                          label={b.status === 'Borrowing' ? 'Đang mượn' : b.status === 'Ready' ? 'Sẵn sàng nhận' : b.status}
                          size="small"
                          sx={{
                            bgcolor: b.status === 'Borrowing' ? '#eff6ff' : '#f0fdf4',
                            color: b.status === 'Borrowing' ? '#0058be' : '#16a34a',
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Nút Xin gia hạn */}
                          {b.status === 'Borrowing' && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<UpdateIcon sx={{ fontSize: 13 }} />}
                              onClick={() => handleOpenExtModal(b)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                                borderColor: '#b45309',
                                color: '#b45309',
                                bgcolor: '#fffbeb',
                                '&:hover': { bgcolor: '#fef3c7' },
                              }}
                            >
                              Xin gia hạn
                            </Button>
                          )}

                          {/* Nút Trả linh kiện */}
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

                          {/* Nút Hủy đơn nếu chưa nhận */}
                          {b.status === 'Ready' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CloseIcon sx={{ fontSize: 13 }} />}
                              onClick={() => handleCancelBorrow(b)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                              }}
                            >
                              Hủy đơn
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
        )}

        {/* ===================== BẢNG 2: DANH SÁCH YÊU CẦU GIA HẠN ===================== */}
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
                Yêu cầu gia hạn đơn mượn (Borrow Extensions)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                GET /api/borrow-extensions · Sinh viên xin gia hạn, giảng viên duyệt/từ chối
              </Typography>
            </Box>
            <Chip
              label={`${extensions.length} yêu cầu`}
              size="small"
              sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
            />
          </Box>

          <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#fafbff' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ ĐƠN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGƯỜI XIN / DỰ ÁN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN CŨ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN MỚI XIN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LÝ DO GIA HẠN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {extensions.map((ext) => (
                  <TableRow key={ext.extensionId} hover>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be' }}>
                      {ext.requestCode}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                        {ext.studentName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                        {ext.projectTitle}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#64748b' }}>
                      {ext.currentDueDate}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>
                      +{ext.requestedDays} ngày ({ext.newDueDate})
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#424754', maxWidth: 280 }}>
                      {ext.reason}
                    </TableCell>
                    <TableCell>
                      {getExtensionStatusChip(ext.status)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      {isLecturer && ext.status === 'Pending' ? (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleApproveExtension(ext)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 11,
                              borderRadius: 1,
                              boxShadow: 'none',
                            }}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleOpenRejectExt(ext)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 11,
                              borderRadius: 1,
                            }}
                          >
                            Từ chối
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {ext.status === 'Approved' ? 'Đã duyệt' : ext.status === 'Rejected' ? 'Đã từ chối' : 'Chờ giảng viên'}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* ===================== BẢNG 3: PHIẾU TRẢ LINH KIỆN (MF5.2) ===================== */}
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

        {/* ===================== BẢNG 4: PHIẾU MƯỢN BỔ SUNG (MF5.1) ===================== */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
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

        {/* ===================== MODAL XIN GIA HẠN ĐƠN MƯỢN ===================== */}
        <Dialog open={extDialogOpen} onClose={() => setExtDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Xin gia hạn đơn mượn: {selectedBorrow?.requestCode}
          </DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
              Gửi yêu cầu gia hạn thời gian mượn linh kiện đến Giảng viên phụ trách lớp. Yêu cầu chỉ được chấp nhận trước khi đơn bị quá hạn.
            </DialogContentText>

            <TextField
              label="Hạn trả hiện tại"
              value={selectedBorrow?.dueDate || ''}
              fullWidth
              disabled
              size="small"
              sx={{ mb: 2 }}
            />

            <TextField
              label="Số ngày muốn gia hạn thêm (Tối đa 14 ngày)"
              type="number"
              value={requestedDays}
              onChange={(e) => setRequestedDays(Math.max(1, Math.min(14, Number(e.target.value))))}
              fullWidth
              size="small"
              inputProps={{ min: 1, max: 14 }}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Lý do xin gia hạn (bắt buộc)"
              value={extReason}
              onChange={(e) => setExtReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Ví dụ: Nhóm cần thêm 1 tuần để hoàn thiện mạch đo cảm biến..."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setExtDialogOpen(false)} disabled={extSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitExtension}
              disabled={extSubmitting}
              sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
            >
              {extSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu gia hạn'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ===================== MODAL TỪ CHỐI GIA HẠN ===================== */}
        <Dialog open={rejectExtDialogOpen} onClose={() => setRejectExtDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Từ chối gia hạn đơn {selectedExt?.requestCode}
          </DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
              Vui lòng nhập lý do từ chối gia hạn. Lý do này sẽ được gửi email thông báo cho sinh viên.
            </DialogContentText>

            <TextField
              label="Lý do từ chối (bắt buộc)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Nhập lý do từ chối cụ thể..."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setRejectExtDialogOpen(false)} disabled={rejectSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmRejectExt}
              disabled={rejectSubmitting}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {rejectSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
            sx={{ borderRadius: 1.5, fontWeight: 600 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Container>
    </PortalLayout>
  )
}
