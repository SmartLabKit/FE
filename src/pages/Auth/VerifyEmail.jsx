import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material'
import {
  MarkEmailReadOutlined,
  CheckCircle,
  ArrowForward,
  Refresh,
} from '@mui/icons-material'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authService } from '../../services/authService'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(60)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  // Đếm ngược 60s cho việc gửi lại mã xác thực
  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])

  const canResend = cooldown <= 0

  // Xử lý xác thực email POST /api/auth/verify-email
  const handleVerify = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email')
      return
    }
    if (!code.trim() || code.trim().length !== 6) {
      setErrorMsg('Mã xác thực phải gồm 6 chữ số')
      return
    }

    setLoading(true)
    try {
      await authService.verifyEmail({
        email: email.trim(),
        code: code.trim(),
      })

      setIsVerified(true)
      setSuccessMsg('Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay.')
    } catch (err) {
      setErrorMsg(err.message || 'Mã xác thực không đúng hoặc đã hết hạn')
    } finally {
      setLoading(false)
    }
  }

  // Xử lý gửi lại mã xác thực POST /api/auth/resend-verification
  const handleResend = async () => {
    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập email để nhận mã')
      return
    }

    setResending(true)
    setErrorMsg('')
    try {
      await authService.resendVerification({ email: email.trim() })
      setSuccessMsg('Mã xác thực mới đã được gửi tới email của bạn')
      setCooldown(60)
    } catch (err) {
      setErrorMsg(err.message || 'Không thể gửi lại mã')
    } finally {
      setResending(false)
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
          maxWidth: 460,
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
            width: 60,
            height: 60,
            borderRadius: 2.5,
            bgcolor: isVerified ? '#ecfdf5' : '#eaedff',
            color: isVerified ? '#059669' : '#0058be',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          {isVerified ? (
            <CheckCircle sx={{ fontSize: 34 }} />
          ) : (
            <MarkEmailReadOutlined sx={{ fontSize: 32 }} />
          )}
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
          {isVerified ? 'Tài khoản đã xác thực!' : 'Xác thực tài khoản Email'}
        </Typography>

        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 3 }}>
          {isVerified
            ? 'Email của bạn đã được xác minh thành công. Hãy đăng nhập để truy cập kho linh kiện.'
            : 'Hệ thống đã gửi mã xác thực 6 chữ số tới hòm thư của bạn.'}
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5, textAlign: 'left', fontSize: 13 }}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5, textAlign: 'left', fontSize: 13 }}>
            {successMsg}
          </Alert>
        )}

        {isVerified ? (
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
            Đăng nhập vào hệ thống
          </Button>
        ) : (
          <Box component="form" onSubmit={handleVerify} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="email"
              label="Email đã đăng ký"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />

            <TextField
              fullWidth
              size="medium"
              label="Mã xác thực 6 số"
              placeholder="VD: 123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  style: { textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: 8 },
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fafbff' },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading || code.length !== 6}
              startIcon={loading && <CircularProgress size={16} color="inherit" />}
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
              {loading ? 'Đang kiểm tra...' : 'Xác thực email'}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#6b7280' }}>
                Chưa nhận được mã?
              </Typography>
              <Button
                size="small"
                variant="text"
                disabled={!canResend || resending}
                onClick={handleResend}
                startIcon={resending ? <CircularProgress size={12} /> : <Refresh fontSize="small" />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0058be', p: 0.5 }}
              >
                {canResend ? 'Gửi lại mã' : `Gửi lại sau (${cooldown}s)`}
              </Button>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 12 }}>
              <Link to="/login" style={{ color: '#0058be', fontWeight: 700, textDecoration: 'none' }}>
                Quay lại Đăng nhập
              </Link>
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
