import { useState } from 'react'
import {
  ArrowForward,
  Check,
  HelpOutlined,
  InfoOutlined,
  Language,
  LockOutlined,
  Memory,
  PersonOutlined,
  ShieldOutlined,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberLogin, setRememberLogin] = useState(true)
  const navigate = useNavigate()
  const { login } = useAuth()

  // Xử lý đăng nhập phân quyền theo tài khoản
  const handleSubmit = (event) => {
    event.preventDefault()
    const result = login(email, password)
    if (result.success) {
      navigate(result.user.defaultRoute)
    } else {
      navigate('/class-setup')
    }
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.03fr 0.97fr' },
        minHeight: '100vh',
        bgcolor: '#fff',
      }}
    >
      <Box
        component="section"
        aria-label="Giới thiệu SmartLabKit"
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: '40px 5.2vw', lg: '44px 5.2vw' },
          color: '#fff',
          background:
            'radial-gradient(ellipse at 78% 78%, rgba(0, 91, 177, 0.22), transparent 45%), linear-gradient(135deg, #124b89 0%, #0756a7 55%, #064b91 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.2) 42.2%, transparent 42.6%), linear-gradient(25deg, transparent 58%, rgba(255,255,255,0.16) 58.2%, transparent 58.6%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.6,
            position: 'relative',
          }}
        >
          <Memory sx={{ fontSize: 36, p: 0.3, bgcolor: '#1673d1', borderRadius: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 0.1 }}>
            SmartLabKit
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', maxWidth: 520, my: 5 }}>
          <Paper
            elevation={0}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              mb: 2.2,
              px: 1.2,
              py: 0.6,
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 1,
            }}
          >
            <ShieldOutlined sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Cổng truy cập SmartLabKit
            </Typography>
          </Paper>
          <Typography
            variant="h3"
            sx={{
              mb: 2,
              fontSize: { md: '2.15rem', lg: '2.45rem' },
              lineHeight: 1.13,
              fontWeight: 750,
              letterSpacing: -0.6,
            }}
          >
            Mỗi thiết bị đúng chỗ.
            <br />
            Mỗi yêu cầu đúng quy trình trên SmartLabKit.
          </Typography>
          <Typography
            sx={{
              mb: 2,
              maxWidth: 500,
              color: 'rgba(255,255,255,0.82)',
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            Truy cập không gian làm việc của bạn trên SmartLabKit để quản lý tồn
            kho, phê duyệt yêu cầu hoặc theo dõi lịch mượn trả.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {[
              'Phân quyền theo vai trò và đơn vị',
              'Lịch sử thao tác được lưu đầy đủ',
              'Dữ liệu SmartLabKit đồng bộ theo thời gian thực',
            ].map((item) => (
              <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Check
                  sx={{
                    p: 0.25,
                    fontSize: 20,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 0.5,
                  }}
                />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)' }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            px: 1.5,
            py: 1.3,
            color: '#fff',
            bgcolor: 'rgba(4,43,87,0.2)',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 1,
          }}
        >
          <LockOutlined sx={{ fontSize: 20 }} />
          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
              Kết nối an toàn
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.76)' }}>
              Phiên đăng nhập được bảo vệ và tự động kết thúc khi không hoạt động.
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh',
          px: { xs: 3, sm: 6, md: '6.5vw', lg: '6.5vw' },
          py: { xs: 3, sm: 4 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'center', md: 'flex-end' },
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2.5 },
            color: 'text.secondary',
          }}
        >
          <Typography
            variant="caption"
            sx={{ display: { xs: 'none', lg: 'block' }, whiteSpace: 'nowrap' }}
          >
            SmartLabKit - Hệ thống quản lý phòng lab
          </Typography>
          <Button
            size="small"
            color="inherit"
            startIcon={<HelpOutlined />}
            sx={{ minWidth: 0, whiteSpace: 'nowrap', fontSize: 11 }}
          >
            Cần hỗ trợ?
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<Language />}
            sx={{ minWidth: 0, whiteSpace: 'nowrap', fontSize: 11 }}
          >
            Tiếng Việt
          </Button>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 440, mx: 'auto', my: 5 }}>
          <Typography
            variant="h4"
            sx={{ mb: 0.8, color: '#172033', fontSize: 26, fontWeight: 750, lineHeight: 1.3 }}
          >
            Đăng nhập vào
            <br />
            SmartLabKit
          </Typography>

          <Box component="form" onSubmit={handleSubmit}>
            <Typography
              component="label"
              htmlFor="login-email"
              variant="caption"
              sx={{ display: 'block', mb: 0.6, color: '#263247', fontWeight: 700 }}
            >
              Email
            </Typography>
            <TextField
              id="login-email"
              fullWidth
              required
              type="email"
              placeholder="Nhập email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputProps={{ 'aria-label': 'Email' }}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1 },
                '& input': { py: 1, fontSize: 12 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlined sx={{ color: '#778195', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Typography
              component="label"
              htmlFor="login-password"
              variant="caption"
              sx={{ display: 'block', mb: 0.6, color: '#263247', fontWeight: 700 }}
            >
              Mật khẩu
            </Typography>
            <TextField
              id="login-password"
              fullWidth
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              inputProps={{ 'aria-label': 'Mật khẩu' }}
              sx={{
                '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1 },
                '& input': { py: 1, fontSize: 12 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: '#778195', fontSize: 17 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onClick={() => setShowPassword((visible) => !visible)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOff sx={{ fontSize: 17 }} />
                      ) : (
                        <Visibility sx={{ fontSize: 17 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 1,
                mb: 1.8,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberLogin}
                    onChange={(event) => setRememberLogin(event.target.checked)}
                    size="small"
                    sx={{ p: 0.5, mr: 0.4 }}
                  />
                }
                label="Ghi nhớ đăng nhập"
                sx={{
                  m: 0,
                  '& .MuiFormControlLabel-label': { color: 'text.secondary', fontSize: 10 },
                }}
              />
              <Button
                type="button"
                size="small"
                sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 10, fontWeight: 700 }}
              >
                Quên mật khẩu?
              </Button>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              endIcon={<ArrowForward />}
              sx={{
                minHeight: 39,
                borderRadius: 1,
                textTransform: 'none',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: 'none',
              }}
            >
              Đăng nhập
            </Button>

            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 2,
                p: 1.2,
                bgcolor: '#faf9ff',
                border: '1px solid #e5e5f2',
                borderRadius: 1,
              }}
            >
              <InfoOutlined sx={{ color: 'primary.main', fontSize: 17, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, lineHeight: 1.6 }}>
                Chưa có tài khoản SmartLabKit? Liên hệ lab staff hoặc quản trị viên của đơn vị để được cấp quyền.
              </Typography>
            </Paper>
          </Box>
        </Box>

        <Box
          component="footer"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            color: '#81899a',
            fontSize: 10,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 10 }}>
            © 2026 SmartLabKit
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 } }}>
            <Button size="small" color="inherit" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 10 }}>
              Quyền riêng tư
            </Button>
            <Button size="small" color="inherit" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 10 }}>
              Điều khoản sử dụng
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Login
