import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { PASSWORD_HINT, passwordError } from '../../utils/passwordRules'

/**
 * Tài khoản đang dùng mật khẩu tạm do Admin đặt (kích hoạt thủ công hoặc reset): phải đổi mật khẩu trước khi dùng tiếp.
 * Không đóng được, chỉ đổi mật khẩu hoặc đăng xuất.
 */
export default function ForcePasswordChangeDialog() {
  const { updateUser, logout } = useAuth()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.currentPassword) nextErrors.currentPassword = 'Vui lòng nhập mật khẩu tạm'
    const newError = passwordError(form.newPassword)
    if (newError) nextErrors.newPassword = newError
    if (form.newPassword !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu nhập lại không khớp'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setApiError('')
    try {
      const result = await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      updateUser({ ...(result?.user || {}), mustChangePassword: false })
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open maxWidth="xs" fullWidth disableEscapeKeyDown>
      <form onSubmit={submit} noValidate>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 20 }}>Đổi mật khẩu để tiếp tục</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: '#3d4556', mb: 2 }}>
            Bạn đang dùng mật khẩu tạm do Admin cấp. Hãy đặt mật khẩu mới của riêng bạn.
          </Typography>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Stack spacing={2}>
            <TextField
              type="password"
              label="Mật khẩu tạm"
              size="small"
              autoFocus
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              error={Boolean(errors.currentPassword)}
              helperText={errors.currentPassword}
            />
            <TextField
              type="password"
              label="Mật khẩu mới"
              size="small"
              value={form.newPassword}
              onChange={setField('newPassword')}
              error={Boolean(errors.newPassword)}
              helperText={errors.newPassword || PASSWORD_HINT}
            />
            <TextField
              type="password"
              label="Nhập lại mật khẩu mới"
              size="small"
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={logout} sx={{ textTransform: 'none' }}>Đăng xuất</Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Đổi mật khẩu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
