import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { projectService } from '../../services/projectService'

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function ProjectApprovalDialog({ project, open, onClose, onReviewed }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !project?.projectId) return undefined

    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError('')
      setDetail(null)
      setComment('')
      setRejectReason('')
      try {
        const result = await projectService.getProject(project.projectId)
        if (active) setDetail(result)
      } catch (requestError) {
        if (active) setError(requestError.message || 'Không thể tải chi tiết project.')
      } finally {
        if (active) setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [open, project?.projectId])

  const handleApprove = async () => {
    setBusy(true)
    setError('')
    try {
      await projectService.approveProject(project.projectId, comment.trim())
      onReviewed('Đã duyệt project thành công.')
    } catch (requestError) {
      setError(requestError.message || 'Không thể duyệt project.')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Vui lòng nhập lý do từ chối.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await projectService.rejectProject(project.projectId, rejectReason.trim())
      onReviewed('Đã từ chối project và gửi lý do cho nhóm.')
    } catch (requestError) {
      setError(requestError.message || 'Không thể từ chối project.')
    } finally {
      setBusy(false)
    }
  }

  const borrowRequests = detail?.borrowRequests || []

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Duyệt project: {project?.title || project?.projectTitle || ''}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {detail && (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Thông tin project</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detail.teamName || project?.teamName} · Lớp {detail.classCode || project?.classCode}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {detail.description || 'Chưa có mô tả.'}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    Gửi lúc: {formatDate(detail.submittedAt || project?.submittedAt)}
                  </Typography>
                </Box>

                {borrowRequests.map((request) => (
                  <Alert
                    key={request.borrowRequestId}
                    severity="info"
                    icon={false}
                    sx={{ '& .MuiAlert-message': { width: '100%' } }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {request.purpose || 'Đơn mượn linh kiện'}
                    </Typography>
                    <Typography variant="body2">
                      {request.roomName || request.roomCode || 'Phòng nhận chưa xác định'} · Mượn: {formatDate(request.borrowDate)} · Trả: {formatDate(request.dueDate)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Đơn {request.requestCode} · {request.status}
                    </Typography>
                  </Alert>
                ))}

                <Divider />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Linh kiện mượn kho</Typography>
                  {detail.components?.length ? detail.components.map((item, index) => (
                    <Typography key={`${item.componentId}-${index}`} variant="body2">
                      {item.componentName} ({item.componentCode}) · {item.quantity} {item.unit || ''}
                      {item.note ? ` · ${item.note}` : ''}
                    </Typography>
                  )) : <Typography variant="body2" color="text.secondary">Không có linh kiện mượn kho.</Typography>}
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Món tự mua</Typography>
                  {detail.selfSuppliedItems?.length ? detail.selfSuppliedItems.map((item, index) => (
                    <Typography key={`${item.itemId || item.itemName}-${index}`} variant="body2">
                      {item.itemName} · {item.quantity}{item.note ? ` · ${item.note}` : ''}
                    </Typography>
                  )) : <Typography variant="body2" color="text.secondary">Không có món tự mua.</Typography>}
                </Box>

                <Divider />
                <TextField
                  label="Nhận xét khi duyệt (không bắt buộc)"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  disabled={busy}
                />
                <TextField
                  label="Lý do từ chối (bắt buộc nếu từ chối)"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  disabled={busy}
                  error={Boolean(error) && !rejectReason.trim()}
                />
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy}>Đóng</Button>
        <Button
          color="error"
          variant="outlined"
          onClick={handleReject}
          disabled={loading || !detail || busy}
        >
          {busy ? 'Đang xử lý...' : 'Từ chối'}
        </Button>
        <Button
          variant="contained"
          onClick={handleApprove}
          disabled={loading || !detail || busy}
        >
          {busy ? 'Đang xử lý...' : 'Duyệt'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
