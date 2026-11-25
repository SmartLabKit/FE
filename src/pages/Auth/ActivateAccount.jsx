import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'

/**
 * Trang mở từ link trong email: /activate#<mã>. Phải bấm nút mới kích hoạt, vì hộp thư có thể tự mở link để quét.
 */
export default function ActivateAccount() {
  const navigate = useNavigate()
  const token = useLocation().hash.slice(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)

  const activate = async () => {
    setLoading(true)
    setError('')
    try {
      setAccount(await authService.activate(token))
    } catch (activateError) {
      setError(activateError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4.5 }, borderRadius: 3, border: '1px solid #e4e6ef', textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
          {account ? 'Kích hoạt thành công' : 'Kích hoạt tài khoản'}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280', mb: 3 }}>
          {account
            ? `Chào ${account.fullName}, bạn đăng nhập bằng tên ${account.username} và mật khẩu trong email.`
            : 'Bấm nút bên dưới để kích hoạt tài khoản SmartLab của bạn.'}
        </Typography>
        {!token && !account && <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>Link kích hoạt không hợp lệ, vui lòng mở lại từ email.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
        <Button
          fullWidth
          variant="contained"
          disabled={loading || (!token && !account)}
          onClick={account ? () => navigate('/login') : activate}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ bgcolor: '#0058be', py: 1.2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
        >
          {account ? 'Đăng nhập' : loading ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản'}
        </Button>
      </Paper>
    </Box>
  )
}
