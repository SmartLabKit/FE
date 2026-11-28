import { useEffect, useState, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import {
  CheckCircle as ApproveIcon,
  ChevronRight as ChevronRightIcon,
  OpenInNew as OpenIcon,
  Replay as ReturnIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { academicService } from '../../services/academicService'
import { projectService } from '../../services/projectService'

const PAGE_SIZE = 10

const SUBMISSION_LINKS = [
  { key: 'reportUrl', label: 'Báo cáo PDF' },
  { key: 'githubUrl', label: 'GitHub' },
  { key: 'slideUrl', label: 'Slide thuyết trình' },
  { key: 'demoVideoUrl', label: 'Video demo' },
  { key: 'sourceCodeUrl', label: 'Mã nguồn ZIP' },
]

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

/**
 * Giảng viên xem các bài nộp cuối kỳ đang chờ xác nhận của lớp mình: danh sách chỉ có đề tài, bấm vào thì mở chi tiết
 * (file, link, nhận xét) để xác nhận (nhận xét không bắt buộc) hoặc trả bài (bắt buộc nhận xét). Admin thấy tất cả nhưng chỉ xem: chỉ giảng viên của lớp được chấm bài.
 */
export default function FinalSubmissionReview() {
  const { hasRole } = useAuth()
  const isLecturer = hasRole?.('Lecturer')

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Dữ liệu đổi ở nơi khác thì tự tải lại
  const bumpReload = useCallback(() => setReloadKey((key) => key + 1), [])
  useEntityChanged(bumpReload)

  const [dialog, setDialog] = useState(null)
  const [comment, setComment] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    let active = true
    const loadClasses = isLecturer ? academicService.getMyClasses() : academicService.getClasses()
    loadClasses
      .then((data) => { if (active) setClasses(Array.isArray(data) ? data : data?.items || []) })
      .catch(() => { if (active) setClasses([]) })
    return () => { active = false }
  }, [isLecturer])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await projectService.getFinalSubmissions({
          search: search || undefined,
          classId: classId || undefined,
          page,
          size: PAGE_SIZE,
        })
        if (active) setResult(data)
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
  }, [search, classId, page, reloadKey])

  const items = Array.isArray(result) ? result : result?.items || []

  const openDetail = (submission) => {
    setDialog({ submission })
    setComment('')
  }

  const decide = async (type) => {
    const { submission } = dialog
    setDeciding(true)
    try {
      if (type === 'approve') {
        await projectService.approveFinal(submission.projectId, comment)
      } else {
        await projectService.rejectFinal(submission.projectId, comment)
      }
      setDialog(null)
      setToast({
        open: true,
        severity: 'success',
        message: type === 'approve' ? `Đã xác nhận bài nộp "${submission.title}".` : `Đã trả bài "${submission.title}" cho nhóm.`,
      })
      setReloadKey((key) => key + 1)
    } catch (decideError) {
      setToast({ open: true, severity: 'error', message: decideError.message })
    } finally {
      setDeciding(false)
    }
  }

  return (
    <PortalLayout headerTitle="Duyệt nộp cuối kỳ" headerSubtitle="Bài nộp cuối kỳ đang chờ xác nhận, nộp sớm nhất lên trước">
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {!isLecturer && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Chỉ giảng viên của lớp được xác nhận hoặc trả bài. Bạn đang xem ở chế độ theo dõi.
          </Alert>
        )}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: '#d8dced', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput.trim())
              setPage(1)
            }}
            sx={{ flexGrow: 1, minWidth: 240 }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Tìm theo tên project, tên nhóm... (Enter để tìm)"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <TextField
            select
            size="small"
            label="Lớp"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value)
              setPage(1)
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả lớp</MenuItem>
            {classes.map((classItem) => (
              <MenuItem key={classItem.classId} value={classItem.classId}>
                {classItem.classCode}{classItem.courseName ? ` · ${classItem.courseName}` : ''}
              </MenuItem>
            ))}
          </TextField>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
        ) : items.length === 0 ? (
          <Paper variant="outlined" sx={{ py: 6, borderColor: '#d8dced', textAlign: 'center' }}>
            <Typography color="text.secondary">Không có bài nộp nào đang chờ xác nhận.</Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ borderColor: '#d8dced', borderRadius: 2.5, overflow: 'hidden' }}>
            {items.map((submission) => (
              <Box
                key={submission.projectId}
                onClick={() => openDetail(submission)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2.5,
                  py: 1.75,
                  cursor: 'pointer',
                  borderBottom: '1px solid #eef0f5',
                  '&:last-of-type': { borderBottom: 0 },
                  '&:hover': { bgcolor: '#f8fafc' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: '#131b2e' }} noWrap>{submission.title}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {submission.teamName || '—'} · {submission.classCode || '—'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  Nộp {formatDateTime(submission.finalSubmittedAt)}
                </Typography>
                <ChevronRightIcon sx={{ color: '#cbd5e1' }} />
              </Box>
            ))}
          </Paper>
        )}

        <TablePagination
          component="div"
          count={result?.totalCount || 0}
          page={page - 1}
          onPageChange={(_, nextPage) => setPage(nextPage + 1)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </Box>

      <Dialog
        open={Boolean(dialog)}
        onClose={() => !deciding && setDialog(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{dialog?.submission.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {dialog?.submission.teamName || '—'} · Lớp {dialog?.submission.classCode || '—'}
            {dialog?.submission.leaderName ? ` · Trưởng nhóm ${dialog.submission.leaderName}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Nộp lúc {formatDateTime(dialog?.submission.finalSubmittedAt)}
          </Typography>

          <Paper variant="outlined" sx={{ mt: 2, borderColor: '#e4e6ef', borderRadius: 2, overflow: 'hidden' }}>
            {SUBMISSION_LINKS.map(({ key, label }) => {
              const url = dialog?.submission[key]
              return (
                <Box
                  key={key}
                  component={url ? Link : 'div'}
                  href={url || undefined}
                  target={url ? '_blank' : undefined}
                  rel={url ? 'noopener noreferrer' : undefined}
                  underline="none"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderBottom: '1px solid #eef0f5',
                    '&:last-of-type': { borderBottom: 0 },
                    color: url ? '#0058be' : '#94a3b8',
                    '&:hover': url ? { bgcolor: '#f8fafc' } : undefined,
                  }}
                >
                  <Typography sx={{ flex: 1, fontWeight: 600, color: url ? '#1e293b' : '#94a3b8' }}>{label}</Typography>
                  {url ? (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Mở</Typography>
                      <OpenIcon sx={{ fontSize: 16 }} />
                    </>
                  ) : (
                    <Typography variant="body2">Không có</Typography>
                  )}
                </Box>
              )
            })}
          </Paper>

          {isLecturer && (
            <TextField
              label="Nhận xét (bắt buộc khi trả bài)"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              sx={{ mt: 2.5 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialog(null)} disabled={deciding} sx={{ mr: 'auto', textTransform: 'none', color: '#64748b' }}>
            Đóng
          </Button>
          {isLecturer && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ReturnIcon />}
                onClick={() => decide('reject')}
                disabled={deciding || !comment.trim()}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Trả bài
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={deciding ? <CircularProgress size={16} color="inherit" /> : <ApproveIcon />}
                onClick={() => decide('approve')}
                disabled={deciding}
                sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
              >
                Xác nhận
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
