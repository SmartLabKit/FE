import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { projectService } from '../../services/projectService'

function formatDate(value) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const projectStatusStyles = {
  Draft: { label: 'Bản nháp', bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', dotColor: '#64748b' },
  Submitted: { label: 'Chờ duyệt', bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
  Pending: { label: 'Chờ duyệt', bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
  PendingApproval: { label: 'Chờ duyệt', bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
  PendingLecturer: { label: 'Chờ duyệt', bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
  Approved: { label: 'Đã duyệt', bgcolor: '#ecfdf5', color: '#047857', borderColor: '#6ee7b7', dotColor: '#10b981' },
  Rejected: { label: 'Bị từ chối', bgcolor: '#fff1f2', color: '#be123c', borderColor: '#fda4af', dotColor: '#e11d48' },
  Cancelled: { label: 'Đã hủy', bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', dotColor: '#64748b' },
}

function ProjectStatusBadge({ status }) {
  const style = projectStatusStyles[status] || {
    label: status || 'Chưa xác định',
    bgcolor: '#f1f5f9',
    color: '#475569',
    borderColor: '#cbd5e1',
    dotColor: '#64748b',
  }

  return (
    <Chip
      icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.dotColor }} />}
      label={style.label}
      sx={{
        height: 32,
        px: 0.5,
        borderRadius: '999px',
        border: `1px solid ${style.borderColor}`,
        bgcolor: style.bgcolor,
        color: style.color,
        fontSize: 13,
        fontWeight: 700,
        '& .MuiChip-label': { px: 1.25 },
        '& .MuiChip-icon': { ml: 1, mr: -0.5 },
      }}
    />
  )
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
  const currentStatus = detail?.status || project?.status || ''
  const isPending = ['Submitted', 'Pending', 'PendingApproval', 'PendingLecturer'].includes(currentStatus)

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b' }}>
              {isPending ? 'Duyệt project' : 'Chi tiết project'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {detail?.title || project?.title || project?.projectTitle || ''}
            </Typography>
          </Box>
          <ProjectStatusBadge status={currentStatus} />
        </Stack>
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
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '120px minmax(0, 1fr)' },
                    columnGap: 2,
                    rowGap: 1.5,
                    alignItems: 'start',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b' }}>Tên project</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a' }}>
                    {detail.title || project?.title || project?.projectTitle || '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b' }}>Mô tả</Typography>
                  <Typography variant="body2" sx={{ color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {detail.description || 'Chưa có mô tả.'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {detail.teamName || project?.teamName} · Lớp {detail.classCode || project?.classCode}
                  {' · '}Gửi lúc: {formatDate(detail.submittedAt || project?.submittedAt)}
                </Typography>

                {borrowRequests.map((request) => (
                  <Alert
                    key={request.borrowRequestId}
                    severity="info"
                    icon={false}
                    sx={{ '& .MuiAlert-message': { width: '100%' } }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {request.purpose || 'Đơn mượn linh kiện'}
                      </Typography>
                      <ProjectStatusBadge status={request.status || currentStatus} />
                    </Stack>
                    <Typography variant="body2">
                      {request.roomName || request.roomCode || 'Phòng nhận chưa xác định'} · Mượn: {formatDate(request.expectedBorrowDate || request.borrowDate)} · Trả: {formatDate(request.dueDate)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Đơn {request.requestCode}
                    </Typography>
                  </Alert>
                ))}

                <Divider />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Linh kiện mượn kho</Typography>
                  {detail.components?.length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {detail.components.map((item, index) => (
                        <Tooltip
                          key={`${item.componentId}-${index}`}
                          title={[item.componentCode, item.note].filter(Boolean).join(' · ') || ' '}
                        >
                          <Chip
                            label={`${item.componentName} ×${item.quantity}`}
                            sx={{ bgcolor: '#f1f5f9', color: '#1e293b', border: 0, fontWeight: 600 }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  ) : <Typography variant="body2" color="text.secondary">Không có linh kiện mượn kho.</Typography>}
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Món tự mua</Typography>
                  {detail.selfSuppliedItems?.length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {detail.selfSuppliedItems.map((item, index) => (
                        <Tooltip
                          key={`${item.itemId || item.itemName}-${index}`}
                          title={item.note || ' '}
                        >
                          <Chip
                            label={`${item.itemName} ×${item.quantity}`}
                            sx={{ bgcolor: '#f1f5f9', color: '#1e293b', border: 0, fontWeight: 600 }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  ) : <Typography variant="body2" color="text.secondary">Không có món tự mua.</Typography>}
                </Box>

                <Divider />
                {isPending ? (
                  <>
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
                ) : (
                  <>
                    {detail.status === 'Approved' && (
                      <Alert severity="success">
                        <strong>Dự án đã được phê duyệt.</strong>
                        {detail.reviewComment ? ` Nhận xét: ${detail.reviewComment}` : ''}
                      </Alert>
                    )}
                    {detail.status === 'Rejected' && (
                      <Alert severity="error">
                        <strong>Dự án đã bị từ chối.</strong>
                        {detail.reviewComment ? ` Lý do: ${detail.reviewComment}` : ''}
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy}>Đóng</Button>
        {isPending && (
          <>
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
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
