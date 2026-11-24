import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AddPhotoAlternate as PhotoIcon,
  QrCodeScanner as ScanIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { issueReportService } from '../../services/issueReportService'
import { ISSUE_TYPES, formatDateTime } from './issueReportLabels'

const MAX_DESCRIPTION = 1000
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const emptyForm = { issueType: 'Damaged', description: '', image: null, replace: false }

function UnitCard({ unit }) {
  const { item, borrowContext: borrow } = unit
  return (
    <Paper variant="outlined" sx={{ p: 1.75, bgcolor: '#f8fafc', borderColor: '#d8dced' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{item.componentName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[item.itemCode, item.serialNumber && `Serial ${item.serialNumber}`].filter(Boolean).join(' · ')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {[item.roomCode, item.cabinetCode].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={borrow ? 'primary' : 'success'}
          label={borrow ? 'Đang mượn' : 'Trong tủ'}
          sx={{ fontWeight: 700 }}
        />
      </Box>
      {borrow && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Người mượn: <strong>{borrow.requesterFullName}</strong>
          {borrow.requesterStudentCode ? ` (${borrow.requesterStudentCode})` : ''}
          {borrow.classCode ? ` · ${borrow.classCode}` : ''}
          <br />
          Đơn <strong>{borrow.borrowRequestCode}</strong> · giao {formatDateTime(borrow.issuedAt)}
        </Typography>
      )}
    </Paper>
  )
}

/**
 * Ghi nhận sự cố của một thiết bị: quét mã để thấy thiết bị và người đang mượn, rồi mới nhập tình trạng.
 * LabStaff / Admin đã cầm thiết bị để kiểm tra nên ghi nhận là xong ngay (kèm tùy chọn đổi con khác cho sinh viên);
 * InventoryManager chỉ báo thiết bị trong tủ, chờ nhân viên lab kiểm tra.
 * Chỉ render khi mở, để mỗi lần mở là một form mới.
 */
export default function CreateIssueReportDialog({ initialCode = '', onClose, onCreated }) {
  const [code, setCode] = useState(initialCode)
  const [unit, setUnit] = useState(null)
  const [looking, setLooking] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [previewUrl, setPreviewUrl] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const lookupId = useRef(0)
  // Ảnh và mô tả thuộc về thiết bị này; tra sang thiết bị khác thì nhập lại từ đầu.
  const notedItemId = useRef(null)

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const lookup = useCallback(async (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const id = ++lookupId.current
    setLooking(true)
    setError('')
    setUnit(null)
    setForm((current) => ({ ...current, replace: false }))
    try {
      const found = await issueReportService.lookupUnit(trimmed)
      if (id !== lookupId.current) return
      if (notedItemId.current !== found.item.componentItemId) {
        setForm(emptyForm)
        setPreviewUrl('')
      }
      notedItemId.current = found.item.componentItemId
      setUnit(found)
    } catch (lookupError) {
      if (id === lookupId.current) setError(lookupError.message)
    } finally {
      if (id === lookupId.current) setLooking(false)
    }
  }, [])

  useEffect(() => {
    if (!initialCode) return undefined
    const timer = window.setTimeout(() => lookup(initialCode), 0)
    return () => window.clearTimeout(timer)
  }, [initialCode, lookup])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const changeCode = (value) => {
    lookupId.current += 1
    setLooking(false)
    setCode(value)
    setUnit(null)
    setError('')
  }

  const pickImage = (file) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Ảnh phải là JPG, PNG hoặc WEBP.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Ảnh tối đa 5 MB.')
      return
    }
    setError('')
    updateForm('image', file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const isLost = form.issueType === 'Lost'
  const onLoan = Boolean(unit?.borrowContext)
  const canReplace = onLoan && !isLost
  const replace = canReplace && form.replace
  const photoMissing = !isLost && !form.image
  const description = form.description.trim()
  const canSubmit = Boolean(unit && description && form.description.length <= MAX_DESCRIPTION && !photoMissing)

  const submit = async () => {
    setConfirming(false)
    setSubmitting(true)
    setError('')
    try {
      const created = await issueReportService.createIssueReport({
        componentItemId: unit.item.componentItemId,
        issueType: form.issueType,
        description,
        image: form.image,
        replace,
      })
      onCreated(created, { replaceRequested: replace })
    } catch (submitError) {
      setError(submitError.message)
      setSubmitting(false)
    }
  }

  const close = () => {
    if (!submitting) onClose()
  }

  const confirmLines = unit && [
    `${unit.item.itemCode} sẽ chuyển sang ${isLost ? 'Thất lạc' : 'Thanh lý'} và không cho mượn được nữa.`,
    onLoan && `Dòng mượn trong đơn ${unit.borrowContext.borrowRequestCode} được đóng và sinh viên nhận email.`,
    replace && 'Đơn có thêm một con thay thế chờ giao.',
    'Không hoàn tác được.',
  ].filter(Boolean)

  return (
    <Dialog open onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Ghi nhận sự cố thiết bị</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              lookup(code)
            }}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
          >
            <TextField
              label="Mã thiết bị hoặc serial"
              placeholder="Quét mã vạch hoặc nhập rồi Enter"
              value={code}
              onChange={(event) => changeCode(event.target.value)}
              disabled={submitting}
              autoFocus
              fullWidth
            />
            <Button
              type="submit"
              variant="outlined"
              disabled={!code.trim() || looking || submitting}
              startIcon={looking ? <CircularProgress size={16} color="inherit" /> : <ScanIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, height: 56, flexShrink: 0 }}
            >
              Kiểm tra
            </Button>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {!unit && !looking && !error && (
            <Typography variant="body2" color="text.secondary">
              Quét mã thiết bị sinh viên mang tới để xem thông tin và người đang mượn. Vật tư tiêu hao không ghi nhận ở đây.
            </Typography>
          )}

          {unit && (
            <>
              <UnitCard unit={unit} />
              {!unit.confirmsImmediately && (
                <Alert severity="info">Báo cáo sẽ chờ nhân viên lab kiểm tra và xác nhận.</Alert>
              )}

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>Tình trạng</Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  color="primary"
                  value={form.issueType}
                  disabled={submitting}
                  onChange={(_, value) => value && updateForm('issueType', value)}
                >
                  {ISSUE_TYPES.map((type) => (
                    <ToggleButton key={type.value} value={type.value} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      {type.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <TextField
                label={isLost ? 'Lý do / hoàn cảnh mất' : 'Kết quả kiểm tra'}
                placeholder={isLost ? 'VD: Sinh viên báo mất khi di chuyển' : 'VD: Không nạp được code, chân D7 gãy'}
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                disabled={submitting}
                multiline
                minRows={3}
                required
                fullWidth
                error={form.description.length > MAX_DESCRIPTION}
                helperText={`${form.description.length}/${MAX_DESCRIPTION} ký tự`}
              />

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    component="label"
                    variant="outlined"
                    disabled={submitting}
                    startIcon={<PhotoIcon />}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {form.image ? 'Đổi ảnh' : 'Chụp / chọn ảnh'}
                    <input
                      hidden
                      type="file"
                      accept={IMAGE_TYPES.join(',')}
                      onChange={(event) => {
                        pickImage(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </Button>
                  {form.image ? (
                    <Button
                      size="small"
                      color="error"
                      disabled={submitting}
                      onClick={() => {
                        updateForm('image', null)
                        setPreviewUrl('')
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      Bỏ ảnh
                    </Button>
                  ) : (
                    <Typography variant="caption" color={photoMissing ? 'error.main' : 'text.secondary'}>
                      {isLost ? 'Không bắt buộc khi báo mất.' : 'Bắt buộc chụp thiết bị, tối đa 5 MB.'}
                    </Typography>
                  )}
                </Box>
                {previewUrl && (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Ảnh thiết bị"
                    sx={{ mt: 1.5, maxHeight: 180, maxWidth: '100%', borderRadius: 1.5, border: '1px solid #e2e8f0' }}
                  />
                )}
              </Box>

              {canReplace && (
                <Box>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={replace}
                        disabled={submitting || unit.freeReplacementUnits === 0}
                        onChange={(event) => updateForm('replace', event.target.checked)}
                      />
                    )}
                    label="Đổi con khác cho sinh viên"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                    {unit.freeReplacementUnits === 0
                      ? 'Lab không còn con nào để đổi.'
                      : `Lab còn ${unit.freeReplacementUnits} con. Giao con thay thế ở trang Đơn mượn tại Lab.`}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={submitting}>Đóng</Button>
        <Button
          variant="contained"
          onClick={() => (unit.confirmsImmediately ? setConfirming(true) : submit())}
          disabled={submitting || !canSubmit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ bgcolor: '#0058be' }}
        >
          {submitting ? 'Đang lưu...' : unit && !unit.confirmsImmediately ? 'Gửi báo cáo' : 'Ghi nhận'}
        </Button>
      </DialogActions>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Ghi nhận sự cố?</DialogTitle>
        <DialogContent>
          <Stack spacing={0.75}>
            {(confirmLines || []).map((line) => (
              <Typography key={line} variant="body2" sx={{ lineHeight: 1.6 }}>{line}</Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Quay lại</Button>
          <Button variant="contained" color="error" onClick={submit}>Ghi nhận</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
