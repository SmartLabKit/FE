import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  Avatar,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material'
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Save as SaveIcon,
  School as SchoolIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [activeTab, setActiveTab] = useState(0)
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Form thông tin cá nhân
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phoneNumber: '',
    avatarUrl: '',
  })

  // Form đổi mật khẩu
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState({})

  // Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  // Tải thông tin người dùng từ GET /api/auth/me
  useEffect(() => {
    let isMounted = true

    authService
      .getMe()
      .then((data) => {
        if (!isMounted || !data) return
        setProfileForm({
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber || '',
          avatarUrl: data.avatarUrl || '',
        })
      })
      .catch(() => {
        if (isMounted && user) {
          setProfileForm({
            fullName: user.fullName || user.name || '',
            phoneNumber: user.phoneNumber || '',
            avatarUrl: user.avatarUrl || '',
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [user])

  // Lưu thông tin cá nhân PUT /api/auth/me
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileForm.fullName.trim()) {
      showToast('Họ và tên không được để trống', 'warning')
      return
    }

    setProfileSaving(true)
    try {
      const updated = await authService.updateProfile({
        fullName: profileForm.fullName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        avatarUrl: profileForm.avatarUrl.trim(),
      })

      updateUser(updated)
      showToast('Cập nhật thông tin cá nhân thành công!', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  // Đổi mật khẩu PUT /api/auth/me/password
  const handleChangePassword = async (e) => {
    e.preventDefault()
    const errors = {}

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại'
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới'
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Mật khẩu mới tối thiểu 6 ký tự'
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Xác nhận mật khẩu mới không khớp'
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }
    setPasswordErrors({})

    setPasswordSaving(true)
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      showToast('Đổi mật khẩu thành công!', 'success')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setPasswordSaving(false)
    }
  }

  const currentUser = user || {}
  const primaryRole = (currentUser.roles && currentUser.roles[0]) || currentUser.roleLabel || 'ADMIN'

  return (
    <PortalLayout
      headerTitle="Hồ sơ cá nhân & Bảo mật"
      headerSubtitle="Quản lý thông tin định danh tài khoản và cập nhật mật khẩu đăng nhập"
    >
      <Container maxWidth="md" disableGutters sx={{ py: 1 }}>
        {/* Banner thông tin tài khoản */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e4e6ef',
            borderRadius: 2.5,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={profileForm.avatarUrl || currentUser.avatarUrl}
              sx={{
                width: 64,
                height: 64,
                bgcolor: currentUser.avatarBg || '#0058be',
                fontSize: 22,
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(0, 88, 190, 0.2)',
              }}
            >
              {(profileForm.fullName || currentUser.name || 'U').charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', lineHeight: 1.2 }}>
                {profileForm.fullName || currentUser.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mt: 0.3 }}>
                {currentUser.email} • @{currentUser.username}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
                {(currentUser.roles || [primaryRole]).map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10,
                      fontWeight: 800,
                      bgcolor: '#0058be15',
                      color: '#0058be',
                    }}
                  />
                ))}
                {currentUser.studentCode && (
                  <Chip
                    icon={<SchoolIcon sx={{ '&&': { fontSize: 13, color: '#059669' } }} />}
                    label={`MSSV: ${currentUser.studentCode}`}
                    size="small"
                    sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#ecfdf5', color: '#059669' }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Tab chuyển đổi mục Cài đặt */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e4e6ef',
            borderRadius: 2,
            mb: 3,
            px: 2,
            pt: 1,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            sx={{
              minHeight: 46,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                minHeight: 46,
                color: '#6b7280',
              },
              '& .Mui-selected': { color: '#0058be' },
              '& .MuiTabs-indicator': { height: 3, borderRadius: 1.5, bgcolor: '#0058be' },
            }}
          >
            <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Thông tin cá nhân" />
            <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label="Đổi mật khẩu & Bảo mật" />
          </Tabs>
        </Paper>

        {/* TAB 1: THÔNG TIN CÁ NHÂN */}
        {activeTab === 0 && (
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleSaveProfile}
            sx={{
              p: 3.5,
              bgcolor: '#ffffff',
              border: '1px solid #e4e6ef',
              borderRadius: 2.5,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', mb: 0.5 }}>
              Cập nhật thông tin hồ sơ
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 3 }}>
              Thông tin này được hiển thị trong phiếu mượn thiết bị và lịch sử thao tác hệ thống.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                <TextField
                  label="Họ và tên *"
                  fullWidth
                  size="small"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <TextField
                  label="Số điện thoại"
                  fullWidth
                  size="small"
                  value={profileForm.phoneNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                <TextField
                  label="Địa chỉ Email"
                  fullWidth
                  size="small"
                  disabled
                  value={currentUser.email || ''}
                  helperText="Email định danh không thể tự thay đổi"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <TextField
                  label="Tên đăng nhập (Username)"
                  fullWidth
                  size="small"
                  disabled
                  value={currentUser.username || ''}
                  helperText="Tên đăng nhập hệ thống"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Box>

              <TextField
                label="Đường dẫn ảnh đại diện (Avatar URL)"
                fullWidth
                size="small"
                placeholder="https://example.com/avatar.jpg"
                value={profileForm.avatarUrl}
                onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                helperText="Dán liên kết ảnh trực tuyến để thay đổi avatar đại diện"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />

              {/* Danh sách quyền hạn hiện tại */}
              <Box sx={{ p: 2, bgcolor: '#fafbff', borderRadius: 2, border: '1px solid #e4e6ef' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#424754', display: 'block', mb: 1 }}>
                  QUYỀN HẠN ĐƯỢC CẤP ({currentUser.permissions?.length || 0})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {(currentUser.permissions || []).map((perm) => (
                    <Chip
                      key={perm}
                      label={perm}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: '#ffffff',
                        border: '1px solid #dcdfe6',
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={profileSaving}
                  startIcon={profileSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  sx={{
                    bgcolor: '#0058be',
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    px: 3,
                    py: 1,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#004aa6' },
                  }}
                >
                  {profileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* TAB 2: ĐỔI MẬT KHẨU */}
        {activeTab === 1 && (
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleChangePassword}
            sx={{
              p: 3.5,
              bgcolor: '#ffffff',
              border: '1px solid #e4e6ef',
              borderRadius: 2.5,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', mb: 0.5 }}>
              Thay đổi mật khẩu tài khoản
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 3 }}>
              Để bảo vệ tài khoản, bạn cần nhập đúng mật khẩu hiện tại trước khi tạo mật khẩu mới.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 500 }}>
              <TextField
                label="Mật khẩu hiện tại *"
                fullWidth
                size="small"
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                error={Boolean(passwordErrors.currentPassword)}
                helperText={passwordErrors.currentPassword}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                        >
                          {showCurrentPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                label="Mật khẩu mới *"
                fullWidth
                size="small"
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                error={Boolean(passwordErrors.newPassword)}
                helperText={passwordErrors.newPassword || 'Mật khẩu tối thiểu 6 ký tự'}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                        >
                          {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                label="Xác nhận mật khẩu mới *"
                fullWidth
                size="small"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                error={Boolean(passwordErrors.confirmPassword)}
                helperText={passwordErrors.confirmPassword}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={passwordSaving}
                  startIcon={passwordSaving ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
                  sx={{
                    bgcolor: '#0058be',
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    px: 3,
                    py: 1,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#004aa6' },
                  }}
                >
                  {passwordSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Thông báo Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={3500}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setToast({ ...toast, open: false })}
            severity={toast.severity}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Container>
    </PortalLayout>
  )
}
