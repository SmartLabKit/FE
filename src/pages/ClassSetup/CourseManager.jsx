import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as CourseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'

/**
 * CourseManager Component: Quản lý danh mục môn học (Admin / Lab Staff)
 * Gắn các API:
 * - GET /api/courses
 * - POST /api/courses
 * - GET /api/courses/{id}
 * - PUT /api/courses/{id}
 * - DELETE /api/courses/{id}
 */
export default function CourseManager() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // State Modal Thêm / Sửa môn học
  const [openModal, setOpenModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [form, setForm] = useState({
    courseCode: '',
    courseName: '',
    credits: 3,
    description: '',
    isActive: true,
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // State Dialog xác nhận xóa
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState(null)

  // Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  // Tải danh sách môn học
  const fetchCourses = () => {
    setLoading(true)
    academicService
      .getCourses()
      .then((data) => {
        setCourses(data || [])
      })
      .catch((err) => {
        showToast(err.message, 'error')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  // Mở modal tạo môn học mới
  const handleOpenCreate = () => {
    setModalMode('create')
    setSelectedCourseId(null)
    setForm({
      courseCode: '',
      courseName: '',
      credits: 3,
      description: '',
      isActive: true,
    })
    setFormErrors({})
    setOpenModal(true)
  }

  // Mở modal chỉnh sửa môn học
  const handleOpenEdit = (course) => {
    setModalMode('edit')
    setSelectedCourseId(course.courseId)
    setForm({
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits || 3,
      description: course.description || '',
      isActive: course.isActive !== undefined ? course.isActive : true,
    })
    setFormErrors({})
    setOpenModal(true)
  }

  // Validate form
  const validateForm = () => {
    const errors = {}
    if (modalMode === 'create' && !form.courseCode.trim()) {
      errors.courseCode = 'Mã môn học không được để trống'
    }
    if (!form.courseName.trim()) {
      errors.courseName = 'Tên môn học không được để trống'
    }
    if (!form.credits || Number(form.credits) <= 0) {
      errors.credits = 'Số tín chỉ phải lớn hơn 0'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Lưu môn học (Tạo mới hoặc Sửa)
  const handleSaveCourse = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    try {
      if (modalMode === 'create') {
        // POST /api/courses
        await academicService.createCourse({
          courseCode: form.courseCode.trim().toUpperCase(),
          courseName: form.courseName.trim(),
          credits: Number(form.credits),
          description: form.description.trim(),
          isActive: form.isActive,
        })
        showToast('Tạo môn học mới thành công!', 'success')
      } else {
        // PUT /api/courses/{id}
        await academicService.updateCourse(selectedCourseId, {
          courseName: form.courseName.trim(),
          credits: Number(form.credits),
          description: form.description.trim(),
          isActive: form.isActive,
        })
        showToast('Cập nhật thông tin môn học thành công!', 'success')
      }
      setOpenModal(false)
      fetchCourses()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Xóa môn học
  const handleConfirmDelete = async () => {
    if (!courseToDelete) return
    try {
      // DELETE /api/courses/{id}
      await academicService.deleteCourse(courseToDelete.courseId)
      showToast(`Đã xóa môn học ${courseToDelete.courseCode}`, 'success')
      setDeleteConfirmOpen(false)
      fetchCourses()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Lọc theo từ khóa tìm kiếm
  const filteredCourses = courses.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.courseCode?.toLowerCase().includes(q) ||
      c.courseName?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    )
  })

  return (
    <Box>
      {/* Thanh công cụ tìm kiếm và Thêm môn học */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e4e6ef',
          borderRadius: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <TextField
            size="small"
            placeholder="Tìm theo mã môn, tên môn học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              minWidth: { xs: '100%', sm: 300 },
              '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#81899a', fontSize: 18 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <IconButton size="small" onClick={fetchCourses} title="Làm mới">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{
            bgcolor: '#0058be',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 1.5,
            fontSize: 13,
            boxShadow: 'none',
            px: 2.2,
            py: 0.9,
            '&:hover': { bgcolor: '#0049a3' },
          }}
        >
          Thêm môn học
        </Button>
      </Paper>

      {/* Bảng danh sách môn học */}
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
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: '#fafbff' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>MÃ MÔN</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>TÊN MÔN HỌC</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>TÍN CHỈ</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>MÔ TẢ CHI TIẾT</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>TRẠNG THÁI</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, color: '#424754' }}>
                  THAO TÁC
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={30} sx={{ color: '#0058be' }} />
                    <Typography variant="body2" sx={{ mt: 1, color: '#6b7280' }}>
                      Đang tải danh sách môn học...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredCourses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CourseIcon sx={{ fontSize: 40, color: '#c2c6d6', mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#131b2e' }}>
                      Không có môn học nào
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Bấm nút "Thêm môn học" để tạo mới môn học vào hệ thống
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCourses.map((c) => (
                  <TableRow key={c.courseId || c.courseCode} hover>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12, color: '#0058be' }}>
                      {c.courseCode}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 13, color: '#131b2e' }}>
                      {c.courseName}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#424754' }}>
                      {c.credits} TC
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#6b7280', maxWidth: 300 }}>
                      {c.description || 'Chưa có mô tả'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.isActive ? 'Đang mở' : 'Tạm khóa'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: c.isActive ? '#ecfdf5' : '#f1f5f9',
                          color: c.isActive ? '#059669' : '#64748b',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Chỉnh sửa môn học">
                        <IconButton size="small" onClick={() => handleOpenEdit(c)} sx={{ color: '#0058be' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa môn học">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setCourseToDelete(c)
                            setDeleteConfirmOpen(true)
                          }}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal Thêm / Chỉnh sửa môn học */}
      <Dialog open={openModal} onClose={() => !submitting && setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          {modalMode === 'create' ? 'Tạo Môn Học Mới' : `Chỉnh Sửa Môn Học: ${form.courseCode}`}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveCourse}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Mã Môn Học *"
                  placeholder="VD: EE302"
                  size="small"
                  fullWidth
                  disabled={modalMode === 'edit'}
                  value={form.courseCode}
                  onChange={(e) => setForm({ ...form, courseCode: e.target.value })}
                  error={Boolean(formErrors.courseCode)}
                  helperText={formErrors.courseCode || (modalMode === 'edit' ? 'Mã môn không thể thay đổi' : '')}
                />
                <TextField
                  label="Số Tín Chỉ *"
                  type="number"
                  size="small"
                  fullWidth
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                  error={Boolean(formErrors.credits)}
                  helperText={formErrors.credits}
                />
              </Box>

              <TextField
                label="Tên Môn Học *"
                placeholder="VD: Hệ Thống Nhúng & IoT"
                size="small"
                fullWidth
                value={form.courseName}
                onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                error={Boolean(formErrors.courseName)}
                helperText={formErrors.courseName}
              />

              <TextField
                label="Mô Tả Nội Dung Môn Học"
                placeholder="Giới thiệu mục tiêu môn học, đề tài kit thực hành..."
                size="small"
                fullWidth
                multiline
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} disabled={submitting} sx={{ textTransform: 'none', color: '#6b7280' }}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
            >
              {submitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo môn học' : 'Lưu thay đổi'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Dialog Xác nhận Xóa môn học */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: '#ef4444' }}>Xác nhận xóa môn học?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
            Bạn có chắc chắn muốn xóa môn học <strong>{courseToDelete?.courseCode} - {courseToDelete?.courseName}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 1 }}>
            Lưu ý: Môn học đang có lớp sử dụng sẽ không thể xóa (lỗi 409).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>
            Xóa vĩnh viễn
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
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
