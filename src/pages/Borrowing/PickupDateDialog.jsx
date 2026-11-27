import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'

/**
 * Lab chọn ngày hẹn sinh viên đến nhận linh kiện: lúc xác nhận sẵn sàng, hoặc đổi ngày khi chưa giao.
 * onSave nhận ngày dạng yyyy-mm-dd; trả về chuỗi lỗi (rỗng là xong).
 */
export default function PickupDateDialog({ request, onClose, onSave }) {
  const changing = request.status === 'Ready'
  const today = getVietnamDateInputValue()
  const dueDay = getVietnamDateInputValue(request.dueDate)
  const lastDay = dueDay >= today ? dueDay : ''
  const current = changing && request.borrowDate ? getVietnamDateInputValue(request.borrowDate) : ''
  const [date, setDate] = useState(current >= today ? current : today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!date) return setError('Chọn ngày hẹn nhận.')
    if (date < today) return setError('Ngày hẹn nhận không được ở quá khứ.')
    if (lastDay && date > lastDay) return setError(`Ngày hẹn nhận không được sau hạn trả ${formatVietnamDate(request.dueDate)}.`)
    setSaving(true)
    setError('')
    const failure = await onSave(date)
    if (failure) {
      setError(failure)
      setSaving(false)
    }
    return undefined
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>{changing ? 'Đổi ngày hẹn nhận' : 'Xác nhận sẵn sàng'}</DialogTitle>
      <DialogContent>
        {!changing && <Typography sx={{ mb: 1 }}>Đã kiểm tra đủ hàng. Sinh viên sẽ được báo đến nhận vào ngày:</Typography>}
        <TextField
          fullWidth
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setError('')
          }}
          slotProps={{ htmlInput: { min: today, max: lastDay || undefined, 'aria-label': 'Ngày hẹn nhận' } }}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={saving || (changing && date === current)}>
          {saving ? 'Đang lưu...' : changing ? 'Đổi ngày' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
