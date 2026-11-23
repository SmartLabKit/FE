import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Class as ClassIcon,
  Edit as EditIcon,
  DeleteOutlined as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'

/**
 * SemesterClassManager Component (Actor: ADMIN / Lab Staff)
 * Quản lý Học kỳ & Lớp học
 * Gắn các API:
 * - POST /api/semesters
 * - GET /api/semesters
 * - GET /api/semesters/{id}
 * - PUT /api/semesters/{id}
 * - DELETE /api/semesters/{id}
 * - POST /api/classes
 * - GET /api/classes (query semesterId)
 * - GET /api/classes/{id}
 * - PUT /api/classes/{id}
 * - DELETE /api/classes/{id}
 */
/** Giống BE: tháng 1–4 Spring, 5–8 Summer, 9–12 Fall; năm theo ngày bắt đầu. */
function getSemesterTerm(startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) return null
  const month = Number(startDate.slice(5, 7))
  let term = 'Fall'
  if (month <= 4) term = 'Spring'
  else if (month <= 8) term = 'Summer'
  return { term, year: Number(startDate.slice(0, 4)) }
}

function describeSemesterTerm(startDate) {
  const info = getSemesterTerm(startDate)
  return info ? `${info.term} ${info.year}` : '—'
}

function suggestSemesterCode(startDate) {
  const info = getSemesterTerm(startDate)
  if (!info) return 'FA26'
  const prefix = { Spring: 'SP', Summer: 'SU', Fall: 'FA' }[info.term]
  return `${prefix}${String(info.year % 100).padStart(2, '0')}`
}

