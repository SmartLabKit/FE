import { useState } from 'react'
import { Alert, Button, TextField, Typography } from '@mui/material'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ReturnBorrowModal from '../../components/borrowing/ReturnBorrowModal'
import { borrowService } from '../../services/borrowService'
import { returnSlipService } from '../../services/returnSlipService'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'
import { COLORS, daysUntil } from './returnSlipHelpers'

const PRIMARY = { mt: 2.5, py: 1.25, textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }
const LINK = { mt: 1, textTransform: 'none', color: COLORS.grey }

/** Việc của LabStaff trên một phiếu: duyệt và chọn ngày, từ chối, đổi ngày, nhận linh kiện. onChanged nhận phiếu mới. */
export default function ReturnSlipStaffActions({ slip, onChanged }) {
  const [date, setDate] = useState(slip.appointmentDate ? getVietnamDateInputValue(slip.appointmentDate) : '')
  const [comment, setComment] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [receiving, setReceiving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRequest, setConfirmRequest] = useState(null)

  const pending = slip.status === 'Pending'
  const today = getVietnamDateInputValue()
  const lastDay = daysUntil(slip.dueDate) >= 0 ? getVietnamDateInputValue(slip.dueDate) : ''

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      onChanged(await action())
      setRescheduling(false)
      setComment('')
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  const saveDate = () => {
    if (!date) return setError('Chọn ngày mang lên.')
    if (date < today) return setError('Ngày mang lên không được ở quá khứ.')
    if (lastDay && date > lastDay) return setError(`Ngày mang lên không được sau hạn trả ${formatVietnamDate(slip.dueDate)}.`)
    const data = { appointmentDate: date, comment: comment.trim() || null }
    return run(() => (pending ? returnSlipService.approve(slip.returnSlipId, data) : returnSlipService.reschedule(slip.returnSlipId, data)))
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
      {(pending || rescheduling) && (
        <>
          <Typography sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Ngày mang lên</Typography>
          <TextField
            fullWidth
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ htmlInput: { min: today, max: lastDay || undefined, 'aria-label': 'Ngày mang lên' } }}
          />
          <TextField
            fullWidth
            multiline
            placeholder="Nhắn sinh viên (không bắt buộc)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ mt: 1.5 }}
          />
        </>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {pending && (
        <>
          <Button fullWidth variant="contained" disabled={busy} onClick={saveDate} sx={PRIMARY}>
            Duyệt
          </Button>
          <Button
            fullWidth
            disabled={busy}
            onClick={() =>
              setConfirmRequest({
                title: 'Từ chối phiếu trả?',
                message: 'Sinh viên nhận được lý do và tạo lại phiếu khác được.',
                confirmText: 'Từ chối',
                reasonLabel: 'Lý do',
                onConfirm: (reason) => run(() => returnSlipService.reject(slip.returnSlipId, { reason })),
              })
            }
            sx={LINK}
          >
            Từ chối
          </Button>
        </>
      )}
      {!pending && rescheduling && (
        <>
          <Button fullWidth variant="contained" disabled={busy} onClick={saveDate} sx={PRIMARY}>
            Lưu ngày mới
          </Button>
          <Button fullWidth disabled={busy} onClick={() => setRescheduling(false)} sx={LINK}>
            Đóng
          </Button>
        </>
      )}
      {!pending && !rescheduling && (
        <>
          <Button fullWidth variant="contained" disabled={busy} onClick={openReceive} sx={PRIMARY}>
            Nhận trả
          </Button>
          <Button fullWidth disabled={busy} onClick={() => setRescheduling(true)} sx={LINK}>
            Đổi ngày hẹn
          </Button>
        </>
      )}
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
