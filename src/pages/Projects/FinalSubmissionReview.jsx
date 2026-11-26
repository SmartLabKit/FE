import { useEffect, useState } from 'react'
import {
  CheckCircle as ApproveIcon,
  Replay as ReturnIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
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
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
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
  { key: 'githubUrl', label: 'GitHub' },
  { key: 'slideUrl', label: 'Slide' },
  { key: 'demoVideoUrl', label: 'Video demo' },
  { key: 'reportUrl', label: 'Báo cáo PDF' },
  { key: 'sourceCodeUrl', label: 'Mã nguồn ZIP' },
]

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

/**
 * Giảng viên xem các bài nộp cuối kỳ đang chờ xác nhận của lớp mình, xác nhận (nhận xét không bắt buộc)
 * hoặc trả bài (bắt buộc nhận xét). Admin thấy tất cả nhưng chỉ xem: chỉ giảng viên của lớp được chấm bài.
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

  const openDialog = (type, submission) => {
    setDialog({ type, submission })
    setComment('')
  }

  const decide = async () => {
    const { type, submission } = dialog
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
          <Stack spacing={1.5}>
            {items.map((submission) => (
              <Paper key={submission.projectId} variant="outlined" sx={{ p: 2, borderColor: '#d8dced' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, color: '#131b2e' }}>{submission.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {submission.teamName || '—'} · Lớp {submission.classCode || '—'}
                      {submission.leaderName ? ` · Trưởng nhóm ${submission.leaderName}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nộp lúc {formatDateTime(submission.finalSubmittedAt)}
                    </Typography>
                  </Box>
                  {isLecturer && (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<ReturnIcon />}
                        onClick={() => openDialog('reject', submission)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Trả bài
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<ApproveIcon />}
                        onClick={() => openDialog('approve', submission)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Xác nhận
                      </Button>
                    </Stack>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                  {SUBMISSION_LINKS.map(({ key, label }) => (
                    submission[key] ? (
                      <Chip
                        key={key}
                        size="small"
                        label={label}
                        component={Link}
                        href={submission[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Chip key={key} size="small" label={`${label}: không có`} sx={{ color: '#94a3b8' }} />
                    )
                  ))}
                </Box>
              </Paper>
            ))}
          </Stack>
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

      <Dialog open={Boolean(dialog)} onClose={() => !deciding && setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {dialog?.type === 'approve' ? 'Xác nhận bài nộp cuối kỳ' : 'Trả bài nộp cuối kỳ'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {dialog?.submission.title} · {dialog?.submission.teamName}
          </Typography>
          <TextField
            label={dialog?.type === 'approve' ? 'Nhận xét (không bắt buộc)' : 'Lý do trả bài (bắt buộc)'}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            multiline
            minRows={3}
            fullWidth
            required={dialog?.type === 'reject'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} disabled={deciding}>Đóng</Button>
          <Button
            variant="contained"
            color={dialog?.type === 'approve' ? 'success' : 'error'}
            onClick={decide}
            disabled={deciding || (dialog?.type === 'reject' && !comment.trim())}
            startIcon={deciding ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {dialog?.type === 'approve' ? 'Xác nhận' : 'Trả bài'}
          </Button>
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
