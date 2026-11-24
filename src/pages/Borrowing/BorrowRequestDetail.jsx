import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { borrowService } from '../../services/borrowService'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta } from './borrowHelpers'
import { labLabel } from '../../utils/labLabel'

function getItemStatusChip(item, requestStatus) {
  if (item.status === 'Damaged') {
    return <Chip size="small" label="Đã ghi nhận hỏng" sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 11 }} />
  }
  if (item.status === 'Lost') {
    return <Chip size="small" label="Đã ghi nhận mất" sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 11 }} />
  }
  if (item.status === 'Pending' && ['Borrowing', 'Overdue'].includes(requestStatus)) {
    return <Chip size="small" label="Con thay thế, chờ giao" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: 11 }} />
  }
  const isReturned = Boolean(item.returnedAt) || String(item.status || '').toLowerCase() === 'returned'
  if (isReturned) {
    return <Chip size="small" label="Đã trả" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }} />
  }
  if (['Borrowing', 'Overdue'].includes(requestStatus)) {
    return <Chip size="small" label="Chưa trả" sx={{ bgcolor: '#fffbeb', color: '#b45309', fontWeight: 700, fontSize: 11 }} />
  }
  if (item.status === 'Pending' && ['Approved', 'Ready'].includes(requestStatus)) {
    return <Chip size="small" label="Chờ giao" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 11 }} />
  }
  if (item.status === 'Pending' && ['Cancelled', 'Rejected'].includes(requestStatus)) {
    return <Chip size="small" label="Không giao" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 11 }} />
  }
  const meta = getBorrowRequestStatusMeta(item.status)
  return <Chip size="small" label={meta.label} sx={meta.sx} />
}

export default function BorrowRequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const isStudent = user?.roleLabel === 'STUDENT' || user?.roles?.some((role) => role.toLowerCase() === 'student')
  const isStaff = hasRole?.('LabStaff')
  const hasMyRequests = isStudent || hasRole?.('Lecturer')
  const backLabel = isStaff ? 'Đơn mượn tại Lab' : isStudent ? 'Đơn mượn của tôi' : 'Quay lại'
  const goBack = () => {
    if (isStaff) navigate('/borrow/lab-orders')
    else if (hasMyRequests) navigate('/borrow/my-requests')
    else navigate(-1)
  }
  const canCancel = isStudent && ['Approved', 'Ready'].includes(request?.status)

  useEffect(() => {
    let active = true
    borrowService.getBorrowRequestById(id)
      .then((result) => {
        if (active) setRequest(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Không thể tải chi tiết đơn mượn.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const result = await borrowService.cancelBorrowRequest(id, {})
      setRequest(result)
      setToast({ open: true, message: 'Đã hủy đơn mượn và hoàn trả hàng đã giữ về kho.', severity: 'success' })
    } catch (requestError) {
      setError(requestError.message || 'Không thể hủy đơn mượn.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <PortalLayout headerTitle="Chi tiết đơn mượn" headerSubtitle={request?.requestCode || 'Đơn mượn của tôi'}>
      <Container maxWidth="md" disableGutters sx={{ py: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={goBack}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {backLabel}
        </Button>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : error && !request ? (
          <Alert severity="error">{error}</Alert>
        ) : request && (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{request.requestCode}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {request.projectTitle} · {request.classCode}
                  </Typography>
                </Box>
                {(() => {
                  const meta = getBorrowRequestStatusMeta(request.status)
                  return <Chip label={meta.label} sx={meta.sx} />
                })()}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Người yêu cầu:</strong> {request.requesterName} ({request.studentCode})</Typography>
                <Typography variant="body2"><strong>Phòng nhận:</strong> {labLabel(request)}</Typography>
                <Typography variant="body2"><strong>Ngày gửi:</strong> {formatVietnamDateTime(request.requestDate)}</Typography>
                <Typography variant="body2"><strong>Ngày mượn:</strong> {formatVietnamDate(request.borrowDate)}</Typography>
                <Typography variant="body2"><strong>Ngày trả:</strong> {formatVietnamDate(request.dueDate)}</Typography>
                <Typography variant="body2"><strong>Mục đích:</strong> {request.purpose || '—'}</Typography>
              </Stack>
              {request.rejectReason && <Alert severity="warning" sx={{ mt: 2 }}>{request.rejectReason}</Alert>}
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Linh kiện trong đơn</Typography>
              {request.items?.length ? (
                <Stack spacing={1.5}>
                  {request.items.map((item, index) => (
                    <Box key={item.borrowItemId || `${item.componentId}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.componentName} ({item.componentCode})</Typography>
                        <Typography variant="caption" color="text.secondary">Số lượng: {item.quantity} {item.unit || ''}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getItemStatusChip(item, request.status)}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">Đơn chưa có chi tiết linh kiện.</Typography>}
            </Paper>

            {canCancel && (
              <Alert
                severity="warning"
                action={
                  <Button
                    color="error"
                    startIcon={cancelling ? <CircularProgress size={16} /> : <CancelIcon />}
                    disabled={cancelling}
                    onClick={handleCancel}
                  >
                    {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                  </Button>
                }
              >
                Bạn có thể hủy đơn đã duyệt trước khi Lab giao linh kiện.
              </Alert>
            )}
          </Stack>
        )}
      </Container>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((current) => ({ ...current, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
