import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Avatar,
  CircularProgress,
  Checkbox,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Engineering as StaffIcon,
  Inventory as InventoryIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as ActiveIcon,
  Block as BlockIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { userService } from '../../services/userService'

// Danh sách vai trò hệ thống
const SYSTEM_ROLES = [
  { value: 'Admin', label: 'Quản trị viên (Admin)', color: '#0058be', icon: <AdminIcon fontSize="small" /> },
  { value: 'LabStaff', label: 'Cán bộ Lab (LabStaff)', color: '#7c3aed', icon: <StaffIcon fontSize="small" /> },
  { value: 'InventoryManager', label: 'Quản lý kho (InventoryManager)', color: '#0d9488', icon: <InventoryIcon fontSize="small" /> },
  { value: 'Lecturer', label: 'Giảng viên (Lecturer)', color: '#0284c7', icon: <SchoolIcon fontSize="small" /> },
  { value: 'Student', label: 'Sinh viên (Student)', color: '#059669', icon: <PersonIcon fontSize="small" /> },
]

export default function Users() {
  // State danh sách người dùng & phân trang
  const [users, setUsers] = useState([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(0) // 0-indexed cho MUI
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  // State bộ lọc tìm kiếm
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  // State Modal Tạo người dùng
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    role: 'LabStaff',
    instructorCode: '',
    academicTitle: 'Giảng viên',
  })
  const [createErrors, setCreateErrors] = useState({})

  // State Modal Chi tiết & Gán Role
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [assignedRoles, setAssignedRoles] = useState([])
  const [roleSubmitting, setRoleSubmitting] = useState(false)

  // Notification Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  // Tải danh sách người dùng từ API
  const fetchUsers = () => {
    setLoading(true)
    userService
      .getUsers({
        search,
        role: selectedRole,
        isActive: selectedStatus === '' ? undefined : selectedStatus === 'active',
        page: page + 1,
        size: pageSize,
      })
      .then((data) => {
        if (data) {
          setUsers(data.items || [])
          setTotalItems(data.totalItems || 0)
        }
      })
      .catch((err) => {
        showToast(err.message, 'error')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    let ignore = false
    setLoading(true)
    userService
      .getUsers({
        search,
        role: selectedRole,
        isActive: selectedStatus === '' ? undefined : selectedStatus === 'active',
        page: page + 1,
        size: pageSize,
      })
      .then((data) => {
        if (!ignore && data) {
          setUsers(data.items || [])
          setTotalItems(data.totalItems || 0)
        }
      })
      .catch((err) => {
        if (!ignore) showToast(err.message, 'error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [search, selectedRole, selectedStatus, page, pageSize])

  // Xử lý thay đổi trang
  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setPageSize(parseInt(event.target.value, 10))
    setPage(0)
  }

  // Mở modal tạo người dùng
  const handleOpenCreateDialog = () => {
    setCreateForm({
      username: '',
      email: '',
      password: '',
      fullName: '',
      phoneNumber: '',
      role: 'LabStaff',
      instructorCode: '',
      academicTitle: 'Giảng viên',
    })
    setCreateErrors({})
    setCreateDialogOpen(true)
  }

  // Validate form tạo tài khoản
  const validateCreateForm = () => {
    const errors = {}
    if (!createForm.username.trim()) errors.username = 'Tên đăng nhập không được để trống'
    if (!createForm.email.trim()) errors.email = 'Email không được để trống'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Email không đúng định dạng'
    if (!createForm.password) errors.password = 'Mật khẩu không được để trống'
    else if (createForm.password.length < 6) errors.password = 'Mật khẩu tối thiểu 6 ký tự'
    if (!createForm.fullName.trim()) errors.fullName = 'Họ và tên không được để trống'

    if (createForm.role === 'Lecturer' && !createForm.instructorCode.trim()) {
      errors.instructorCode = 'Mã giảng viên không được để trống'
    }

    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Gửi tạo tài khoản
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!validateCreateForm()) return

    setCreateSubmitting(true)
    try {
      await userService.createUser(createForm)
      showToast('Tạo tài khoản mới thành công!', 'success')
      setCreateDialogOpen(false)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Mở modal xem chi tiết & gán vai trò
  const handleOpenRoleDialog = (user) => {
    setSelectedUser(user)
    setAssignedRoles(user.roles || [])
    setRoleDialogOpen(true)
  }

  // Lưu phân quyền vai trò
  const handleSaveRoles = async () => {
    if (!selectedUser) return
    if (assignedRoles.length === 0) {
      showToast('Người dùng phải có ít nhất 1 vai trò', 'warning')
      return
    }

    setRoleSubmitting(true)
    try {
      await userService.assignRoles(selectedUser.userId, assignedRoles)
      showToast(`Đã cập nhật vai trò cho ${selectedUser.fullName || selectedUser.username}`, 'success')
      setRoleDialogOpen(false)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRoleSubmitting(false)
    }
  }

  // Lấy màu badge cho role
  const getRoleBadge = (roleName) => {
    const found = SYSTEM_ROLES.find((r) => r.value.toLowerCase() === (roleName || '').toLowerCase())
    return found ? found.color : '#0058be'
  }

  return (
    <PortalLayout
      headerTitle="Quản lý Người dùng & Tài khoản"
      headerSubtitle="Quản lý danh sách tài khoản, trạng thái hoạt động và phân bổ vai trò hệ thống"
    >
      <Container maxWidth="xl" disableGutters sx={{ py: 1 }}>
        {/* Thanh công cụ tìm kiếm và bộ lọc */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e4e6ef',
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Bộ lọc bên trái */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, flexGrow: 1 }}>
              <TextField
                size="small"
                placeholder="Tìm theo họ tên, email, username..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                sx={{
                  minWidth: { xs: '100%', sm: 260 },
                  '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#81899a', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearch('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />

              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel sx={{ fontSize: 13 }}>Vai trò</InputLabel>
                <Select
                  value={selectedRole}
                  label="Vai trò"
                  onChange={(e) => {
                    setSelectedRole(e.target.value)
                    setPage(0)
                  }}
                  sx={{ borderRadius: 1.5, fontSize: 13 }}
                >
                  <MenuItem value="">
                    <em>Tất cả vai trò</em>
                  </MenuItem>
                  {SYSTEM_ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value} sx={{ fontSize: 13 }}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ fontSize: 13 }}>Trạng thái</InputLabel>
                <Select
                  value={selectedStatus}
                  label="Trạng thái"
                  onChange={(e) => {
                    setSelectedStatus(e.target.value)
                    setPage(0)
                  }}
                  sx={{ borderRadius: 1.5, fontSize: 13 }}
                >
                  <MenuItem value="">
                    <em>Tất cả trạng thái</em>
                  </MenuItem>
                  <MenuItem value="active" sx={{ fontSize: 13 }}>
                    Đang hoạt động
                  </MenuItem>
                  <MenuItem value="inactive" sx={{ fontSize: 13 }}>
                    Đã khóa
                  </MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={fetchUsers}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: 12,
                  borderColor: '#dcdfe6',
                  color: '#424754',
                }}
              >
                Làm mới
              </Button>
            </Box>

            {/* Nút thêm mới bên phải */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
              sx={{
                bgcolor: '#0058be',
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                px: 2.2,
                py: 1,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#004aa6' },
              }}
            >
              Thêm tài khoản
            </Button>
          </Box>
        </Paper>

        {/* Bảng danh sách người dùng */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e4e6ef',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table sx={{ minWidth: 750 }}>
              <TableHead sx={{ bgcolor: '#fafbff' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>NGƯỜI DÙNG</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>EMAIL & LIÊN HỆ</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>VAI TRÒ (ROLES)</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>TRẠNG THÁI</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>ĐĂNG NHẬP CUỐI</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#424754' }}>
                    THAO TÁC
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0058be' }} />
                      <Typography variant="body2" sx={{ mt: 1.5, color: '#6b7280' }}>
                        Đang tải danh sách người dùng...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <PersonIcon sx={{ fontSize: 44, color: '#c2c6d6', mb: 1 }} />
                      <Typography variant="subtitle2" sx={{ color: '#131b2e', fontWeight: 700 }}>
                        Không tìm thấy người dùng phù hợp
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>
                        Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((item) => (
                    <TableRow
                      key={item.userId}
                      hover
                      sx={{
                        '&:hover': { bgcolor: '#fbfcfe' },
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {/* Cột User Info */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: getRoleBadge(item.roles?.[0]),
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            {(item.fullName || item.username || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700, color: '#131b2e', fontSize: 13 }}
                            >
                              {item.fullName || 'Chưa cập nhật tên'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                              @{item.username}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Cột Email & SĐT */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 13, color: '#131b2e' }}>
                          {item.email}
                        </Typography>
                        {item.phoneNumber && (
                          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                            {item.phoneNumber}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Cột Roles */}
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                          {(item.roles || []).map((r) => {
                            const badgeColor = getRoleBadge(r)
                            return (
                              <Chip
                                key={r}
                                label={r}
                                size="small"
                                sx={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  height: 22,
                                  bgcolor: `${badgeColor}15`,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}30`,
                                }}
                              />
                            )
                          })}
                        </Box>
                      </TableCell>

                      {/* Cột Trạng thái */}
                      <TableCell>
                        {item.isActive ? (
                          <Chip
                            icon={<ActiveIcon sx={{ '&&': { color: '#059669', fontSize: 14 } }} />}
                            label="Hoạt động"
                            size="small"
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              height: 22,
                              bgcolor: '#ecfdf5',
                              color: '#059669',
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<BlockIcon sx={{ '&&': { color: '#ef4444', fontSize: 14 } }} />}
                            label="Đã khóa"
                            size="small"
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              height: 22,
                              bgcolor: '#fef2f2',
                              color: '#ef4444',
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Cột Đăng nhập lần cuối */}
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#424754', fontSize: 12 }}>
                          {item.lastLoginAt
                            ? new Date(item.lastLoginAt).toLocaleString('vi-VN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Chưa từng đăng nhập'}
                        </Typography>
                      </TableCell>

                      {/* Cột Thao tác */}
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SecurityIcon fontSize="small" />}
                          onClick={() => handleOpenRoleDialog(item)}
                          sx={{
                            borderRadius: 1.5,
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            borderColor: '#0058be30',
                            color: '#0058be',
                            bgcolor: '#0058be08',
                            '&:hover': { bgcolor: '#0058be15', borderColor: '#0058be' },
                          }}
                        >
                          Phân vai trò
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Phân trang */}
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="Số dòng mỗi trang:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`}
            sx={{ borderTop: '1px solid #f0f2f5' }}
          />
        </Paper>

        {/* Dialog 1: Tạo tài khoản mới */}
        <Dialog
          open={createDialogOpen}
          onClose={() => !createSubmitting && setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2.5 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontSize: 17, color: '#131b2e', pb: 1 }}>
            Tạo tài khoản người dùng mới
          </DialogTitle>
          <Divider />
          <Box component="form" onSubmit={handleCreateSubmit}>
            <DialogContent sx={{ py: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#6b7280', mb: 2, display: 'block' }}>
                Cấp tài khoản vận hành cho Cán bộ Lab, Cán bộ kho hoặc Giảng viên.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Vai trò gán ban đầu *</InputLabel>
                  <Select
                    value={createForm.role}
                    label="Vai trò gán ban đầu *"
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    <MenuItem value="LabStaff">Cán bộ Phòng Lab (LabStaff)</MenuItem>
                    <MenuItem value="InventoryManager">Quản lý kho linh kiện (InventoryManager)</MenuItem>
                    <MenuItem value="Lecturer">Giảng viên bộ môn (Lecturer)</MenuItem>
                    <MenuItem value="Admin">Quản trị viên hệ thống (Admin)</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Tên đăng nhập (Username) *"
                    size="small"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    error={Boolean(createErrors.username)}
                    helperText={createErrors.username}
                  />
                  <TextField
                    label="Email liên kết *"
                    size="small"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    error={Boolean(createErrors.email)}
                    helperText={createErrors.email}
                  />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Họ và tên *"
                    size="small"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    error={Boolean(createErrors.fullName)}
                    helperText={createErrors.fullName}
                  />
                  <TextField
                    label="Số điện thoại"
                    size="small"
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                  />
                </Box>

                <TextField
                  label="Mật khẩu khởi tạo *"
                  size="small"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  error={Boolean(createErrors.password)}
                  helperText={createErrors.password || 'Mật khẩu tạm thời để người dùng đăng nhập lần đầu'}
                />

                {/* Nếu chọn Giảng viên, bổ sung trường Mã giảng viên & Học hàm */}
                {createForm.role === 'Lecturer' && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#f0f9ff',
                      borderRadius: 1.5,
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0369a1' }}>
                      THÔNG TIN GIẢNG VIÊN (INSTRUCTOR PROFILE)
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                      <TextField
                        label="Mã giảng viên *"
                        size="small"
                        placeholder="VD: INS089"
                        value={createForm.instructorCode}
                        onChange={(e) => setCreateForm({ ...createForm, instructorCode: e.target.value })}
                        error={Boolean(createErrors.instructorCode)}
                        helperText={createErrors.instructorCode}
                      />
                      <FormControl size="small">
                        <InputLabel>Học hàm / Học vị</InputLabel>
                        <Select
                          value={createForm.academicTitle}
                          label="Học hàm / Học vị"
                          onChange={(e) => setCreateForm({ ...createForm, academicTitle: e.target.value })}
                        >
                          <MenuItem value="Giảng viên">Giảng viên</MenuItem>
                          <MenuItem value="Thạc sĩ">Thạc sĩ</MenuItem>
                          <MenuItem value="Tiến sĩ">Tiến sĩ</MenuItem>
                          <MenuItem value="Phó Giáo sư">Phó Giáo sư</MenuItem>
                          <MenuItem value="Giáo sư">Giáo sư</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                )}
              </Box>
            </DialogContent>

            <Divider />
            <DialogActions sx={{ px: 3, py: 1.5 }}>
              <Button
                onClick={() => setCreateDialogOpen(false)}
                disabled={createSubmitting}
                sx={{ textTransform: 'none', color: '#6b7280' }}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createSubmitting}
                startIcon={createSubmitting && <CircularProgress size={16} color="inherit" />}
                sx={{
                  bgcolor: '#0058be',
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#004aa6' },
                }}
              >
                {createSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        {/* Dialog 2: Chi tiết người dùng & Phân vai trò */}
        <Dialog
          open={roleDialogOpen}
          onClose={() => !roleSubmitting && setRoleDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2.5 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontSize: 17, color: '#131b2e', pb: 1 }}>
            Phân vai trò người dùng
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ py: 2.5 }}>
            {selectedUser && (
              <Box>
                {/* User Info Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: '#fafbff',
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    mb: 2.5,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: getRoleBadge(selectedUser.roles?.[0]),
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    {(selectedUser.fullName || selectedUser.username || 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e' }}>
                      {selectedUser.fullName || selectedUser.username}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 12 }}>
                      {selectedUser.email} • @{selectedUser.username}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#263247' }}>
                  Chọn các vai trò áp dụng cho tài khoản:
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280', mb: 2, display: 'block' }}>
                  Lưu ý: Thao tác này sẽ cập nhật toàn bộ quyền tương ứng của vai trò cho người dùng.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {SYSTEM_ROLES.map((role) => {
                    const isChecked = assignedRoles.includes(role.value)
                    return (
                      <Paper
                        key={role.value}
                        elevation={0}
                        onClick={() => {
                          if (isChecked) {
                            setAssignedRoles(assignedRoles.filter((r) => r !== role.value))
                          } else {
                            setAssignedRoles([...assignedRoles, role.value])
                          }
                        }}
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: `1.5px solid ${isChecked ? role.color : '#e4e6ef'}`,
                          bgcolor: isChecked ? `${role.color}08` : '#ffffff',
                          borderRadius: 2,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': { borderColor: role.color },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          <Checkbox
                            checked={isChecked}
                            size="small"
                            sx={{ color: '#c2c6d6', '&.Mui-checked': { color: role.color } }}
                          />
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: isChecked ? role.color : '#131b2e',
                              }}
                            >
                              {role.label}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={role.value}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 800,
                            bgcolor: `${role.color}18`,
                            color: role.color,
                          }}
                        />
                      </Paper>
                    )
                  })}
                </Box>
              </Box>
            )}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button
              onClick={() => setRoleDialogOpen(false)}
              disabled={roleSubmitting}
              sx={{ textTransform: 'none', color: '#6b7280' }}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveRoles}
              disabled={roleSubmitting}
              startIcon={roleSubmitting && <CircularProgress size={16} color="inherit" />}
              sx={{
                bgcolor: '#0058be',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#004aa6' },
              }}
            >
              {roleSubmitting ? 'Đang lưu...' : 'Lưu vai trò'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast thông báo */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
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
