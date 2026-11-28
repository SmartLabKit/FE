import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ReturnBorrowModal from '../../components/borrowing/ReturnBorrowModal'
import { borrowService } from '../../services/borrowService'
import { returnSlipService } from '../../services/returnSlipService'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'
import { COLORS, daysUntil, longDate } from './returnSlipHelpers'

const PRIMARY = { py: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0058be', boxShadow: 'none' }
const SECONDARY = { py: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 2 }

/** Popup chọn ngày sinh viên mang đồ lên: lúc duyệt phiếu hoặc đổi ngày hẹn. */
function AppointmentDialog({ slip, approving, onClose, onSave }) {
  const today = getVietnamDateInputValue()
  const lastDay = daysUntil(slip.dueDate) >= 0 ? getVietnamDateInputValue(slip.dueDate) : ''
  const current = slip.appointmentDate ? getVietnamDateInputValue(slip.appointmentDate) : ''
  const [date, setDate] = useState(current >= today ? current : today)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!date) return setError('Chọn ngày mang lên.')
    if (date < today) return setError('Ngày mang lên không được ở quá khứ.')
    if (lastDay && date > lastDay) return setError(`Ngày mang lên không được sau hạn trả ${formatVietnamDate(slip.dueDate)}.`)
    setSaving(true)
    setError('')
    const failure = await onSave({ appointmentDate: date, comment: comment.trim() || null })
    if (failure) {
      setError(failure)
      setSaving(false)
    }
    return undefined
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{approving ? `Duyệt ${slip.slipCode}` : 'Đổi ngày hẹn'}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: COLORS.grey, mb: 2 }}>
          {slip.items.length} món · hạn trả {formatVietnamDate(slip.dueDate)}. Sinh viên được báo mang đồ lên ngày:
        </Typography>
        <TextField
          fullWidth
          type="date"
          label="Ngày mang lên"
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setError('')
          }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, max: lastDay || undefined } }}
        />
        {date && (
          <Box sx={{ mt: 1.5, px: 2, py: 1.25, borderRadius: 2, bgcolor: '#eff6ff', color: COLORS.blue, fontWeight: 700 }}>
            {longDate(`${date}T00:00:00+07:00`)}
          </Box>
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Nhắn sinh viên"
          placeholder="Không bắt buộc"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 500 } }}
          sx={{ mt: 2 }}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, color: COLORS.grey }}>
          Đóng
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || (!approving && date === current)} sx={{ ...PRIMARY, px: 3 }}>
          {saving ? 'Đang lưu...' : approving ? 'Duyệt' : 'Đổi ngày'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Việc của LabStaff trên một phiếu: duyệt (popup chọn ngày), từ chối, đổi ngày, nhận linh kiện. onChanged nhận phiếu mới. */
export default function ReturnSlipStaffActions({ slip, onChanged }) {
  const [dateOpen, setDateOpen] = useState(false)
  const [receiving, setReceiving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRequest, setConfirmRequest] = useState(null)

  const pending = slip.status === 'Pending'

  const saveDate = async (data) => {
    try {
      const updated = pending
        ? await returnSlipService.approve(slip.returnSlipId, data)
        : await returnSlipService.reschedule(slip.returnSlipId, data)
      setDateOpen(false)
      onChanged(updated)
      return ''
    } catch (saveError) {
      return saveError.message
    }
  }

  const reject = async (reason) => {
    setBusy(true)
    setError('')
    try {
      onChanged(await returnSlipService.reject(slip.returnSlipId, { reason }))
    } catch (rejectError) {
      setError(rejectError.message)
    } finally {
      setBusy(false)
    }
  }

  const openReceive = async () => {
    setBusy(true)
    setError('')
    try {
      const request = await borrowService.getBorrowRequestById(slip.borrowRequestId)
      const planned = new Map(slip.items.map((item) => [item.borrowItemId, item.quantity]))
      const items = request.items.filter((item) => planned.has(item.borrowItemId) && item.status === 'Issued')
      setReceiving({ request: { ...request, items }, planned })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setBusy(false)
    }
  }

  const receive = async (payload) => {
    setBusy(true)
    setError('')
    try {
      await borrowService.returnBorrowRequest(slip.borrowRequestId, { ...payload, returnSlipId: slip.returnSlipId })
      onChanged(await returnSlipService.getById(slip.returnSlipId))
      return true
    } catch (returnError) {
      setError(returnError.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5 }}>
        {pending ? (
          <>
            <Button
              variant="outlined"
              color="error"
              disabled={busy}
              onClick={() =>
                setConfirmRequest({
                  title: 'Từ chối phiếu trả?',
                  message: 'Sinh viên nhận được lý do và tạo lại phiếu khác được.',
                  confirmText: 'Từ chối',
                  reasonLabel: 'Lý do',
                  onConfirm: reject,
                })
              }
              sx={{ ...SECONDARY, flex: 1 }}
            >
              Từ chối
            </Button>
            <Button variant="contained" disabled={busy} onClick={() => setDateOpen(true)} sx={{ ...PRIMARY, flex: 2 }}>
              Duyệt và hẹn ngày
            </Button>
          </>
        ) : (
          <>
            <Button variant="outlined" disabled={busy} onClick={() => setDateOpen(true)} sx={{ ...SECONDARY, flex: 1 }}>
              Đổi ngày hẹn
            </Button>
            <Button variant="contained" disabled={busy} onClick={openReceive} sx={{ ...PRIMARY, flex: 2 }}>
              Nhận trả
            </Button>
          </>
        )}
      </Box>
      {dateOpen && <AppointmentDialog slip={slip} approving={pending} onClose={() => setDateOpen(false)} onSave={saveDate} />}
      {receiving && (
        <ReturnBorrowModal
          open
          request={receiving.request}
          planned={receiving.planned}
          submitting={busy}
          submitError={error}
          onClose={() => setReceiving(null)}
          onReturn={receive}
        />
      )}
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </>
  )
}
