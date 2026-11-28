import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle as CheckCircleIcon, Save as SaveIcon } from '@mui/icons-material'
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
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { borrowService } from '../../services/borrowService'
import IssueBorrowModal from '../../components/borrowing/IssueBorrowModal'
import { issueReportService } from '../../services/issueReportService'
import IssueFindStep from './IssueFindStep'
import IssueItemsStep from './IssueItemsStep'
import IssuePhotoStep from './IssuePhotoStep'
import { issueCreatedMessage, issueTypeLabel } from './issueReportLabels'
import { locationLabel } from '../../utils/locationLabel'

const MAX_DESCRIPTION = 1000
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const emptyForm = { issueType: 'Damaged', description: '', image: null, replace: false }

const LOAN_STEPS = ['find', 'items', 'photo', 'result']
const CABINET_STEPS = ['find', 'photo', 'result']
const STEP_LABELS = { items: 'Chọn món hư', photo: 'Ảnh món hư', result: 'Kết quả' }

function rowsOf(result) {
  return Array.isArray(result) ? result : result?.items || []
}

function UnitCard({ unit }) {
  const { item, borrowContext: borrow } = unit
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8fafc', borderColor: '#d8dced' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{item.componentName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[item.itemCode, item.serialNumber && `Serial ${item.serialNumber}`, locationLabel(item.roomCode, item.cabinetCode)]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          {borrow && (
            <Typography variant="body2">
              Người mượn: <strong>{borrow.requesterFullName}</strong>
              {borrow.requesterStudentCode ? ` (${borrow.requesterStudentCode})` : ''}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          color={borrow ? 'primary' : 'success'}
          label={borrow ? `Đơn ${borrow.borrowRequestCode}` : 'Trong tủ'}
          sx={{ fontWeight: 700 }}
        />
      </Box>
    </Paper>
  )
}

/**
 * Ghi nhận sự cố: tìm đơn đang mượn → chọn món hư trong đơn → ảnh món hư → kết quả kiểm tra.
 * Thiết bị hỏng trong tủ thì nhập thẳng mã thiết bị. Chỉ nhân viên lab ghi nhận và ghi nhận là xong ngay (BE đóng dòng mượn).
 * Ghi xong một món thì hiện màn hình xong: giao con thay thế ngay trong form này hoặc ghi tiếp món khác. Chỉ render khi mở, để mỗi lần mở là một form mới.
 */
