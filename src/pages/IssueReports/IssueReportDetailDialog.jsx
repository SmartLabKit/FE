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
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../../context/AuthContext'
import { issueReportService } from '../../services/issueReportService'
import { formatDateTime, issueStatusOf, issueTypeLabel } from './issueReportLabels'

function InfoRow({ label, children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: { xs: 0, sm: 1.5 }, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{children || '—'}</Typography>
    </Box>
  )
}

/**
 * Chi tiết 1 báo cáo sự cố: thông tin thiết bị, đơn mượn liên quan, ảnh minh chứng.
 * Báo cáo còn Open (do quản lý kho gửi) thì:
 * - LabStaff / Admin xác nhận hoặc từ chối (BE kiểm tra LabStaff phải phụ trách đúng lab).
 * - Người tạo hoặc Admin hủy báo cáo.
 */
export default function IssueReportDetailDialog({ issueReportId, onClose, onChanged }) {
  const { user, hasRole, hasPermission } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [acting, setActing] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      setNote('')
      try {
        const data = await issueReportService.getIssueReport(issueReportId)
        if (active) setDetail(data)
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [issueReportId])

  const isAdmin = hasRole?.('Admin')
  const isOpen = detail?.status === 'Open'
  const canResolve = isOpen && (isAdmin || (hasRole?.('LabStaff') && hasPermission('ISSUE_RESOLVE')))
  const canCancel = isOpen && (isAdmin || String(detail?.reportedById) === String(user?.userId))
  const status = issueStatusOf(detail?.status)
  const item = detail?.item
  const borrow = detail?.borrowContext

  const runAction = async (kind) => {
    setPendingAction('')
    setActing(kind)
    setError('')
    try {
      const updated = kind === 'cancel'
        ? await issueReportService.cancelIssueReport(detail.issueReportId)
        : await issueReportService.resolveIssueReport(detail.issueReportId, { result: kind, note })
      setDetail(updated)
      onChanged(kind)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setActing('')
    }
  }

  return (
    <Dialog open onClose={() => !acting && onClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        Chi tiết sự cố
        {detail && <Chip size="small" color={status.color} label={status.label} sx={{ fontWeight: 700 }} />}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
        ) : detail && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: detail.imageUrl ? '1fr 280px' : '1fr' }, gap: 3 }}>
            <Box>
              <InfoRow label="Loại sự cố">{issueTypeLabel(detail.issueType)}</InfoRow>
              <InfoRow label="Mô tả">{detail.description}</InfoRow>
              <InfoRow label="Người ghi nhận">{detail.reportedBy?.fullName}</InfoRow>
              <InfoRow label="Thời gian">{formatDateTime(detail.createdAt)}</InfoRow>
              {/* Lab staff ghi nhận là xác nhận luôn: chỉ hiện người xử lý khi là người khác */}
              {detail.resolvedAt && detail.resolvedBy?.userId !== detail.reportedBy?.userId && (
                <InfoRow label="Xử lý bởi">{detail.resolvedBy?.fullName} · {formatDateTime(detail.resolvedAt)}</InfoRow>
              )}

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Thiết bị</Typography>
              <InfoRow label="Mã thiết bị">{detail.itemCode || item?.itemCode}</InfoRow>
              <InfoRow label="Linh kiện">{detail.componentName}</InfoRow>
              <InfoRow label="Serial">{item?.serialNumber}</InfoRow>

              {borrow && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Đơn mượn liên quan</Typography>
                  <InfoRow label="Mã đơn">{borrow.borrowRequestCode}</InfoRow>
                  <InfoRow label="Người mượn">{[borrow.requesterFullName, borrow.requesterStudentCode].filter(Boolean).join(' · ')}</InfoRow>
                  <InfoRow label="Lớp">{borrow.classCode}</InfoRow>
                  <InfoRow label="Ngày giao">{formatDateTime(borrow.issuedAt)}</InfoRow>
                </>
              )}

              {canResolve && (
                <TextField
                  label="Ghi chú xử lý (không bắt buộc)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{ mt: 2 }}
                />
              )}
            </Box>

            {detail.imageUrl && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Ảnh minh chứng</Typography>
                <Link href={detail.imageUrl} target="_blank" rel="noopener noreferrer">
                  <Box
                    component="img"
                    src={detail.imageUrl}
                    alt="Ảnh minh chứng sự cố"
                    sx={{ width: '100%', borderRadius: 1.5, border: '1px solid #e2e8f0', objectFit: 'cover' }}
                  />
                </Link>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {canCancel && (
          <Button color="inherit" onClick={() => setPendingAction('cancel')} disabled={Boolean(acting)} sx={{ mr: 'auto', textTransform: 'none' }}>
            {acting === 'cancel' ? 'Đang hủy...' : 'Hủy báo cáo'}
          </Button>
        )}
        <Button onClick={onClose} disabled={Boolean(acting)}>Đóng</Button>
        {canResolve && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setPendingAction('Rejected')}
              disabled={Boolean(acting)}
              startIcon={acting === 'Rejected' ? <CircularProgress size={14} /> : null}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Từ chối
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => setPendingAction('Confirmed')}
              disabled={Boolean(acting)}
              startIcon={acting === 'Confirmed' ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Xác nhận sự cố
            </Button>
          </Stack>
        )}
      </DialogActions>
      <Dialog open={Boolean(pendingAction)} onClose={() => setPendingAction('')} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {pendingAction === 'Confirmed' && 'Xác nhận sự cố?'}
          {pendingAction === 'Rejected' && 'Từ chối báo cáo?'}
          {pendingAction === 'cancel' && 'Hủy báo cáo?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {pendingAction === 'Confirmed' &&
              `Thiết bị ${detail?.itemCode || item?.itemCode || ''} sẽ chuyển sang ${detail?.issueType === 'Lost' ? 'Thất lạc' : 'Thanh lý'} và không cho mượn được nữa. Không hoàn tác được.`}
            {pendingAction === 'Rejected' && 'Báo cáo bị từ chối, thiết bị giữ nguyên trạng thái.'}
            {pendingAction === 'cancel' && 'Báo cáo sẽ bị hủy, thiết bị giữ nguyên trạng thái.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingAction('')}>Đóng</Button>
          <Button
            variant="contained"
            color={pendingAction === 'Confirmed' ? 'success' : 'error'}
            onClick={() => runAction(pendingAction)}
          >
            {pendingAction === 'Confirmed' ? 'Xác nhận sự cố' : pendingAction === 'Rejected' ? 'Từ chối' : 'Hủy báo cáo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
