import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'

/**
 * Hộp xác nhận dùng chung thay cho window.confirm: cùng giao diện với các hộp khác và không chặn trình duyệt.
 * request = { title, message, confirmText, color, reasonLabel, onConfirm } hoặc null để đóng.
 * Có reasonLabel thì bắt buộc nhập lý do, onConfirm nhận lý do đó.
 */
export default function ConfirmDialog({ request, onClose }) {
  const [reason, setReason] = useState('')
  const needsReason = Boolean(request?.reasonLabel)

  const close = () => {
    setReason('')
    onClose()
  }

  const confirm = () => {
    const action = request?.onConfirm
    const text = reason.trim()
    close()
    if (action) action(text)
  }

  return (
    <Dialog open={Boolean(request)} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>{request?.title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: '#3d4556', lineHeight: 1.6 }}>{request?.message}</Typography>
        {needsReason && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={`${request.reasonLabel} *`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={close} sx={{ textTransform: 'none' }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          color={request?.color || 'error'}
          onClick={confirm}
          disabled={needsReason && !reason.trim()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {request?.confirmText || 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
