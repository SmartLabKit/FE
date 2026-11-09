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

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function BorrowRequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const isStudent = user?.roleLabel === 'STUDENT' || user?.roles?.some((role) => role.toLowerCase() === 'student')
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
          onClick={() => navigate('/borrow/my-requests')}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
        >
          Đơn mượn của tôi
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
                <Chip label={request.status} color={request.status === 'Cancelled' ? 'default' : 'primary'} />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Người yêu cầu:</strong> {request.requesterName} ({request.studentCode})</Typography>
                <Typography variant="body2"><strong>Phòng nhận:</strong> {request.roomName || request.roomCode || '—'}</Typography>
                <Typography variant="body2"><strong>Ngày gửi:</strong> {formatDate(request.requestDate)}</Typography>
                <Typography variant="body2"><strong>Ngày mượn:</strong> {formatDate(request.borrowDate)}</Typography>
                <Typography variant="body2"><strong>Ngày trả:</strong> {formatDate(request.dueDate)}</Typography>
                <Typography variant="body2"><strong>Mục đích:</strong> {request.purpose || '—'}</Typography>
              </Stack>
              {request.rejectReason && <Alert severity="warning" sx={{ mt: 2 }}>{request.rejectReason}</Alert>}
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Linh kiện trong đơn</Typography>
              {request.items?.length ? (
                <Stack spacing={1.5}>
                  {request.items.map((item, index) => (
                    <Box key={item.borrowItemId || `${item.componentId}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="body2">{item.componentName} ({item.componentCode})</Typography>
                      <Typography variant="body2" fontWeight={700}>{item.quantity} {item.unit || ''} · {item.status}</Typography>
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
