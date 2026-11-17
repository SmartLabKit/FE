import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Build as BuildIcon, Cancel as CancelIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { borrowService } from '../../services/borrowService'

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function getItemStatusChip(item, requestStatus) {
  const isReturned = Boolean(item.returnedAt) || String(item.status || '').toLowerCase() === 'returned'
  if (isReturned) {
    return <Chip size="small" label="Đã trả" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }} />
  }
  if (['Borrowing', 'Overdue'].includes(requestStatus)) {
    return <Chip size="small" label="Chưa trả" sx={{ bgcolor: '#fffbeb', color: '#b45309', fontWeight: 700, fontSize: 11 }} />
  }
  return <Chip size="small" label={item.status || 'Chưa trả'} sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 11 }} />
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

  // Modal đổi linh kiện bị hỏng (POST /api/borrow-requests/{id}/replace-damaged)
  const [replaceModalOpen, setReplaceModalOpen] = useState(false)
  const [selectedItemForReplace, setSelectedItemForReplace] = useState(null)
  const [damagedQty, setDamagedQty] = useState(1)
  const [replaceReason, setReplaceReason] = useState('')
  const [submittingReplace, setSubmittingReplace] = useState(false)

  const handleOpenReplaceModal = (item) => {
    setSelectedItemForReplace(item)
    setDamagedQty(1)
    setReplaceReason('')
    setReplaceModalOpen(true)
  }

  const handleReplaceDamaged = async (e) => {
    e.preventDefault()
    if (!selectedItemForReplace) return
    setSubmittingReplace(true)
    setError('')
    try {
      await borrowService.replaceDamagedComponent(id, {
        borrowItemId: selectedItemForReplace.borrowItemId || selectedItemForReplace.id,
        damagedQuantity: Number(damagedQty || 1),
        reason: replaceReason.trim() || 'Hỏng trong quá trình thực hành',
      })
      setToast({ open: true, message: 'Đã báo hỏng và tạo yêu cầu linh kiện thay thế thành công!', severity: 'success' })
      setReplaceModalOpen(false)
      const updated = await borrowService.getBorrowRequestById(id)
      setRequest(updated)
    } catch (err) {
      setError(err.message || 'Báo hỏng linh kiện thất bại')
    } finally {
      setSubmittingReplace(false)
    }
  }

  const handleIssueReplacement = async (replacementId) => {
    try {
      await borrowService.issueReplacement(id, { replacementId })
      setToast({ open: true, message: 'Đã giao linh kiện thay thế cho sinh viên!', severity: 'success' })
      const updated = await borrowService.getBorrowRequestById(id)
      setRequest(updated)
    } catch (err) {
      setError(err.message || 'Giao món thay thế thất bại')
    }
  }

  const handleCancelReplacement = async (replacementId) => {
    try {
      await borrowService.cancelReplacement(id, { replacementId, reason: 'Hủy món thay thế' })
      setToast({ open: true, message: 'Đã hủy món thay thế.', severity: 'info' })
      const updated = await borrowService.getBorrowRequestById(id)
      setRequest(updated)
    } catch (err) {
      setError(err.message || 'Hủy món thay thế thất bại')
    }
  }

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
                    <Box key={item.borrowItemId || `${item.componentId}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.componentName} ({item.componentCode})</Typography>
                        <Typography variant="caption" color="text.secondary">Số lượng: {item.quantity} {item.unit || ''}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getItemStatusChip(item, request.status)}
                        {['Borrowing', 'Overdue'].includes(request.status) && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<BuildIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleOpenReplaceModal(item)}
                            sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700 }}
                          >
                            Báo hỏng / Thay thế
                          </Button>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">Đơn chưa có chi tiết linh kiện.</Typography>}
            </Paper>

            {/* Khối Linh kiện thay thế (Replacements) */}
            {Array.isArray(request.replacements) && request.replacements.length > 0 && (
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#182238' }}>Linh kiện thay thế phát sinh</Typography>
                <Stack spacing={1.5}>
                  {request.replacements.map((rep) => (
                    <Box key={rep.replacementId || rep.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', p: 1.5, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {rep.replacementComponentName || rep.componentName || 'Linh kiện thay thế'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Số lượng: {rep.quantity || rep.replacementQuantity || 1} · Trạng thái: <strong>{rep.status || 'Chờ giao'}</strong>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {rep.status !== 'Issued' && rep.status !== 'Cancelled' && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleIssueReplacement(rep.replacementId || rep.id)}
                              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700 }}
                            >
                              Giao cho SV
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleCancelReplacement(rep.replacementId || rep.id)}
                              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700 }}
                            >
                              Hủy
                            </Button>
                          </>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

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

      {/* Modal Báo hỏng linh kiện & Thay thế (POST /api/borrow-requests/{id}/replace-damaged) */}
      <Dialog open={replaceModalOpen} onClose={() => !submittingReplace && setReplaceModalOpen(false)} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={handleReplaceDamaged}>
          <DialogTitle sx={{ fontWeight: 800 }}>Báo hỏng linh kiện & Yêu cầu thay thế</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              Linh kiện: <strong>{selectedItemForReplace?.componentName}</strong> ({selectedItemForReplace?.componentCode})
            </Typography>
            <TextField
              type="number"
              required
              size="small"
              label="Số lượng hỏng"
              inputProps={{ min: 1, max: selectedItemForReplace?.quantity || 100 }}
              value={damagedQty}
              onChange={(e) => setDamagedQty(Math.max(1, Number(e.target.value)))}
            />
            <TextField
              required
              multiline
              minRows={2}
              size="small"
              label="Lý do hỏng / mô tả sự cố"
              placeholder="VD: Cháy mạch trong khi cắm nguồn 12V..."
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReplaceModalOpen(false)} disabled={submittingReplace} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="warning"
              disabled={submittingReplace}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {submittingReplace ? 'Đang gửi...' : 'Xác nhận báo hỏng'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
