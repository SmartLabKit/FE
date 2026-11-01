import { useState } from 'react'
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material'
import {
  Key,
  Visibility,
  VisibilityOff,
  CheckCircle,
  ArrowForward,
} from '@mui/icons-material'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authService } from '../../services/authService'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDone, setIsDone] = useState(false)

  // Xử lý gửi đặt lại mật khẩu POST /api/auth/reset-password
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email')
      return
    }
    if (!code.trim() || code.trim().length !== 6) {
      setErrorMsg('Mã xác thực gồm 6 chữ số')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword: newPassword,
      })

      setIsDone(true)
    } catch (err) {
      setErrorMsg(err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4.5 },
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e4e6ef',
          boxShadow: '0 4px 20px rgba(0, 88, 190, 0.06)',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2.5,
            bgcolor: isDone ? '#ecfdf5' : '#eaedff',
            color: isDone ? '#059669' : '#0058be',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          {isDone ? <CheckCircle sx={{ fontSize: 32 }} /> : <Key sx={{ fontSize: 30 }} />}
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
          {isDone ? 'Đặt lại mật khẩu thành công!' : 'Tạo mật khẩu mới'}
        </Typography>

        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 3 }}>
          {isDone
            ? 'Mật khẩu tài khoản của bạn đã được cập nhật thành công. Hãy sử dụng mật khẩu mới để đăng nhập.'
            : 'Nhập mã 6 số đã được gửi tới email và mật khẩu mới bạn muốn thiết lập.'}
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5, textAlign: 'left', fontSize: 13 }}>
            {errorMsg}
          </Alert>
        )}

        {isDone ? (
          <Button
            fullWidth
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={() => navigate('/login')}
            sx={{
              bgcolor: '#0058be',
              py: 1.2,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#004aa6' },
            }}
          >
            Đăng nhập ngay
          </Button>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="email"
              label="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />

            <TextField
              fullWidth
              size="small"
              label="Mã xác thực 6 số *"
              placeholder="VD: 123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  style: { textAlign: 'center', fontSize: 18, fontWeight: 700, letterSpacing: 4 },
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />

            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              label="Mật khẩu mới *"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword((p) => !p)}>
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              size="small"
              type="password"
              label="Xác nhận mật khẩu mới *"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowForward />}
              sx={{
                bgcolor: '#0058be',
                py: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#004aa6' },
              }}
            >
              {loading ? 'Đang cập nhật...' : 'Xác nhận đặt lại mật khẩu'}
            </Button>

            <Box sx={{ mt: 1 }}>
              <Link to="/login" style={{ color: '#0058be', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Quay lại Đăng nhập
              </Link>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
