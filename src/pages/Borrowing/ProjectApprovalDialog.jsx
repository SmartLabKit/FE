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
import ProjectStatusChip from '../../components/borrowing/ProjectStatusChip'
import { projectService } from '../../services/projectService'
import { formatVietnamDate } from '../../utils/dateFormatting'

export default function ProjectApprovalDialog({ project, open, onClose, onReviewed }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const rejectValidationMessage = 'Vui lòng nhập lý do từ chối.'

  useEffect(() => {
    if (!open || !project?.projectId) return undefined

    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError('')
      setDetail(null)
      setComment('')
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
    if (!comment.trim()) {
      setError(rejectValidationMessage)
      return
    }
    setBusy(true)
    setError('')
    try {
      await projectService.rejectProject(project.projectId, comment.trim())
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
  const borrowRequest = borrowRequests[0]
  const teamName = detail?.teamName || project?.teamName || 'Nhóm'
  const classCode = detail?.classCode || project?.classCode || '—'
  const submittedAt = detail?.submittedAt || project?.submittedAt
  const borrowDate = borrowRequest?.expectedBorrowDate ||
    detail?.expectedBorrowDate ||
    borrowRequest?.borrowDate ||
    detail?.borrowDate
  const dueDate = borrowRequest?.dueDate || detail?.dueDate
  const submittedDate = formatVietnamDate(submittedAt)
  const borrowedDate = formatVietnamDate(borrowDate)
  const returnedDate = formatVietnamDate(dueDate)
  const combineSubmissionAndBorrowDate = submittedDate !== '—' && submittedDate === borrowedDate
  const timeInfo = combineSubmissionAndBorrowDate
    ? [
      { label: 'Thời gian gửi đề tài / Thời gian mượn LK', value: submittedDate },
      { label: 'Thời gian trả LK', value: returnedDate },
    ]
    : [
      { label: 'Thời gian gửi đề tài', value: submittedDate },
      { label: 'Thời gian mượn LK', value: borrowedDate },
      { label: 'Thời gian trả LK', value: returnedDate },
    ]

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 800, overflowWrap: 'anywhere' }}>
            {isPending ? 'Duyệt đề tài cho' : 'Chi tiết đề tài của'} {teamName} · Lớp {classCode}
          </Typography>
          <ProjectStatusChip status={currentStatus} size="medium" />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && error !== rejectValidationMessage && <Alert severity="error">{error}</Alert>}
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1.5, rowGap: 1 }}>
                  {timeInfo.map((item, index) => (
                    <Box key={item.label} sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75 }}>
                      {index > 0 && (
                        <Typography component="span" variant="body2" sx={{ color: '#94a3b8' }}>
                          ·
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b' }}>
                        {item.label}:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

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
                  <TextField
                    label="Nhận xét (bắt buộc nếu từ chối)"
                    value={comment}
                    onChange={(event) => {
                      setComment(event.target.value)
                      if (error === 'Vui lòng nhập lý do từ chối.') setError('')
                    }}
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={busy}
                    error={error === rejectValidationMessage && !comment.trim()}
                    helperText={error === rejectValidationMessage ? error : ''}
                  />
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