export default function CreateIssueReportDialog({ initialCode = '', onClose, onCreated }) {
  const [mode, setMode] = useState('loan')
  const [step, setStep] = useState('find')
  const [code, setCode] = useState(initialCode)
  const [orders, setOrders] = useState([])
  const [order, setOrder] = useState(null)
  const [unit, setUnit] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [replacementRequest, setReplacementRequest] = useState(null)
  const [handingOver, setHandingOver] = useState(false)
  const taskId = useRef(0)

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  /** Chạy một lần tải; lần tải cũ hơn (người dùng đã gõ tiếp hoặc tìm lại) bị bỏ qua. */
  const runTask = useCallback(async (work) => {
    taskId.current += 1
    const id = taskId.current
    const isCurrent = () => id === taskId.current
    setBusy(true)
    setError('')
    try {
      await work(isCurrent)
    } catch (taskError) {
      if (isCurrent()) setError(taskError.message)
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }, [])

  /** Mở form cho một thiết bị; ảnh và mô tả của thiết bị trước bị xóa. */
  const startUnit = useCallback((found) => {
    setForm(emptyForm)
    setPreviewUrl('')
    setUnit(found)
    setStep('photo')
  }, [])

  const openOrder = useCallback(async (borrowRequestId, isCurrent) => {
    const detail = await borrowService.getBorrowRequestById(borrowRequestId)
    if (!isCurrent()) return
    setOrder(detail)
    setStep('items')
  }, [])

  const openUnitOnLoan = useCallback(async (found, isCurrent) => {
    const detail = await borrowService.getBorrowRequestById(found.borrowContext.borrowRequestId)
    if (!isCurrent()) return
    setMode('loan')
    setOrder(detail)
    startUnit(found)
  }, [startUnit])

  const findLoans = useCallback(async (keyword, isCurrent) => {
    setOrders([])
    const pages = await Promise.all(['Borrowing', 'Overdue'].map((status) =>
      borrowService.getLabBorrowRequests({ status, search: keyword, page: 1, size: 50 })))
    if (!isCurrent()) return
    const found = pages.flatMap(rowsOf)
    if (found.length > 1) {
      setOrders(found)
      return
    }
    if (found.length === 1) {
      await openOrder(found[0].borrowRequestId, isCurrent)
      return
    }

    let byItem
    try {
      byItem = await issueReportService.lookupUnit(keyword)
    } catch (lookupError) {
      if (lookupError.cause?.response?.status !== 404) throw lookupError
      throw new Error('Không có đơn đang mượn hay thiết bị nào khớp.', { cause: lookupError })
    }
    if (!isCurrent()) return
    if (byItem.borrowContext) await openUnitOnLoan(byItem, isCurrent)
    else throw new Error(`${byItem.item.itemCode} đang nằm trong tủ, không có ai mượn. Chọn "Thiết bị trong tủ" để ghi nhận.`)
  }, [openOrder, openUnitOnLoan])

  const findUnit = useCallback(async (keyword, isCurrent) => {
    const found = await issueReportService.lookupUnit(keyword)
    if (!isCurrent()) return
    if (found.borrowContext) {
      await openUnitOnLoan(found, isCurrent)
      return
    }
    setOrder(null)
    startUnit(found)
  }, [openUnitOnLoan, startUnit])

  const search = (value) => {
    const keyword = value.trim()
    if (!keyword) return
    const find = mode === 'loan' ? findLoans : findUnit
    runTask((isCurrent) => find(keyword, isCurrent))
  }

  const scanCard = (file) => runTask(async (isCurrent) => {
    if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn ảnh thẻ sinh viên.')
    if (file.size > MAX_IMAGE_SIZE) throw new Error('Ảnh thẻ tối đa 5 MB.')
    const reading = await borrowService.readStudentCard(file)
    if (!isCurrent()) return
    if (!reading.studentCode) {
      throw new Error(reading.aiAvailable
        ? 'Không đọc được MSSV trên ảnh, hãy nhập MSSV.'
        : 'AI đọc thẻ đang lỗi, hãy nhập MSSV.')
    }
    setCode(reading.studentCode)
    await findLoans(reading.studentCode, isCurrent)
  })

  const pickOrder = (borrowRequestId) => runTask((isCurrent) => openOrder(borrowRequestId, isCurrent))

  const pickItem = (item) => runTask(async (isCurrent) => {
    const found = await issueReportService.lookupUnit(item.itemCode)
    if (isCurrent()) startUnit(found)
  })

  useEffect(() => {
    if (!initialCode) return undefined
    const timer = window.setTimeout(() => runTask((isCurrent) => findUnit(initialCode, isCurrent)), 0)
    return () => window.clearTimeout(timer)
  }, [initialCode, findUnit, runTask])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const changeCode = (value) => {
    taskId.current += 1
    setBusy(false)
    setCode(value)
    setOrders([])
    setError('')
  }

  const changeMode = (value) => {
    changeCode('')
    setMode(value)
    setOrder(null)
    setUnit(null)
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

  const steps = mode === 'loan' ? LOAN_STEPS : CABINET_STEPS
  let stepIndex = steps.indexOf(step)
  if (step === 'done') stepIndex = steps.length
  const isLost = form.issueType === 'Lost'
  const canReplace = Boolean(unit?.borrowContext) && !isLost
  const replace = canReplace && form.replace
  const photoReady = isLost || Boolean(form.image)
  const description = form.description.trim()
  const canSubmit = Boolean(unit && photoReady && description && form.description.length <= MAX_DESCRIPTION)

  const goBack = () => {
    taskId.current += 1
    setBusy(false)
    setError('')
    setStep(steps[stepIndex - 1])
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    let created
    try {
      created = await issueReportService.createIssueReport({
        componentItemId: unit.item.componentItemId,
        issueType: form.issueType,
        description,
        image: form.image,
        replace,
      })
    } catch (submitError) {
      setError(submitError.message)
      setSubmitting(false)
      return
    }

    onCreated(created)
    let replacementRequestId = ''
    if (replace && created?.replacementBorrowItemId) replacementRequestId = unit.borrowContext.borrowRequestId
    setDone({
      itemCode: unit.item.itemCode,
      message: issueCreatedMessage(created, { replaceRequested: replace }),
      replacementRequestId,
      replacementBorrowItemId: created?.replacementBorrowItemId || '',
      handedOver: false,
    })
    setForm(emptyForm)
    setPreviewUrl('')
    setUnit(null)
    setStep('done')
    setSubmitting(false)
  }

  // Ghi tiếp: quay lại đơn đang xem (tải lại để thấy dòng vừa đóng) hoặc về bước tìm
  const recordAnother = async () => {
    setDone(null)
    if (mode === 'loan' && order) {
      try {
        setOrder(await borrowService.getBorrowRequestById(order.borrowRequestId))
        setStep('items')
        return
      } catch {
        setOrder(null)
      }
    }
    setCode('')
    setStep('find')
  }

  // Mở bước giao con thay thế (chọn con, chụp ảnh) ngay trong form, không phải sang trang Xử lý đơn mượn
  const handOverReplacement = async () => {
    setError('')
    setHandingOver(true)
    try {
      const detail = await borrowService.getBorrowRequestById(done.replacementRequestId)
      const line = (detail.items || []).find((item) => item.borrowItemId === done.replacementBorrowItemId)
      if (!line || line.status !== 'Pending') {
        setError('Con thay thế này đã được giao hoặc đã hủy.')
        return
      }
      setReplacementRequest({ ...detail, items: [line], replacementLine: line })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setHandingOver(false)
    }
  }

  const issueReplacement = async (payload) => {
    setError('')
    setHandingOver(true)
    try {
      await borrowService.issueReplacement(replacementRequest.borrowRequestId, {
        borrowItemId: replacementRequest.replacementLine.borrowItemId,
        itemId: payload.units[0].itemIds[0],
        photoId: payload.photoId,
        overrideReason: payload.overrideReason,
      })
    } catch (issueError) {
      setError(issueError.message || 'Giao con thay thế thất bại.')
      setReplacementRequest(null)
      return false
    } finally {
      setHandingOver(false)
    }
    setReplacementRequest(null)
    setDone((current) => ({ ...current, handedOver: true }))
    onCreated()
    return true
  }

  const close = () => {
    if (!submitting) onClose()
  }

  const consequences = unit && [
    `${unit.item.itemCode} sẽ chuyển sang ${isLost ? 'Thất lạc' : 'Thanh lý'}, không cho mượn được nữa.`,
    unit.borrowContext && `Dòng mượn trong đơn ${unit.borrowContext.borrowRequestCode} được đóng, sinh viên nhận email.`,
    replace && 'Đơn có thêm một con thay thế chờ giao.',
    'Không hoàn tác được.',
  ].filter(Boolean).join(' ')

  return (
    <Dialog open onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Ghi nhận sự cố thiết bị</DialogTitle>
      <DialogContent>
        <Stepper activeStep={stepIndex} alternativeLabel sx={{ mb: 2.5, mt: 0.5 }}>
          {steps.map((key) => (
            <Step key={key}>
              <StepLabel>{STEP_LABELS[key] || (mode === 'loan' ? 'Tìm đơn mượn' : 'Tìm thiết bị')}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          {step === 'find' && (
            <IssueFindStep
              mode={mode}
              onModeChange={changeMode}
              code={code}
              onCodeChange={changeCode}
              onSearch={search}
              onScanCard={scanCard}
              orders={orders}
              onPickOrder={pickOrder}
              busy={busy}
            />
          )}

          {step === 'items' && order && <IssueItemsStep order={order} busy={busy} onPick={pickItem} />}

          {step === 'photo' && unit && (
            <>
              <UnitCard unit={unit} />
              <IssuePhotoStep
                issueType={form.issueType}
                onTypeChange={(value) => updateForm('issueType', value)}
                previewUrl={previewUrl}
                onPickImage={pickImage}
                onClearImage={() => {
                  updateForm('image', null)
                  setPreviewUrl('')
                }}
                accept={IMAGE_TYPES.join(',')}
              />
            </>
          )}

          {step === 'done' && done && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: '#16a34a' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>Đã ghi nhận {done.itemCode}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {done.handedOver ? 'Đã giao con thay thế cho sinh viên.' : done.message}
              </Typography>
            </Box>
          )}

          {step === 'result' && unit && (
            <>
              <UnitCard unit={unit} />
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {previewUrl && (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Ảnh linh kiện bị hư"
                    sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1.5, border: '1px solid #e2e8f0' }}
                  />
                )}
                <Typography variant="body2">Tình trạng: <strong>{issueTypeLabel(form.issueType)}</strong></Typography>
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
                autoFocus
                fullWidth
                error={form.description.length > MAX_DESCRIPTION}
                helperText={`${form.description.length}/${MAX_DESCRIPTION} ký tự`}
              />
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
                      : `Lab còn ${unit.freeReplacementUnits} con. Ghi nhận xong là giao con thay thế được ngay.`}
                  </Typography>
                </Box>
              )}
              <Alert severity="warning">{consequences}</Alert>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {stepIndex > 0 && step !== 'done' && (
          <Button onClick={goBack} disabled={submitting} sx={{ mr: 'auto' }}>Quay lại</Button>
        )}
        <Button onClick={close} disabled={submitting}>Đóng</Button>
        {step === 'done' && (
          <Button variant={done?.replacementRequestId && !done.handedOver ? 'outlined' : 'contained'} onClick={recordAnother}>
            Ghi tiếp món khác
          </Button>
        )}
        {step === 'done' && done?.replacementRequestId && !done.handedOver && (
          <Button
            variant="contained"
            onClick={handOverReplacement}
            disabled={handingOver}
            startIcon={handingOver ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: '#0058be' }}
          >
            Giao con thay thế ngay
          </Button>
        )}
        {step === 'photo' && (
          <Button variant="contained" onClick={() => setStep('result')} disabled={!photoReady} sx={{ bgcolor: '#0058be' }}>
            Tiếp tục
          </Button>
        )}
        {step === 'result' && (
          <Button
            variant="contained"
            color="error"
            onClick={submit}
            disabled={submitting || !canSubmit}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          >
            {submitting ? 'Đang lưu...' : 'Ghi nhận'}
          </Button>
        )}
      </DialogActions>

      {replacementRequest && (
        <IssueBorrowModal
          open
          request={replacementRequest}
          submitting={handingOver}
          onClose={() => setReplacementRequest(null)}
          onIssue={issueReplacement}
        />
      )}
    </Dialog>
  )
}
