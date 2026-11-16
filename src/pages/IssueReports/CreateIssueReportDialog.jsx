import { useState } from 'react'
import { AddPhotoAlternate as PhotoIcon, Send as SendIcon } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { issueReportService } from '../../services/issueReportService'
import { ISSUE_TYPES } from './issueReportLabels'

const MAX_DESCRIPTION = 1000
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const emptyForm = { itemCode: '', issueType: 'Damaged', description: '', image: null }

/**
 * Hộp thoại báo sự cố cho một thiết bị theo mã thiết bị (item code, có thể quét mã vạch vào ô nhập).
 * BE tự kiểm tra phạm vi: sinh viên chỉ báo được thiết bị mình đang mượn, LabStaff chỉ lab mình phụ trách.
 */
export default function CreateIssueReportDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const close = () => {
    if (submitting) return
    setForm(emptyForm)
    setError('')
    onClose()
  }

  const pickImage = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Ảnh minh chứng phải là file hình ảnh.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Ảnh minh chứng tối đa 5 MB.')
      return
    }
    setError('')
    updateForm('image', file)
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const created = await issueReportService.createIssueReport({
        itemCode: form.itemCode.trim(),
        issueType: form.issueType,
        description: form.description.trim(),
        image: form.image,
      })
      setForm(emptyForm)
      onCreated(created)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = form.itemCode.trim() && form.description.trim() && form.description.length <= MAX_DESCRIPTION

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Báo sự cố thiết bị</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Mã thiết bị"
            placeholder="Nhập hoặc quét mã vạch trên thiết bị"
            value={form.itemCode}
            onChange={(event) => updateForm('itemCode', event.target.value)}
            required
            autoFocus
            fullWidth
            helperText="Chỉ áp dụng cho thiết bị quản lý theo từng chiếc (REUSABLE / HIGH_VALUE)."
          />
          <TextField
            select
            label="Loại sự cố"
            value={form.issueType}
            onChange={(event) => updateForm('issueType', event.target.value)}
            fullWidth
          >
            {ISSUE_TYPES.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Mô tả sự cố"
            value={form.description}
            onChange={(event) => updateForm('description', event.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
            error={form.description.length > MAX_DESCRIPTION}
            helperText={`${form.description.length}/${MAX_DESCRIPTION} ký tự`}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button component="label" variant="outlined" startIcon={<PhotoIcon />} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {form.image ? 'Đổi ảnh' : 'Thêm ảnh minh chứng'}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                  pickImage(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </Button>
            {form.image ? (
              <>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{form.image.name}</Typography>
                <Button size="small" color="error" onClick={() => updateForm('image', null)} sx={{ textTransform: 'none' }}>Bỏ ảnh</Button>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">Không bắt buộc, tối đa 5 MB.</Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={submitting}>Đóng</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting || !canSubmit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          sx={{ bgcolor: '#0058be' }}
        >
          {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
