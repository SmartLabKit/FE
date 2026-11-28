import { useState } from 'react'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Description as ReportIcon,
  FolderZip as ZipIcon,
  Save as SaveIcon,
  Send as SendIcon,
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
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { projectService } from '../../services/projectService'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const FINAL_STATUS = {
  Pending: { label: 'Chờ giảng viên xác nhận', sx: { bgcolor: '#fff7ed', color: '#c2410c' } },
  Accepted: { label: 'Đã được xác nhận', sx: { bgcolor: '#ecfdf5', color: '#047857' } },
  Returned: { label: 'Bị trả bài, cần nộp lại', sx: { bgcolor: '#fef2f2', color: '#b91c1c' } },
}

const LINK_FIELDS = [
  { key: 'githubUrl', label: 'Link GitHub' },
  { key: 'slideUrl', label: 'Link slide thuyết trình' },
  { key: 'demoVideoUrl', label: 'Link video demo' },
]

const isValidUrl = (value) => /^https?:\/\/\S+$/i.test(value.trim())

const linksOf = (project) => ({
  githubUrl: project?.githubUrl || '',
  slideUrl: project?.slideUrl || '',
  demoVideoUrl: project?.demoVideoUrl || '',
})

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

/**
 * Khối "Nộp bài cuối kỳ" trên trang Thiết lập dự án (chỉ hiện khi project đã Approved).
 * Nhóm trưởng cập nhật link GitHub, slide, video demo (đều không bắt buộc), tải báo cáo PDF (bắt buộc) và mã nguồn ZIP (không bắt buộc) rồi nộp.
 * Khi bài đang chờ xác nhận hoặc đã được xác nhận thì BE khóa chỉnh sửa, giao diện cũng khóa theo.
 */