export default function SemesterClassManager({ onNext }) {
  // State dữ liệu
  const [semesters, setSemesters] = useState([])
  const [courses, setCourses] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [classSearch, setClassSearch] = useState('')

  // State Modal Kỳ học (Thêm / Sửa)
  const [semesterModalOpen, setSemesterModalOpen] = useState(false)
  const [semesterModalMode, setSemesterModalMode] = useState('create') // 'create' | 'edit'
  const [editingSemesterId, setEditingSemesterId] = useState(null)
  const [originalDates, setOriginalDates] = useState({ startDate: '', endDate: '' })
  const [semesterForm, setSemesterForm] = useState({
    semesterCode: '',
    startDate: '',
    endDate: '',
    isActive: true,
  })

  // State Modal Lớp học (Thêm / Sửa)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [classModalMode, setClassModalMode] = useState('create') // 'create' | 'edit'
  const [editingClassId, setEditingClassId] = useState(null)
  const [classForm, setClassForm] = useState({
    classCode: '',
    courseId: '',
    semesterId: '',
    maxStudents: 30,
    instructorName: '',
  })
  const [classErrors, setClassErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // State Xóa
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null) // { type: 'semester' | 'class', id, name }

  // Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const showToast = useCallback((message, severity = 'success') => setToast({ open: true, message, severity }), [])

  useEffect(() => {
    let ignore = false
    Promise.all([
      academicService.getSemesters(),
      academicService.getCourses(),
    ])
      .then(([semData, courseData]) => {
        if (!ignore) {
          setSemesters(semData || [])
          setCourses(courseData || [])
          if (semData && semData.length > 0) {
            const currentYearSemesters = semData.filter(
              (semester) => Number(semester.year) === new Date().getFullYear(),
            )
            const initialSemester = currentYearSemesters.find((semester) => semester.isActive) ||
              currentYearSemesters[0]
            setSelectedSemesterId(initialSemester?.semesterId || '')
          }
        }
      })
      .catch((err) => {
        if (!ignore) showToast(err.message, 'error')
      })

    return () => {
      ignore = true
    }
  }, [showToast])

  // Tải danh sách lớp khi thay đổi học kỳ được chọn
  useEffect(() => {
    if (!selectedSemesterId) return
    academicService
      .getClasses(selectedSemesterId)
      .then((data) => {
        setClasses(data || [])
      })
      .catch((err) => {
        showToast(err.message, 'error')
      })
  }, [selectedSemesterId, showToast])

  // ==================== XỬ LÝ HỌC KỲ ====================
  const handleOpenCreateSemester = () => {
    setSemesterModalMode('create')
    setEditingSemesterId(null)
    setOriginalDates({ startDate: '', endDate: '' })
    setSemesterForm({
      semesterCode: '',
      startDate: getVietnamDateInputValue(),
      endDate: getVietnamDateInputValue(new Date(Date.now() + 120 * 24 * 3600 * 1000)),
      isActive: true,
    })
    setSemesterModalOpen(true)
  }

  const handleOpenEditSemester = async (sem) => {
    setSemesterModalMode('edit')
    setEditingSemesterId(sem.semesterId)
    let target = sem
    try {
      const detail = await academicService.getSemesterById(sem.semesterId)
      if (detail) target = detail
    } catch {
      // fallback
    }
    setSemesterForm({
      semesterCode: target.semesterCode || sem.semesterCode,
      startDate: target.startDate ? target.startDate.split('T')[0] : (sem.startDate ? sem.startDate.split('T')[0] : ''),
      endDate: target.endDate ? target.endDate.split('T')[0] : (sem.endDate ? sem.endDate.split('T')[0] : ''),
      isActive: target.isActive !== undefined ? target.isActive : (sem.isActive !== undefined ? sem.isActive : true),
    })
    setOriginalDates({
      startDate: (target.startDate || sem.startDate || '').split('T')[0],
      endDate: (target.endDate || sem.endDate || '').split('T')[0],
    })
    setSemesterModalOpen(true)
  }

  const handleSaveSemester = async (e) => {
    e.preventDefault()
    if (!semesterForm.startDate || !semesterForm.endDate) {
      showToast('Vui lòng chọn ngày bắt đầu và ngày kết thúc', 'warning')
      return
    }
    if (semesterForm.endDate <= semesterForm.startDate) {
      showToast('Ngày kết thúc phải sau ngày bắt đầu', 'warning')
      return
    }
    const todayVn = getVietnamDateInputValue()
    const isCreate = semesterModalMode === 'create'
    if ((isCreate || semesterForm.startDate !== originalDates.startDate) && semesterForm.startDate < todayVn) {
      showToast(
        isCreate
          ? 'Không thể tạo kỳ học trong quá khứ: ngày bắt đầu phải từ hôm nay trở đi'
          : 'Ngày bắt đầu mới không được ở quá khứ',
        'warning'
      )
      return
    }
    if (!isCreate && semesterForm.endDate !== originalDates.endDate && semesterForm.endDate < todayVn) {
      showToast('Ngày kết thúc mới không được ở quá khứ', 'warning')
      return
    }

    setSubmitting(true)
    try {
      if (semesterModalMode === 'create') {
        const created = await academicService.createSemester({
          semesterCode: semesterForm.semesterCode.trim() || null,
          startDate: semesterForm.startDate,
          endDate: semesterForm.endDate,
        })
        showToast(`Đã tạo học kỳ ${created.semesterCode}!`, 'success')
        setSelectedYear(Number(created.year))
        setSelectedSemesterId(created.semesterId)
      } else {
        const updated = await academicService.updateSemester(editingSemesterId, {
          startDate: semesterForm.startDate,
          endDate: semesterForm.endDate,
          isActive: semesterForm.isActive,
        })
        showToast(`Đã cập nhật học kỳ ${semesterForm.semesterCode}!`, 'success')
        if (updated?.year) setSelectedYear(Number(updated.year))
        setSelectedSemesterId(editingSemesterId)
      }
      setSemesterModalOpen(false)
      const updatedSems = await academicService.getSemesters()
      setSemesters(updatedSems || [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== XỬ LÝ LỚP HỌC ====================
  const handleOpenCreateClass = () => {
    setClassModalMode('create')
    setEditingClassId(null)
    setClassForm({
      classCode: '',
      courseId: courses[0]?.courseId || '',
      semesterId: selectedSemesterId || semesters[0]?.semesterId || '',
      maxStudents: 30,
      instructorName: '',
    })
    setClassErrors({})
    setClassModalOpen(true)
  }

  const handleOpenEditClass = async (cls) => {
    setClassModalMode('edit')
    setEditingClassId(cls.classId)
    let target = cls
    try {
      const detail = await academicService.getClassById(cls.classId)
      if (detail) target = detail
    } catch {
      // fallback
    }
    setClassForm({
      classCode: target.classCode || cls.classCode,
      courseId: target.courseId || cls.courseId,
      semesterId: target.semesterId || cls.semesterId,
      maxStudents: target.maxStudents || cls.maxStudents || 30,
      instructorName: target.instructorName || cls.instructorName || '',
    })
    setClassErrors({})
    setClassModalOpen(true)
  }

  const validateClassForm = () => {
    const errors = {}
    if (!classForm.classCode.trim()) errors.classCode = 'Mã lớp không được để trống'
    if (!classForm.courseId) errors.courseId = 'Vui lòng chọn môn học'
    const max = Number(classForm.maxStudents)
    if (!max || max < 1) errors.maxStudents = 'Sĩ số tối đa phải ít nhất 1'
    if (max > 35) errors.maxStudents = 'Sĩ số tối đa của phòng lab là 35'
    setClassErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveClass = async (e) => {
    e.preventDefault()
    if (!validateClassForm()) return

    setSubmitting(true)
    try {
      if (classModalMode === 'create') {
        await academicService.createClass({
          classCode: classForm.classCode.trim().toUpperCase(),
          courseId: classForm.courseId,
          semesterId: classForm.semesterId || selectedSemesterId,
          maxStudents: Number(classForm.maxStudents),
        })
        showToast('Tạo lớp môn học mới thành công!', 'success')
      } else {
        await academicService.updateClass(editingClassId, {
          classCode: classForm.classCode.trim().toUpperCase(),
          courseId: classForm.courseId,
          maxStudents: Number(classForm.maxStudents),
        })
        showToast('Cập nhật thông tin lớp học thành công!', 'success')
      }
      setClassModalOpen(false)
      const refreshed = await academicService.getClasses(selectedSemesterId)
      setClasses(refreshed || [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== XỬ LÝ XÓA ====================
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    try {
      if (itemToDelete.type === 'semester') {
        await academicService.deleteSemester(itemToDelete.id)
        showToast(`Đã xóa kỳ học ${itemToDelete.name}`, 'success')
        const updatedSems = await academicService.getSemesters()
        setSemesters(updatedSems || [])
        if (selectedSemesterId === itemToDelete.id) {
          const replacement = updatedSems.find(
            (semester) => Number(semester.year) === selectedYear && semester.isActive,
          ) || updatedSems.find((semester) => Number(semester.year) === selectedYear)
          setSelectedSemesterId(replacement?.semesterId || '')
          if (!replacement) setClasses([])
        }
      } else {
        await academicService.deleteClass(itemToDelete.id)
        showToast(`Đã xóa lớp học ${itemToDelete.name}`, 'success')
        const refreshed = await academicService.getClasses(selectedSemesterId)
        setClasses(refreshed || [])
      }
      setDeleteConfirmOpen(false)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Lọc lớp theo từ khóa tìm kiếm
  const filteredClasses = classes.filter((c) => {
    const q = classSearch.toLowerCase()
    return (
      c.classCode?.toLowerCase().includes(q) ||
      c.courseName?.toLowerCase().includes(q) ||
      c.instructorName?.toLowerCase().includes(q)
    )
  })

  const currentSemester = semesters.find((s) => s.semesterId === selectedSemesterId)
  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...semesters.map((semester) => Number(semester.year)).filter(Number.isFinite),
  ])].sort((a, b) => b - a)
  const visibleSemesters = semesters.filter((semester) => Number(semester.year) === selectedYear)

  const handleYearChange = (event) => {
    const year = Number(event.target.value)
    const yearSemesters = semesters.filter((semester) => Number(semester.year) === year)
    const nextSemester = yearSemesters.find((semester) => semester.isActive) || yearSemesters[0]
    setSelectedYear(year)
    setSelectedSemesterId(nextSemester?.semesterId || '')
    if (!nextSemester) setClasses([])
  }

  return (
    <Box>
      {/* Header section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 0.5 }}>
          Quản lý Học kỳ & Lớp học phần
        </Typography>
        <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
          Khởi tạo niên khóa, học kỳ và phân bổ các lớp học phần cho phòng thực hành
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* CỘT TRÁI: DANH SÁCH & QUẢN LÝ KỲ HỌC */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon sx={{ color: '#0058be', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 15 }}>
                  Học kỳ năm {selectedYear} ({visibleSemesters.length})
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon fontSize="small" />}
                onClick={handleOpenCreateSemester}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 11,
                  borderColor: '#0058be30',
                  color: '#0058be',
                }}
              >
                Tạo kỳ mới
              </Button>
            </Box>

            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="semester-year-label">Năm học</InputLabel>
              <Select
                labelId="semester-year-label"
                label="Năm học"
                value={selectedYear}
                onChange={handleYearChange}
              >
                {availableYears.map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
              Chọn một trong các học kỳ của năm để quản lý lớp học phần
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              {visibleSemesters.map((sem) => {
                const isSelected = sem.semesterId === selectedSemesterId
                return (
                  <Paper
                    key={sem.semesterId}
                    elevation={0}
                    onClick={() => setSelectedSemesterId(sem.semesterId)}
                    sx={{
                      p: 1.8,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: `1.5px solid ${isSelected ? '#0058be' : '#e4e6ef'}`,
                      bgcolor: isSelected ? '#eaedff25' : '#ffffff',
                      transition: 'all 0.15s ease',
                      '&:hover': { borderColor: '#0058be' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: isSelected ? '#0058be' : '#131b2e',
                        }}
                      >
                        {sem.semesterCode} ({sem.term} {sem.year})
                      </Typography>
                      <Chip
                        label={sem.isActive ? 'Đang mở' : 'Đã kết thúc'}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 9,
                          fontWeight: 800,
                          bgcolor: sem.isActive ? '#ecfdf5' : '#f1f5f9',
                          color: sem.isActive ? '#059669' : '#64748b',
                        }}
                      />
                    </Box>

                    <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', fontSize: 11 }}>
                      {formatVietnamDate(sem.startDate)} →{' '}
                      {formatVietnamDate(sem.endDate)}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
                      <Tooltip title="Chỉnh sửa kỳ học">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditSemester(sem)
                          }}
                          sx={{ p: 0.5, color: '#0058be' }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa kỳ học">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setItemToDelete({ type: 'semester', id: sem.semesterId, name: sem.semesterCode })
                            setDeleteConfirmOpen(true)
                          }}
                          sx={{ p: 0.5, color: '#ef4444' }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                )
              })}
              {visibleSemesters.length === 0 && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Chưa có học kỳ trong năm {selectedYear}. Hãy tạo kỳ mới để bắt đầu.
                </Alert>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* CỘT PHẢI: DANH SÁCH LỚP HỌC THUỘC KỲ ĐƯỢC CHỌN */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            {/* Header thanh lọc & nút tạo lớp */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, color: '#131b2e' }}>
                  Lớp học phần: {currentSemester ? `${currentSemester.semesterCode} (${currentSemester.term} ${currentSemester.year})` : 'Chưa chọn kỳ'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                  Tổng cộng: {filteredClasses.length} lớp học phần đang quản lý
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                  size="small"
                  placeholder="Tìm mã lớp, môn học, GV..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 } }}
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
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleOpenCreateClass}
                  disabled={!selectedSemesterId}
                  sx={{
                    bgcolor: '#0058be',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    fontSize: 12,
                    boxShadow: 'none',
                    py: 0.9,
                    px: 2,
                    '&:hover': { bgcolor: '#0049a3' },
                  }}
                >
                  Tạo lớp mới
                </Button>
              </Box>
            </Box>

            {/* Bảng danh sách lớp */}
            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ LỚP</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÔN HỌC</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>GIẢNG VIÊN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>SĨ SỐ</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>
                      THAO TÁC
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                        <ClassIcon sx={{ fontSize: 36, color: '#c2c6d6', mb: 1 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#131b2e' }}>
                          Chưa có lớp học nào trong học kỳ này
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                          Bấm nút "Tạo lớp mới" để phân bổ lớp học phần
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClasses.map((cls) => (
                      <TableRow key={cls.classId || cls.classCode} hover>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: '#0058be' }}>
                          {cls.classCode}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>
                          {cls.courseCode} - {cls.courseName}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754' }}>
                          {cls.instructorName || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Chưa phân công</span>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12 }}>
                            {cls.currentStudents || 0} / {cls.maxStudents || 30}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Chỉnh sửa lớp">
                            <IconButton size="small" onClick={() => handleOpenEditClass(cls)} sx={{ color: '#0058be' }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xóa lớp">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setItemToDelete({ type: 'class', id: cls.classId, name: cls.classCode })
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

            {/* Chuyển sang bước Roster */}
            {onNext && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, pt: 2, borderTop: '1px solid #f0f2f5' }}>
                <Button
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  onClick={onNext}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    borderColor: '#0058be',
                    color: '#0058be',
                    borderRadius: 1.5,
                    px: 2.5,
                    '&:hover': { bgcolor: '#eaedff' },
                  }}
                >
                  Tiếp tục
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Modal 1: Tạo / Sửa Học kỳ */}
      <Dialog open={semesterModalOpen} onClose={() => !submitting && setSemesterModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          {semesterModalMode === 'create' ? 'Tạo Học Kỳ Mới' : 'Cập Nhật Học Kỳ'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveSemester}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Mã học kỳ"
                placeholder={semesterModalMode === 'create' ? `Để trống để tự sinh (VD: ${suggestSemesterCode(semesterForm.startDate)})` : ''}
                size="small"
                fullWidth
                value={semesterForm.semesterCode}
                disabled={semesterModalMode === 'edit'}
                helperText={semesterModalMode === 'edit' ? 'Mã học kỳ không đổi được' : 'Có thể để trống'}
                onChange={(e) => setSemesterForm({ ...semesterForm, semesterCode: e.target.value.toUpperCase() })}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  label="Ngày bắt đầu *"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={semesterForm.startDate}
                  onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                  slotProps={{
                    htmlInput: semesterModalMode === 'create' ? { min: getVietnamDateInputValue() } : {},
                  }}
                  helperText={semesterModalMode === 'create' ? 'Từ hôm nay trở đi' : ''}
                />
                <TextField
                  label="Ngày kết thúc *"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={semesterForm.endDate}
                  onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                  slotProps={{
                    htmlInput: semesterModalMode === 'create' ? { min: semesterForm.startDate || getVietnamDateInputValue() } : {},
                  }}
                  helperText={semesterModalMode === 'create' ? 'Sau ngày bắt đầu' : ''}
                />
              </Box>
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                Kỳ: <strong>{describeSemesterTerm(semesterForm.startDate)}</strong> (tự theo ngày bắt đầu)
              </Typography>
              {semesterModalMode === 'edit' && (
                <FormControl size="small">
                  <InputLabel>Trạng thái</InputLabel>
                  <Select
                    value={semesterForm.isActive ? 'true' : 'false'}
                    label="Trạng thái"
                    onChange={(e) => setSemesterForm({ ...semesterForm, isActive: e.target.value === 'true' })}
                  >
                    <MenuItem value="true">Đang hoạt động (Active)</MenuItem>
                    <MenuItem value="false">Đã kết thúc / Lưu trữ (Archived)</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSemesterModalOpen(false)} disabled={submitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}>
              {submitting ? 'Đang lưu...' : 'Lưu học kỳ'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Modal 2: Tạo / Sửa Lớp học */}
      <Dialog open={classModalOpen} onClose={() => !submitting && setClassModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          {classModalMode === 'create' ? 'Tạo Lớp Học Phần Mới' : 'Cập Nhật Lớp Học'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveClass}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Mã Lớp Học Phần *"
                placeholder="VD: EE302-01, CS101-02"
                size="small"
                fullWidth
                value={classForm.classCode}
                onChange={(e) => setClassForm({ ...classForm, classCode: e.target.value })}
                error={Boolean(classErrors.classCode)}
                helperText={classErrors.classCode || 'Mã lớp không được trùng trong cùng học kỳ'}
              />

              <FormControl fullWidth size="small" error={Boolean(classErrors.courseId)}>
                <InputLabel>Môn học liên kết *</InputLabel>
                <Select
                  value={classForm.courseId}
                  label="Môn học liên kết *"
                  onChange={(e) => setClassForm({ ...classForm, courseId: e.target.value })}
                >
                  {courses.map((course) => (
                    <MenuItem key={course.courseId} value={course.courseId}>
                      {course.courseCode} - {course.courseName} ({course.credits} TC)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Sĩ Số Tối Đa *"
                type="number"
                size="small"
                fullWidth
                value={classForm.maxStudents}
                onChange={(e) => setClassForm({ ...classForm, maxStudents: e.target.value })}
                error={Boolean(classErrors.maxStudents)}
                helperText={classErrors.maxStudents || 'Mặc định 30, tối đa 35 sinh viên'}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setClassModalOpen(false)} disabled={submitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}>
              {submitting ? 'Đang lưu...' : classModalMode === 'create' ? 'Tạo lớp học' : 'Lưu thay đổi'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Dialog Xác nhận Xóa */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: '#ef4444' }}>
          Xác nhận xóa {itemToDelete?.type === 'semester' ? 'học kỳ' : 'lớp học'}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
            Bạn có chắc chắn muốn xóa <strong>{itemToDelete?.name}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 1 }}>
            Lưu ý: Không thể xóa khi dữ liệu đã có liên kết sinh viên hoặc lớp học (lỗi 409).
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
