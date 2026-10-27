import { useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  MenuItem,
} from '@mui/material'
import {
  Memory,
  Visibility,
  VisibilityOff,
  ArrowForward,
  CheckCircleOutlined,
} from '@mui/icons-material'
import { useNavigate, Link } from 'react-router-dom'
import { authService } from '../../services/authService'

// Danh sách chuyên ngành mẫu
const MAJORS = [
  'Kỹ thuật Phần mềm (Software Engineering)',
  'Khoa học Máy tính (Computer Science)',
  'An toàn Thông tin (Information Security)',
  'Hệ thống IoT & Nhúng (IoT & Embedded Systems)',
  'Trí tuệ Nhân tạo (Artificial Intelligence)',
  'Mạng Máy tính & Truyền thông (Network)',
]

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    studentCode: '',
    major: MAJORS[0],
    cohort: 'K18',
    password: '',
    confirmPassword: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Kiểm tra tính hợp lệ của biểu mẫu
  const validate = () => {
    const errors = {}
    if (!form.username.trim()) errors.username = 'Vui lòng nhập tên đăng nhập'
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email trường'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email không hợp lệ'
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên'
    if (!form.studentCode.trim()) errors.studentCode = 'Vui lòng nhập mã sinh viên (MSSV)'
    if (!form.password) errors.password = 'Vui lòng nhập mật khẩu'
    else if (form.password.length < 6) errors.password = 'Mật khẩu tối thiểu 6 ký tự'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận không khớp'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Xử lý gửi đăng ký tài khoản sinh viên
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!validate()) return

    setLoading(true)
    try {
      await authService.register({
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        studentCode: form.studentCode.trim().toUpperCase(),
        major: form.major,
        cohort: form.cohort,
        password: form.password,
      })

      // Đăng ký thành công, chuyển tới bước xác thực email
      navigate(`/verify-email?email=${encodeURIComponent(form.email.trim())}`)
    } catch (err) {
      setErrorMsg(err.message || 'Đăng ký tài khoản không thành công')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        minHeight: '100vh',
        bgcolor: '#ffffff',
      }}
    >
      {/* Banner bên trái */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: '40px 5vw', lg: '48px 5vw' },
          color: '#ffffff',
          background:
            'radial-gradient(ellipse at 80% 80%, rgba(0, 91, 177, 0.25), transparent 45%), linear-gradient(135deg, #124b89 0%, #0756a7 55%, #064b91 100%)',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Memory sx={{ fontSize: 36, p: 0.3, bgcolor: '#1673d1', borderRadius: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            SmartLabKit
          </Typography>
        </Box>

        <Box sx={{ my: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 2, fontSize: '2.2rem' }}>
            Đăng ký tài khoản
            <br />
            Sinh viên thực hành
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.8, maxWidth: 460, mb: 3 }}>
            Tạo tài khoản sinh viên để đăng ký bộ kit linh kiện môn học, kết nối nhóm đồ án và gửi yêu cầu mượn thiết bị phòng lab.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[
              'Nhận mã xác thực 6 số gửi qua email trường',
              'Truy cập danh mục hàng trăm linh kiện và kit nhúng',
              'Theo dõi hạn mượn và phiếu bàn giao theo thời gian thực',
            ].map((text) => (
              <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <CheckCircleOutlined sx={{ fontSize: 18, color: '#60a5fa' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)', fontSize: 13 }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
          © 2026 SmartLabKit • Hệ thống quản lý phòng Lab thông minh
        </Typography>
      </Box>

      {/* Form đăng ký bên phải */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 6, md: 5, lg: 7 },
          py: 4,
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 480 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Đăng ký tài khoản
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 3 }}>
            Điền thông tin sinh viên để bắt đầu mượn kit thí nghiệm
          </Typography>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5, fontSize: 13 }}>
              {errorMsg}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                label="Tên đăng nhập *"
                placeholder="VD: namlh_se"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
              />
              <TextField
                fullWidth
                size="small"
                label="Mã số sinh viên (MSSV) *"
                placeholder="VD: SE160245"
                value={form.studentCode}
                onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
                error={Boolean(fieldErrors.studentCode)}
                helperText={fieldErrors.studentCode}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
              />
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Họ và tên *"
              placeholder="Nguyễn Văn An"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              error={Boolean(fieldErrors.fullName)}
              helperText={fieldErrors.fullName}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
            />

            <TextField
              fullWidth
              size="small"
              type="email"
              label="Email sinh viên *"
              placeholder="annvse160245@fpt.edu.vn"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email || 'Mã xác thực 6 số sẽ được gửi tới email này'}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 1.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Chuyên ngành"
                value={form.major}
                onChange={(e) => setForm({ ...form, major: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
              >
                {MAJORS.map((m) => (
                  <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                label="Khóa học"
                value={form.cohort}
                onChange={(e) => setForm({ ...form, cohort: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
              >
                {['K16', 'K17', 'K18', 'K19', 'K20'].map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                type={showPassword ? 'text' : 'password'}
                label="Mật khẩu *"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
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
                label="Xác nhận mật khẩu *"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                error={Boolean(fieldErrors.confirmPassword)}
                helperText={fieldErrors.confirmPassword}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.2 } }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowForward />}
              sx={{
                mt: 1.5,
                bgcolor: '#0058be',
                borderRadius: 1.2,
                py: 1.1,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#004aa6' },
              }}
            >
              {loading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản sinh viên'}
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13 }}>
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                style={{ color: '#0058be', fontWeight: 700, textDecoration: 'none' }}
              >
                Đăng nhập ngay
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