export default function FinalSubmissionPanel({ project, isLeader, onProjectUpdated, showToast }) {
  const [links, setLinks] = useState(() => linksOf(project))
  const [prevProjectLinks, setPrevProjectLinks] = useState(() => linksOf(project))
  const [savingLinks, setSavingLinks] = useState(false)
  const [uploading, setUploading] = useState('')
  const [deleting, setDeleting] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const projectLinks = linksOf(project)
  if (LINK_FIELDS.some(({ key }) => projectLinks[key] !== prevProjectLinks[key])) {
    setPrevProjectLinks(projectLinks)
    setLinks(projectLinks)
  }

  const finalStatus = project.finalStatus
  const locked = finalStatus === 'Pending' || finalStatus === 'Accepted'
  const canEdit = isLeader && !locked
  const linksChanged = LINK_FIELDS.some(({ key }) => links[key].trim() !== projectLinks[key])
  const invalidLink = LINK_FIELDS.find(({ key }) => links[key].trim() && !isValidUrl(links[key]))
  const missing = [
    ...(project.reportUrl ? [] : ['File báo cáo PDF']),
  ]
  const canSubmit = canEdit && missing.length === 0 && !linksChanged

  const runAction = async (action, successMessage) => {
    try {
      const updated = await action()
      onProjectUpdated(updated)
      showToast(successMessage)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const saveLinks = async () => {
    if (invalidLink) {
      showToast(`${invalidLink.label} phải bắt đầu bằng http:// hoặc https://`, 'error')
      return
    }
    setSavingLinks(true)
    await runAction(
      () => projectService.updateProjectLinks(project.projectId, {
        githubUrl: links.githubUrl.trim() || null,
        slideUrl: links.slideUrl.trim() || null,
        demoVideoUrl: links.demoVideoUrl.trim() || null,
      }),
      'Đã lưu link project.',
    )
    setSavingLinks(false)
  }

  const uploadFile = async (kind, file) => {
    if (!file) return
    const isReport = kind === 'report'
    const extension = isReport ? '.pdf' : '.zip'
    if (!file.name.toLowerCase().endsWith(extension)) {
      showToast(isReport ? 'Báo cáo phải là file PDF.' : 'Mã nguồn phải là file ZIP.', 'error')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('File vượt quá 10 MB.', 'error')
      return
    }
    setUploading(kind)
    await runAction(
      () => (isReport
        ? projectService.uploadProjectReport(project.projectId, file)
        : projectService.uploadProjectSourceCode(project.projectId, file)),
      isReport ? 'Đã tải lên file báo cáo.' : 'Đã tải lên mã nguồn.',
    )
    setUploading('')
  }

  const deleteFile = async (kind) => {
    const isReport = kind === 'report'
    setDeleting(kind)
    await runAction(
      () => (isReport
        ? projectService.deleteProjectReport(project.projectId)
        : projectService.deleteProjectSourceCode(project.projectId)),
      isReport ? 'Đã xóa file báo cáo.' : 'Đã xóa file mã nguồn.',
    )
    setDeleting('')
  }

  const submitFinal = async () => {
    setSubmitting(true)
    try {
      const updated = await projectService.submitFinal(project.projectId)
      onProjectUpdated(updated)
      setConfirmOpen(false)
      showToast('Đã nộp bài cuối kỳ, chờ giảng viên xác nhận.')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const renderFileRow = ({ kind, title, hint, url, accept, icon }) => (
    <Box
      sx={{
        p: 1.5,
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ color: url ? '#0058be' : '#94a3b8', display: 'flex' }}>{icon}</Box>
      <Box sx={{ flexGrow: 1, minWidth: 180 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
        {url ? (
          <Link href={url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
            Xem file đã tải lên
          </Link>
        ) : (
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        )}
      </Box>
      {canEdit && (
        <Stack direction="row" spacing={1}>
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={uploading === kind ? <CircularProgress size={14} /> : <UploadIcon />}
            disabled={Boolean(uploading) || Boolean(deleting)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {url ? 'Thay file' : 'Tải lên'}
            <input
              hidden
              type="file"
              accept={accept}
              onChange={(event) => {
                uploadFile(kind, event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </Button>
          {url && (
            <Button
              size="small"
              color="error"
              startIcon={deleting === kind ? <CircularProgress size={14} /> : <DeleteIcon />}
              disabled={Boolean(uploading) || Boolean(deleting)}
              onClick={() => deleteFile(kind)}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Xóa
            </Button>
          )}
        </Stack>
      )}
    </Box>
  )

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Nộp bài cuối kỳ</Typography>
        <Chip
          size="small"
          label={FINAL_STATUS[finalStatus]?.label || 'Chưa nộp'}
          sx={{ fontWeight: 800, ...(FINAL_STATUS[finalStatus]?.sx || { bgcolor: '#f1f5f9', color: '#475569' }) }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chỉ bắt buộc file báo cáo PDF. Các link và mã nguồn ZIP không bắt buộc. File tối đa 10 MB.
      </Typography>

      <Stack spacing={2}>
        {finalStatus === 'Returned' && project.finalComment && (
          <Alert severity="error">
            <b>Giảng viên trả bài{project.finalReviewedByName ? ` (${project.finalReviewedByName})` : ''}:</b> {project.finalComment}
          </Alert>
        )}
        {finalStatus === 'Pending' && (
          <Alert severity="info">Đã nộp lúc {formatDateTime(project.finalSubmittedAt)}. Không thể sửa trong lúc chờ giảng viên xác nhận.</Alert>
        )}
        {finalStatus === 'Accepted' && (
          <Alert severity="success">
            Bài nộp đã được xác nhận lúc {formatDateTime(project.finalReviewedAt)}
            {project.finalComment ? `. Nhận xét: ${project.finalComment}` : '.'}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          {LINK_FIELDS.map(({ key, label }) => (
            canEdit ? (
              <TextField
                key={key}
                size="small"
                label={`${label} (không bắt buộc)`}
                placeholder="https://..."
                value={links[key]}
                onChange={(event) => setLinks((current) => ({ ...current, [key]: event.target.value }))}
                error={Boolean(links[key].trim()) && !isValidUrl(links[key])}
                fullWidth
              />
            ) : (
              <Box key={key}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                {projectLinks[key] ? (
                  <Link href={projectLinks[key]} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {projectLinks[key]}
                  </Link>
                ) : (
                  <Typography variant="body2">—</Typography>
                )}
              </Box>
            )
          ))}
        </Box>
        {canEdit && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={savingLinks ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={savingLinks || !linksChanged}
              onClick={saveLinks}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {savingLinks ? 'Đang lưu...' : 'Lưu link'}
            </Button>
          </Box>
        )}

        {renderFileRow({
          kind: 'report',
          title: 'Báo cáo (PDF, bắt buộc)',
          hint: 'Chưa có file báo cáo.',
          url: project.reportUrl,
          accept: '.pdf,application/pdf',
          icon: <ReportIcon />,
        })}
        {renderFileRow({
          kind: 'source',
          title: 'Mã nguồn (ZIP, không bắt buộc)',
          hint: 'Chưa có file mã nguồn.',
          url: project.sourceCodeUrl,
          accept: '.zip,application/zip',
          icon: <ZipIcon />,
        })}

        {isLeader && !locked && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color={missing.length || linksChanged ? 'error' : 'text.secondary'}>
              {linksChanged
                ? 'Bạn có link chưa lưu.'
                : missing.length
                  ? `Còn thiếu: ${missing.join(', ')}.`
                  : 'Đã đủ thông tin, có thể nộp bài.'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
              sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
            >
              {finalStatus === 'Returned' ? 'Nộp lại bài' : 'Nộp bài cuối kỳ'}
            </Button>
          </Box>
        )}
        {!isLeader && (
          <Typography variant="body2" color="text.secondary">Chỉ trưởng nhóm mới có thể cập nhật và nộp bài cuối kỳ.</Typography>
        )}
      </Stack>

      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Xác nhận nộp bài cuối kỳ</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Sau khi nộp, nhóm sẽ không sửa được link và file cho tới khi giảng viên xác nhận hoặc trả bài. Bạn chắc chắn muốn nộp?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>Đóng</Button>
          <Button
            variant="contained"
            onClick={submitFinal}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          >
            {submitting ? 'Đang nộp...' : 'Xác nhận nộp'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
