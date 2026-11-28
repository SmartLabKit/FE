import { useEffect, useMemo, useState } from 'react'
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
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import ProjectStatusChip from '../../components/borrowing/ProjectStatusChip'
import { projectService } from '../../services/projectService'
import { borrowService } from '../../services/borrowService'
import { issueReportService } from '../../services/issueReportService'
import { formatDateTime, issueStatusOf, issueTypeLabel } from '../IssueReports/issueReportLabels'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta, getShownPurpose, isSupplementaryPurpose } from './borrowHelpers'
import { labCode, labName } from '../../utils/labLabel'
import { trackingTypeLabel } from '../../utils/trackingTypeLabel'

const COMMENT_MAX_LENGTH = 255

export default function ProjectApprovalDialog({ project, open, onClose, onReviewed }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [pendingBorrowDetail, setPendingBorrowDetail] = useState(null)
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [approvedQty, setApprovedQty] = useState({})
  const [showHistory, setShowHistory] = useState(false)
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
      setPendingBorrowDetail(null)
      setIssues([])
      setComment('')
      setApprovedQty({})
      setShowHistory(false)
      try {
        const result = await projectService.getProject(project.projectId)
        if (!active) return
        setDetail(result)

        issueReportService
          .getIssueReports({ projectId: project.projectId, page: 1, size: 50 })
          .then((data) => {
            if (active) setIssues(Array.isArray(data) ? data : data?.items || [])
          })
          .catch(() => {})

        // GV duyệt một lần cho mọi đơn lab đang chờ: gộp linh kiện của các đơn đó, mỗi dòng ghi lab
        const borrows = Array.isArray(result?.borrowRequests) ? result.borrowRequests : []
        const pendingBrs = borrows.filter((br) => br.status === 'Pending')

        if (pendingBrs.length > 0) {
          try {
            const details = await Promise.all(pendingBrs.map((br) => borrowService.getBorrowRequestById(br.borrowRequestId)))
            const items = details.flatMap((d) => (d?.items || []).map((item) => ({ ...item, roomCode: d?.roomCode || '' })))
            const roomCode = details.map((d) => d?.roomCode).filter(Boolean).join(', ')
            if (active) setPendingBorrowDetail({ ...details[0], items, roomCode })
          } catch {
            // Không chặn hiển thị chi tiết project nếu không lấy được chi tiết đơn
          }
        }
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

  const borrowRequests = Array.isArray(detail?.borrowRequests) ? detail.borrowRequests : []
  const currentStatus = detail?.status || project?.status || ''
  const pendingRequests = borrowRequests.filter((br) => br.status === 'Pending')
  // Chỉ hiện đơn hiện tại; đơn bị từ chối hoặc đã hủy nằm trong phần lịch sử
  const historyRequests = borrowRequests.filter((br) => ['Rejected', 'Cancelled'].includes(br.status))
  // Đơn đang chờ duyệt đã hiện ở phần duyệt phía trên nên không lặp lại trong danh sách
  const currentRequests = borrowRequests.filter((br) => !['Rejected', 'Cancelled', 'Pending'].includes(br.status))
  const shownRequests = showHistory ? currentRequests.concat(historyRequests) : currentRequests
  const pendingBorrowRequest = pendingRequests[0] || null
  const pendingLab = pendingBorrowDetail?.roomCode || project?.pendingRoomCode || ''
  const pendingCount = pendingRequests.length
  const isProjectPending = ['Submitted', 'Pending', 'PendingApproval', 'PendingLecturer'].includes(currentStatus)
  const isSupplementaryPending =
    currentStatus === 'Approved' && (Boolean(pendingBorrowRequest) || Boolean(project?.isSupplementary))
  const canReview = isProjectPending || isSupplementaryPending || Boolean(project?.hasPendingApproval)

  const reviewLines = useMemo(() => {
    const source = pendingBorrowDetail?.items?.length
      ? pendingBorrowDetail.items
      : isSupplementaryPending
        ? []
        : detail?.components || []
    const byComponent = new Map()
    source.forEach((item) => {
      if (!item?.componentId) return
      const current = byComponent.get(item.componentId)
      if (current) current.quantity += Number(item.quantity) || 0
      else byComponent.set(item.componentId, { componentId: item.componentId, componentName: item.componentName, unit: item.unit, roomCode: item.roomCode || '', quantity: Number(item.quantity) || 0 })
    })
    return [...byComponent.values()]
  }, [isSupplementaryPending, pendingBorrowDetail, detail])

  const adjustments = reviewLines
    .filter((line) => approvedQty[line.componentId] !== undefined && approvedQty[line.componentId] !== '' && Number(approvedQty[line.componentId]) < line.quantity)
    .map((line) => ({ componentId: line.componentId, quantity: Number(approvedQty[line.componentId]) }))

  const handleApprove = async () => {
    const invalid = reviewLines.some((line) => {
      const value = approvedQty[line.componentId]
      return value !== undefined && (value === '' || Number(value) < 0 || Number(value) > line.quantity)
    })
    if (invalid) {
      setError('Số lượng duyệt phải từ 0 đến số lượng xin mượn.')
      return
    }
    if (adjustments.length > 0 && !comment.trim()) {
      setError('Đã giảm số lượng thì phải ghi lý do cho nhóm ở ô nhận xét.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await projectService.approveProject(project.projectId, comment.trim(), adjustments)
      const countText = pendingCount > 1 ? `${pendingCount} đơn` : 'đơn'
      const labText = pendingLab ? ` (${pendingLab})` : ''
      onReviewed(
        isSupplementaryPending
          ? `Đã duyệt ${countText} mượn thêm${labText}.`
          : `Đã duyệt ${countText} mượn${labText}.`
      )
    } catch (requestError) {
      setError(requestError.message || 'Không thể duyệt yêu cầu.')
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
      onReviewed(
        isSupplementaryPending
          ? 'Đã từ chối đơn mượn thêm và gửi lý do cho nhóm (đề tài vẫn giữ trạng thái Đã duyệt).'
          : 'Đã từ chối project và gửi lý do cho nhóm.'
      )
    } catch (requestError) {
      setError(requestError.message || 'Không thể từ chối yêu cầu.')
    } finally {
      setBusy(false)
    }
  }

  const borrowRequest = pendingBorrowRequest || borrowRequests[0]
  const teamName = detail?.teamName || project?.teamName || 'Nhóm'
  const classCode = detail?.classCode || project?.classCode || '—'
  const submittedAt = detail?.submittedAt || project?.submittedAt
  const dueDate = borrowRequest?.dueDate || detail?.dueDate
  const submittedDate = formatVietnamDate(submittedAt)
  const returnedDate = formatVietnamDate(dueDate)
  const timeInfo = [
    { label: 'Thời gian gửi đề tài', value: submittedDate },
    { label: 'Hạn trả LK', value: returnedDate },
  ]

  const supplementaryReason =
    pendingBorrowDetail?.purpose ||
    pendingBorrowRequest?.purpose ||
    project?.pendingPurpose ||
    ''

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 800, overflowWrap: 'anywhere' }}>
            {isSupplementaryPending
              ? `Duyệt đơn mượn thêm · ${teamName} · Lớp ${classCode}`
              : isProjectPending
                ? `Duyệt đề tài cho ${teamName} · Lớp ${classCode}`
                : `Chi tiết đề tài của ${teamName} · Lớp ${classCode}`}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {isSupplementaryPending && (
              <Chip
                label="Mượn thêm · Chờ GV duyệt"
                size="small"
                sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 12 }}
              />
            )}
            <ProjectStatusChip status={currentStatus} size="medium" />
          </Stack>
        </Stack>
        {canReview && pendingLab && (
          <Typography variant="body2" sx={{ mt: 0.5, color: '#475569' }}>
            {pendingCount > 1
              ? `Đề tài có ${pendingCount} đơn: ${pendingRequests.map((br) => `${br.requestCode} · ${labCode(br, '')}`).join(', ')} · duyệt một lần cho tất cả`
              : `Đơn ${pendingBorrowRequest?.requestCode || project?.pendingRequestCode || ''} · ${pendingLab}`}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.25}>
            {error && error !== rejectValidationMessage && <Alert severity="error">{error}</Alert>}

            {detail && (
              <>
                {/* Khối nổi bật khi có ĐƠN MƯỢN THÊM CHỜ DUYỆT */}
                {isSupplementaryPending && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid #fcd34d',
                      bgcolor: '#fffbeb',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400e' }}>
                        Đơn mượn thêm đang chờ giảng viên duyệt:{' '}
                        {pendingBorrowRequest?.requestCode || project?.pendingRequestCode || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700 }}>
                        Hạn trả: {formatVietnamDate(pendingBorrowRequest?.dueDate || pendingBorrowDetail?.dueDate)}
                      </Typography>
                    </Stack>

                    {supplementaryReason && (
                      <Typography variant="body2" sx={{ color: '#78350f', mb: 1.5, lineHeight: 1.6 }}>
                        <strong>Lý do mượn thêm:</strong> {supplementaryReason}
                      </Typography>
                    )}

                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#92400e', display: 'block', mb: 0.75 }}>
                      LINH KIỆN XIN MƯỢN THÊM ({pendingBorrowDetail?.items?.length || 0})
                    </Typography>
                    {pendingBorrowDetail?.items?.length ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {pendingBorrowDetail.items.map((item, idx) => (
                          <Tooltip
                            key={item.borrowItemId || `${item.componentId}-${idx}`}
                            title={`${item.componentCode || ''} · ${trackingTypeLabel(item.trackingType)}`}
                          >
                            <Chip
                              label={`${item.componentName} ×${item.quantity} ${item.unit || ''}`.trim()}
                              size="small"
                              sx={{ bgcolor: '#ffffff', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: '#92400e' }}>
                        Bấm vào chi tiết đơn bên dưới để xem danh sách linh kiện cụ thể.
                      </Typography>
                    )}
                  </Paper>
                )}

                {/* Thông tin đề tài */}
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

                {/* Linh kiện đã khai báo trên đề tài */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    Linh kiện mượn kho của đề tài ({detail.components?.length || 0})
                  </Typography>
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
                  ) : (
                    <Typography variant="body2" color="text.secondary">Không có linh kiện mượn kho.</Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    Món tự mua ({detail.selfSuppliedItems?.length || 0})
                  </Typography>
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
                  ) : (
                    <Typography variant="body2" color="text.secondary">Không có món tự mua.</Typography>
                  )}
                </Box>

                {/* Danh sách ĐƠN MƯỢN của đề tài; đề tài chỉ có đồ tự chuẩn bị (không đơn nào) thì ẩn cả mục */}
                {currentRequests.length + historyRequests.length > 0 && (
                <>
                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
                    Đơn mượn của đề tài ({currentRequests.length})
                  </Typography>
                  {shownRequests.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {historyRequests.length > 0 ? 'Chưa có đơn nào đã được duyệt.' : 'Chưa có đơn mượn nào được tạo từ đề tài này.'}
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {shownRequests.map((br) => {
                        const meta = getBorrowRequestStatusMeta(br.status)
                        return (
                          <Paper
                            key={br.borrowRequestId}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              borderColor: br.status === 'Pending' ? '#fcd34d' : '#e2e8f0',
                              bgcolor: br.status === 'Pending' ? '#fffbeb' : '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 1.25,
                            }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be' }}>
                                  #{br.requestCode || '—'}
                                </Typography>
                                {isSupplementaryPurpose(br.purpose) && (
                                  <Chip label="Mượn thêm" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 }} />
                                )}
                                <Chip label={meta.label} size="small" sx={meta.sx} />
                                {labCode(br, '') && (
                                  <Typography variant="caption" title={labName(br)} sx={{ color: '#64748b' }}>
                                    · {labCode(br)}
                                  </Typography>
                                )}
                              </Stack>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.35 }}>
                                Hạn trả: <strong>{br.dueDate ? formatVietnamDate(br.dueDate) : '—'}</strong>
                                {getShownPurpose(br.purpose) ? ` · ${getShownPurpose(br.purpose)}` : ''}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: 13 }} />}
                              onClick={() => {
                                onClose()
                                navigate(`/borrow/requests/${br.borrowRequestId}`)
                              }}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 1.25 }}
                            >
                              Chi tiết đơn
                            </Button>
                          </Paper>
                        )
                      })}
                    </Stack>
                  )}
                  {historyRequests.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => setShowHistory((value) => !value)}
                      sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                    >
                      {showHistory ? 'Ẩn lịch sử đơn' : `Xem lịch sử: ${historyRequests.length} đơn bị từ chối hoặc đã hủy`}
                    </Button>
                  )}
                </Box>
                </>
                )}

                {issues.length > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
                        Sự cố linh kiện ({issues.length})
                      </Typography>
                      <Stack spacing={1}>
                        {issues.map((issue) => {
                          const status = issueStatusOf(issue.status)
                          return (
                            <Paper
                              key={issue.issueReportId}
                              variant="outlined"
                              sx={{ p: 1.25, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {issue.componentName || '—'} · {issue.itemCode || '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {issueTypeLabel(issue.issueType)} · {formatDateTime(issue.createdAt)}
                                  {issue.description ? ` · ${issue.description}` : ''}
                                </Typography>
                              </Box>
                              <Chip size="small" color={status.color} label={status.label} />
                            </Paper>
                          )
                        })}
                      </Stack>
                    </Box>
                  </>
                )}

                <Divider />

                {canReview && reviewLines.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                      Số lượng duyệt
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Chỉ giảm được (0 = bỏ linh kiện khỏi đơn). Muốn tăng thì trả về để nhóm gửi lại. Có giảm thì phải ghi lý do.
                    </Typography>
                    <Stack spacing={1}>
                      {reviewLines.map((line) => (
                        <Box key={line.componentId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ flex: '1 1 220px', fontWeight: 600 }}>
                            {line.componentName}
                            {pendingCount > 1 && line.roomCode && (
                              <Typography component="span" variant="caption" sx={{ color: '#64748b', ml: 0.75 }}>
                                · {line.roomCode}
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>
                            Xin mượn: {line.quantity} {line.unit || ''}
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            label="Duyệt"
                            value={approvedQty[line.componentId] ?? line.quantity}
                            onChange={(event) => setApprovedQty((current) => ({ ...current, [line.componentId]: event.target.value }))}
                            disabled={busy}
                            slotProps={{ htmlInput: { min: 0, max: line.quantity, step: 1 } }}
                            sx={{ width: 110 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Khối nhận xét / trạng thái phê duyệt */}
                {canReview ? (
                  <TextField
                    label={
                      isSupplementaryPending
                        ? 'Nhận xét duyệt đơn mượn thêm (bắt buộc nếu từ chối hoặc giảm số lượng)'
                        : 'Nhận xét (bắt buộc nếu từ chối hoặc giảm số lượng)'
                    }
                    value={comment}
                    onChange={(event) => {
                      setComment(event.target.value.slice(0, COMMENT_MAX_LENGTH))
                      if (error === rejectValidationMessage) setError('')
                    }}
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={busy}
                    error={error === rejectValidationMessage && !comment.trim()}
                    helperText={
                      error === rejectValidationMessage
                        ? error
                        : `${comment.length}/${COMMENT_MAX_LENGTH} ký tự`
                    }
                    slotProps={{ htmlInput: { maxLength: COMMENT_MAX_LENGTH } }}
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
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          Đóng
        </Button>
        {canReview && (
          <>
            <Button
              color="error"
              variant="outlined"
              onClick={handleReject}
              disabled={loading || !detail || busy}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {busy ? 'Đang xử lý...' : 'Từ chối'}
            </Button>
            <Button
              variant="contained"
              onClick={handleApprove}
              disabled={loading || !detail || busy}
              sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#15803d' } }}
            >
              {busy ? 'Đang xử lý...' : isSupplementaryPending ? 'Duyệt đơn mượn thêm' : 'Duyệt'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
