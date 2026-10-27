import { useState } from 'react'
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  LockReset,
  ArrowForward,
  ArrowBack,
} from '@mui/icons-material'
import { useNavigate, Link } from 'react-router-dom'
import { authService } from '../../services/authService'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Gửi yêu cầu đặt lại mật khẩu POST /api/auth/forgot-password
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email của bạn')
      return
    }

    setLoading(true)
    try {
      await authService.forgotPassword({ email: email.trim() })
      // Thành công, chuyển tiếp tới màn hình nhập mã và mật khẩu mới
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      setErrorMsg(err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu')
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
            bgcolor: '#eaedff',
            color: '#0058be',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <LockReset sx={{ fontSize: 32 }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
          Quên mật khẩu?
        </Typography>

        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 3 }}>
          Nhập địa chỉ email liên kết với tài khoản SmartLabKit của bạn. Chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu.
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5, textAlign: 'left', fontSize: 13 }}>
            {errorMsg}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
          <TextField
            fullWidth
            size="small"
            type="email"
            label="Địa chỉ Email của bạn *"
            placeholder="VD: user@smartlabkit.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
          </Button>

          <Box sx={{ mt: 1 }}>
            <Link
              to="/login"
              style={{
                color: '#6b7280',
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ArrowBack sx={{ fontSize: 16 }} /> Quay lại Đăng nhập
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
