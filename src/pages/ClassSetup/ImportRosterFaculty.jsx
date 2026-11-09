import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  ListSubheader,
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
  Tooltip,
  Typography,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  AssignmentInd as AssignmentIndIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'

/**
 * ImportRosterFaculty Component (Actor: ADMIN / LAB STAFF)
 * Kết nối API MF2:
 * 1. GET /api/classes - Lấy danh sách lớp học
 * 2. POST /api/classes/{id}/roster - Import danh sách sinh viên bằng file Excel
 * 3. POST /api/classes/assign-instructor - Phân công giảng viên cho lớp
 */

/**
 * Lọc và chuẩn hóa danh sách lỗi thực sự từ kết quả import roster.
 * Loại bỏ các dòng trùng lặp / bỏ qua hoặc các dòng trống không có nội dung lỗi.
 */
function getRealErrors(result) {
  if (!result?.errors || !Array.isArray(result.errors)) return []
  return result.errors
    .map((err) => {
      const row =
        err?.row ??
        err?.Row ??
        err?.rowNumber ??
        err?.RowNumber ??
        err?.lineNumber ??
        err?.LineNumber ??
        err?.line ??
        err?.Line ??
        null

      let message = ''
      if (typeof err === 'string') {
        message = err.trim()
      } else if (err && typeof err === 'object') {
        message = (
          err.message ||
          err.Message ||
          err.errorMessage ||
          err.ErrorMessage ||
          err.error ||
          err.Error ||
          err.description ||
          err.Description ||
          err.reason ||
          err.Reason ||
          ''
        ).trim()
      }

      return { row, message, raw: err }
    })
    .filter((err) => {
      // Bỏ qua nếu hoàn toàn không có nội dung lỗi
      if (!err.message && !err.row) return false

      // Bỏ qua nếu được đánh dấu rõ ràng là trùng lặp hoặc warning từ server
      const raw = err.raw
      if (raw && typeof raw === 'object') {
        if (raw.isDuplicate || raw.isSkipped || raw.type === 'Duplicate' || raw.type === 'Warning') {
          return false
        }
      }

      // Bỏ qua nếu nội dung thông báo chứa các từ khóa trùng lặp / đã tồn tại / đã có trong lớp
      if (/trùng|tồn tại|already exist|duplicate|đã có|bỏ qua|skipped/i.test(err.message)) {
        return false
      }

      // Bỏ qua nếu không có thông báo chi tiết mà hệ thống đã ghi nhận số dòng bỏ qua
      if (!err.message && (result.skippedRows ?? 0) > 0) {
        return false
      }

      return true
    })
}

/**
 * Tính trọng số học kỳ để sắp xếp niên khóa từ mới nhất đến cũ nhất.
 * Năm càng lớn trọng số càng cao; trong cùng năm: Fall (FA) > Summer (SU) > Spring (SP).
 */
function getSemesterWeight(semCode = '') {
  const str = String(semCode || '').trim().toUpperCase()
  const matchYear = str.match(/(?:20)?(\d{2})$/)
  const year = matchYear ? parseInt(matchYear[1], 10) + 2000 : 2000

  let termScore = 0
  if (str.includes('FA') || str.includes('FALL')) termScore = 3
  else if (str.includes('SU') || str.includes('SUMMER')) termScore = 2
  else if (str.includes('SP') || str.includes('SPRING')) termScore = 1

  return year * 10 + termScore
}

export default function ImportRosterFaculty({ onNext, onPrev }) {
  // State danh sách lớp học
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [selectedSemester, setSelectedSemester] = useState('ALL')

  // State danh sách sinh viên thực tế trong lớp
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  // State upload file Excel
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // State phân công giảng viên
  const [instructorForm, setInstructorForm] = useState({
    instructorCode: 'LEC-001',
    fullName: 'TS. Nguyễn Văn Thành',
    email: 'thanh.nv@smartlab.edu.vn',
    academicTitle: 'Tiến sĩ',
  })
  const [assigning, setAssigning] = useState(false)
  const [assignedResult, setAssignedResult] = useState(null)
  const [openAssignDialog, setOpenAssignDialog] = useState(false)

  // Toast alert
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Danh sách các học kỳ phân loại từ classes, sắp xếp từ mới nhất đến cũ nhất
  const semestersList = useMemo(() => {
    const semMap = new Map()
    classes.forEach((cls) => {
      const code = cls.semesterCode || 'Chưa phân kỳ'
      if (!semMap.has(code)) {
        semMap.set(code, {
          code,
          weight: getSemesterWeight(code),
          count: 1,
        })
      } else {
        semMap.get(code).count += 1
      }
    })
    return Array.from(semMap.values()).sort((a, b) => b.weight - a.weight)
  }, [classes])

  // Phân nhóm lớp theo từng học kỳ và sắp xếp
  const groupedClassesBySemester = useMemo(() => {
    const groups = {}
    classes.forEach((cls) => {
      const sem = cls.semesterCode || 'Khác'
      if (!groups[sem]) groups[sem] = []
      groups[sem].push(cls)
    })

    // Sắp xếp các lớp trong mỗi kỳ theo mã lớp
    Object.keys(groups).forEach((sem) => {
      groups[sem].sort((a, b) => (a.classCode || '').localeCompare(b.classCode || ''))
    })

    // Sắp xếp các kỳ từ mới nhất đến cũ nhất
    const sortedSemesters = Object.keys(groups).sort(
      (a, b) => getSemesterWeight(b) - getSemesterWeight(a)
    )

    return sortedSemesters.map((sem) => ({
      semesterCode: sem,
      classes: groups[sem],
    }))
  }, [classes])

  // Lọc danh sách lớp theo học kỳ được chọn
  const filteredClasses = useMemo(() => {
    if (selectedSemester === 'ALL') {
      return groupedClassesBySemester.flatMap((g) => g.classes)
    }
    const found = groupedClassesBySemester.find((g) => g.semesterCode === selectedSemester)
    return found ? found.classes : []
  }, [selectedSemester, groupedClassesBySemester])

  // Tải danh sách sinh viên thực tế của lớp
  const fetchClassStudents = useCallback(async (classId) => {
    if (!classId) {
      setStudents([])
      return
    }
    setLoadingStudents(true)
    try {
      const data = await academicService.getClassStudents(classId)
      setStudents(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Không thể tải danh sách sinh viên của lớp:', err)
      setStudents([])
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  const handleSemesterChange = (e) => {
    const sem = e.target.value
    setSelectedSemester(sem)
    if (sem === 'ALL') {
      if (classes.length > 0 && !classes.some((c) => c.classId === selectedClassId)) {
        const nextId = classes[0].classId
        setSelectedClassId(nextId)
        fetchClassStudents(nextId)
      }
    } else {
      const inSem = classes.filter((c) => c.semesterCode === sem)
      if (inSem.length > 0 && !inSem.some((c) => c.classId === selectedClassId)) {
        const nextId = inSem[0].classId
        setSelectedClassId(nextId)
        fetchClassStudents(nextId)
      }
    }
  }

  // Tải danh sách lớp
  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const data = await academicService.getClasses()
      const classList = Array.isArray(data) ? data : data?.items || []
      classList.sort((a, b) => {
        const weightDiff = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
        if (weightDiff !== 0) return weightDiff
        return (a.classCode || '').localeCompare(b.classCode || '')
      })
      setClasses(classList)
      const targetId = selectedClassId || (classList.length > 0 ? classList[0].classId : '')
      if (targetId) {
        if (!selectedClassId) setSelectedClassId(targetId)
        fetchClassStudents(targetId)
        const targetCls = classList.find((c) => c.classId === targetId)
        if (targetCls?.instructorName) {
          setAssignedResult({
            fullName: targetCls.instructorName,
            email: 'gv@smartlab.edu.vn',
            academicTitle: 'Giảng viên',
          })
        }
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Không thể tải danh sách lớp học',
        severity: 'error',
      })
    } finally {
      setLoadingClasses(false)
    }
  }, [selectedClassId, fetchClassStudents])

  useEffect(() => {
    let ignore = false
    academicService
      .getClasses()
      .then((data) => {
        if (!ignore) {
          const classList = Array.isArray(data) ? data : data?.items || []
          classList.sort((a, b) => {
            const weightDiff = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
            if (weightDiff !== 0) return weightDiff
            return (a.classCode || '').localeCompare(b.classCode || '')
          })
          setClasses(classList)
          if (classList.length > 0) {
            const firstId = classList[0].classId
            setSelectedClassId(firstId)
            fetchClassStudents(firstId)
            if (classList[0].instructorName) {
              setAssignedResult({
                fullName: classList[0].instructorName,
                email: 'gv@smartlab.edu.vn',
                academicTitle: 'Giảng viên',
              })
            }
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setToast({
            open: true,
            message: err.message || 'Không thể tải danh sách lớp học',
            severity: 'error',
          })
        }
      })
      .finally(() => {
        if (!ignore) setLoadingClasses(false)
      })

    return () => {
      ignore = true
    }
  }, [fetchClassStudents])

  // Lớp đang chọn hiện tại
  const currentClass = classes.find((c) => c.classId === selectedClassId) || null

  // Khi thay đổi lớp chọn
  const handleClassChange = (e) => {
    const newClassId = e.target.value
    setSelectedClassId(newClassId)
    setImportResult(null)
    setStudentSearch('')
    fetchClassStudents(newClassId)
    const cls = classes.find((c) => c.classId === newClassId)
    if (cls?.instructorName) {
      setAssignedResult({
        fullName: cls.instructorName,
        email: 'gv@smartlab.edu.vn',
        academicTitle: 'Giảng viên',
      })
    } else {
      setAssignedResult(null)
    }
  }

  // Danh sách sinh viên sau khi lọc theo từ khóa tìm kiếm
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students
    const query = studentSearch.trim().toLowerCase()
    return students.filter((s) => {
      const code = String(s.studentCode || s.StudentCode || s.code || s.studentId || '').toLowerCase()
      const name = String(s.fullName || s.FullName || s.name || s.studentName || '').toLowerCase()
      const email = String(s.email || s.Email || s.userEmail || '').toLowerCase()
      return code.includes(query) || name.includes(query) || email.includes(query)
    })
  }, [students, studentSearch])

  // Chọn file Excel
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)
    }
  }

  // Thực hiện import roster qua API POST /api/classes/{id}/roster
  const handleUploadRoster = async () => {
    if (!selectedClassId) {
      setToast({ open: true, message: 'Vui lòng chọn một lớp học trước khi import', severity: 'warning' })
      return
    }
    if (!selectedFile) {
      setToast({ open: true, message: 'Vui lòng chọn file danh sách sinh viên (.xlsx, .csv)', severity: 'warning' })
      return
    }

    setUploading(true)
    try {
      const res = await academicService.importRoster(selectedClassId, selectedFile)
      setImportResult(res)
      const realErrors = getRealErrors(res)
      const hasErrors = realErrors.length > 0
      const skippedNote = res?.skippedRows > 0 ? ` (Bỏ qua ${res.skippedRows} dòng trùng lặp)` : ''
      setToast({
        open: true,
        message: hasErrors
          ? `Đã xử lý file: ghi danh ${res?.enrolledStudents ?? 0} sinh viên, phát hiện ${realErrors.length} lỗi dòng.`
          : `Import thành công! Đã ghi danh ${res?.enrolledStudents ?? 0} sinh viên vào lớp.${skippedNote}`,
        severity: hasErrors ? 'warning' : 'success',
      })
      // Cập nhật lại số sinh viên trong danh sách lớp và tải lại danh sách sinh viên thực tế
      await Promise.all([
        fetchClasses(),
        fetchClassStudents(selectedClassId),
      ])
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Lỗi khi import danh sách sinh viên',
        severity: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  // Thực hiện phân công giảng viên qua API POST /api/classes/assign-instructor
  const handleAssignInstructor = async (e) => {
    e.preventDefault()
    if (!selectedClassId) {
      setToast({ open: true, message: 'Vui lòng chọn một lớp học', severity: 'warning' })
      return
    }
    if (!instructorForm.instructorCode || !instructorForm.fullName || !instructorForm.email) {
      setToast({ open: true, message: 'Vui lòng điền đủ thông tin giảng viên', severity: 'warning' })
      return
    }

    setAssigning(true)
    try {
      const payload = {
        classId: selectedClassId,
        instructorCode: instructorForm.instructorCode,
        fullName: instructorForm.fullName,
        email: instructorForm.email,
        academicTitle: instructorForm.academicTitle || 'Giảng viên',
      }
      const res = await academicService.assignInstructor(payload)
      setAssignedResult(res)
      setOpenAssignDialog(false)
      setToast({
        open: true,
        message: `Đã phân công giảng viên ${res.fullName} cho lớp thành công!`,
        severity: 'success',
      })
      fetchClasses()
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Phân công giảng viên thất bại',
        severity: 'error',
      })
    } finally {
      setAssigning(false)
    }
  }

  // Giảng viên mẫu gợi ý chọn nhanh
  const sampleInstructors = [
    {
      code: 'LEC-001',
      name: 'TS. Nguyễn Văn Thành',
      email: 'thanh.nv@smartlab.edu.vn',
      title: 'Tiến sĩ',
    },
    {
      code: 'LEC-002',
      name: 'ThS. Trần Thị Mai',
      email: 'mai.tt@smartlab.edu.vn',
      title: 'Thạc sĩ',
    },
    {
      code: 'LEC-003',
      name: 'PGS. TS. Lê Hoàng Nam',
      email: 'nam.lh@smartlab.edu.vn',
      title: 'Phó Giáo sư',
    },
  ]

  const handleSelectSampleInstructor = (sample) => {
    setInstructorForm({
      instructorCode: sample.code,
      fullName: sample.name,
      email: sample.email,
      academicTitle: sample.title,
    })
  }

  return (
    <Box>
      {/* Breadcrumb Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
            Class Management &gt; Lớp môn học &gt; Nhập danh sách sinh viên &amp; Phân công giảng viên
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.5 }}>
            Nhập danh sách (Roster) &amp; Phân công Giảng viên
          </Typography>
          <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
            Quản lý sĩ số lớp qua file Excel và chỉ định giảng viên phụ trách chuyên môn
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchClasses}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#dcdfe6' }}
        >
          Làm mới dữ liệu
        </Button>
      </Box>

      {/* Class Selector Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          border: '1px solid #e4e6ef',
          bgcolor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 320, flexWrap: 'wrap' }}>
          <SchoolIcon sx={{ color: '#0058be', fontSize: 28 }} />

          {/* Phân loại theo kỳ học */}
          <Box sx={{ minWidth: 190 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
              PHÂN LOẠI THEO HỌC KỲ:
            </Typography>
            <Select
              fullWidth
              size="small"
              value={selectedSemester}
              onChange={handleSemesterChange}
              sx={{ borderRadius: 1.5, height: 40, fontSize: 13, bgcolor: '#fafbff' }}
            >
              <MenuItem value="ALL" sx={{ fontSize: 13, fontWeight: 700 }}>
                Tất cả các kỳ ({classes.length} lớp)
              </MenuItem>
              {semestersList.map((sem) => (
                <MenuItem key={sem.code} value={sem.code} sx={{ fontSize: 13 }}>
                  Kỳ {sem.code} ({sem.count} lớp)
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* Chọn lớp môn học */}
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
              CHỌN LỚP CẦN NẠP SINH VIÊN HOẶC PHÂN CÔNG GIẢNG VIÊN:
            </Typography>
            {loadingClasses ? (
              <CircularProgress size={20} />
            ) : (
              <Select
                fullWidth
                size="small"
                value={selectedClassId}
                onChange={handleClassChange}
                sx={{ borderRadius: 1.5, height: 40, fontSize: 13, bgcolor: '#fafbff' }}
                displayEmpty
              >
                {filteredClasses.length === 0 && (
                  <MenuItem value="" disabled>
                    Không có lớp nào trong kỳ này
                  </MenuItem>
                )}
                {selectedSemester === 'ALL'
                  ? groupedClassesBySemester.map((group) => [
                      <ListSubheader
                        key={`header-${group.semesterCode}`}
                        sx={{
                          bgcolor: '#f1f5f9',
                          color: '#0058be',
                          fontWeight: 800,
                          fontSize: 11,
                          lineHeight: '32px',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        📅 HỌC KỲ {group.semesterCode} ({group.classes.length} LỚP)
                      </ListSubheader>,
                      ...group.classes.map((cls) => (
                        <MenuItem key={cls.classId} value={cls.classId} sx={{ fontSize: 13, pl: 3 }}>
                          <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode} | Sĩ số: {cls.currentStudents || 0}/{cls.maxStudents || 30}
                        </MenuItem>
                      )),
                    ])
                  : filteredClasses.map((cls) => (
                      <MenuItem key={cls.classId} value={cls.classId} sx={{ fontSize: 13 }}>
                        <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode} ({cls.semesterCode || 'Học kỳ'}) | Sĩ số: {cls.currentStudents || 0}/{cls.maxStudents || 30}
                      </MenuItem>
                    ))}
              </Select>
            )}
          </Box>
        </Box>

        {currentClass && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={`Môn: ${currentClass.courseCode || 'N/A'}`}
              size="small"
              sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 700, fontSize: 11 }}
            />
            <Chip
              label={`Sĩ số: ${students.length > 0 ? students.length : (currentClass.currentStudents || 0)}/${currentClass.maxStudents || 30}`}
              size="small"
              sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: 11 }}
            />
            <Chip
              label={`Giảng viên: ${currentClass.instructorName || 'Chưa phân công'}`}
              size="small"
              sx={{
                bgcolor: currentClass.instructorName ? '#fef3c7' : '#f1f5f9',
                color: currentClass.instructorName ? '#b45309' : '#64748b',
                fontWeight: 700,
                fontSize: 11,
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Main Form Split */}
      <Grid container spacing={3}>
        {/* Left Column: Tải file danh sách sinh viên */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 0.5 }}>
              1. Import danh sách sinh viên (Roster)
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 12, mb: 2 }}>
              API: <code>POST /api/classes/{'{id}'}/roster</code> - File Excel chứa cột Mã SV, Họ tên, Email.
            </Typography>

            {/* Drag and Drop Zone */}
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3.5,
                border: '2px dashed #a0aec0',
                borderRadius: 2,
                bgcolor: '#fafbff',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                '&:hover': { borderColor: '#0058be', bgcolor: '#f0f4ff' },
              }}
            >
              <input type="file" accept=".xlsx, .xls, .csv" hidden onChange={handleFileChange} />
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: '#eaedff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0058be',
                  mb: 1.5,
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 26 }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0058be', mb: 0.5 }}>
                {selectedFile ? selectedFile.name : 'Click để chọn file hoặc kéo thả file Excel vào đây'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                Hỗ trợ định dạng .xlsx, .xls, .csv (Dung lượng tối đa 10MB)
              </Typography>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedFile ? (
                <Chip
                  label={`Đã chọn: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`}
                  size="small"
                  sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 700, fontSize: 11 }}
                />
              ) : (
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                  Chưa có file nào được nạp
                </Typography>
              )}

              <Button
                variant="contained"
                onClick={handleUploadRoster}
                disabled={!selectedFile || !selectedClassId || uploading}
                startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                sx={{
                  bgcolor: '#0058be',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0049a3' },
                }}
              >
                {uploading ? 'Đang nạp file...' : 'Tải lên & Ghi danh'}
              </Button>
            </Box>

            {/* Import Result Notification */}
            {importResult && (() => {
              const realErrors = getRealErrors(importResult)
              const hasErrors = realErrors.length > 0

              let alertSeverity = 'success'
              if (hasErrors) {
                alertSeverity = (importResult.enrolledStudents ?? 0) > 0 ? 'warning' : 'error'
              }

              return (
                <Box sx={{ mt: 3 }}>
                  <Alert
                    severity={alertSeverity}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                    sx={{ borderRadius: 1.5, fontSize: 13, fontWeight: 600 }}
                  >
                    Kết quả import: Đã xử lý <strong>{importResult.totalRows ?? 0}</strong> dòng.
                    Ghi danh thành công: <strong>{importResult.enrolledStudents ?? 0}</strong> sinh viên.
                    Tạo tài khoản mới: <strong>{importResult.createdUsers ?? 0}</strong>.
                    {importResult.skippedRows > 0 && ` Bỏ qua: ${importResult.skippedRows} dòng trùng lặp.`}
                  </Alert>

                  {hasErrors && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fee2e2' }}>
                      <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        Các dòng gặp lỗi:
                      </Typography>
                      {realErrors.map((err, i) => (
                        <Typography key={i} variant="caption" sx={{ display: 'block', color: '#ef4444', fontSize: 11 }}>
                          • {err.row ? `Dòng ${err.row}: ` : ''}{err.message || 'Lỗi không xác định'}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )
            })()}

            {/* Danh sách sinh viên thực tế trong lớp */}
            <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid #f0f2f5' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 15 }}>
                    Danh sách sinh viên trong lớp
                  </Typography>
                  <Chip
                    label={`${students.length} sinh viên`}
                    size="small"
                    sx={{
                      bgcolor: students.length > 0 ? '#ecfdf5' : '#f1f5f9',
                      color: students.length > 0 ? '#047857' : '#64748b',
                      fontWeight: 700,
                      fontSize: 11,
                      height: 22,
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Tìm theo Mã SV, Tên, Email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: '#9ca3af' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      width: { xs: '100%', sm: 220 },
                      '& .MuiOutlinedInput-root': {
                        height: 34,
                        fontSize: 12,
                        borderRadius: 1.5,
                        bgcolor: '#fafbff',
                      },
                    }}
                  />
                  <Tooltip title="Làm mới danh sách sinh viên">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => fetchClassStudents(selectedClassId)}
                        disabled={loadingStudents || !selectedClassId}
                        sx={{ border: '1px solid #e4e6ef', borderRadius: 1.5, width: 34, height: 34 }}
                      >
                        {loadingStudents ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              {loadingStudents ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1.5 }}>
                  <CircularProgress size={22} />
                  <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13 }}>
                    Đang tải danh sách sinh viên của lớp...
                  </Typography>
                </Box>
              ) : students.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 1.5, fontSize: 12 }}>
                  Lớp hiện chưa có sinh viên nào được ghi danh. Vui lòng chọn file Excel và bấm <strong>Tải lên &amp; Ghi danh</strong> ở trên.
                </Alert>
              ) : (
                <>
                  <TableContainer
                    sx={{
                      border: '1px solid #e4e6ef',
                      borderRadius: 1.5,
                      maxHeight: 380,
                      overflowY: 'auto',
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: 11, color: '#475569' } }}>
                          <TableCell align="center" sx={{ width: 50 }}>STT</TableCell>
                          <TableCell sx={{ minWidth: 110 }}>MÃ SINH VIÊN</TableCell>
                          <TableCell sx={{ minWidth: 160 }}>HỌ VÀ TÊN</TableCell>
                          <TableCell sx={{ minWidth: 180 }}>EMAIL</TableCell>
                          <TableCell align="center" sx={{ minWidth: 100 }}>NGÀY GHI DANH</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#9ca3af', fontSize: 12 }}>
                              Không tìm thấy sinh viên nào khớp với từ khóa &quot;{studentSearch}&quot;
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredStudents.map((s, index) => {
                            const code = s.studentCode || s.StudentCode || s.code || s.studentId || '—'
                            const name = s.fullName || s.FullName || s.name || s.studentName || '—'
                            const email = s.email || s.Email || s.userEmail || '—'
                            const enrolledDate = s.enrolledAt || s.EnrolledAt
                            const formattedDate = enrolledDate ? new Date(enrolledDate).toLocaleDateString('vi-VN') : '—'

                            return (
                              <TableRow key={s.studentProfileId || s.id || `${code}-${index}`} hover>
                                <TableCell align="center" sx={{ fontSize: 12, color: '#64748b' }}>
                                  {index + 1}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>
                                  <Chip
                                    label={code}
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      bgcolor: '#eff6ff',
                                      color: '#1d4ed8',
                                      borderRadius: 1,
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                                  {name}
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, color: '#475569' }}>
                                  {email}
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: 11, color: '#64748b' }}>
                                  {formattedDate}
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {studentSearch && filteredStudents.length > 0 && (
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontSize: 11 }}>
                      Hiển thị {filteredStudents.length} / {students.length} sinh viên khớp kết quả tìm kiếm
                    </Typography>
                  )}
                </>
              )}
            </Box>

            {/* Accordion Mẫu cấu trúc file Excel chuẩn */}
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                mt: 2,
                border: '1px solid #e4e6ef',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                bgcolor: '#fafbff',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: '#0058be' }} />}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0058be', fontSize: 12 }}>
                  📄 Xem hướng dẫn &amp; cấu trúc file Excel chuẩn để import (.xlsx, .csv)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11, display: 'block', mb: 1 }}>
                  File Excel cần chứa các cột: <strong>Mã SV</strong>, <strong>Họ tên</strong>, <strong>Email trường</strong>. Các dòng trùng lặp sẽ được hệ thống tự động bỏ qua an toàn.
                </Typography>
                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, bgcolor: '#ffffff' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ SV</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HỌ TÊN</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>EMAIL</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>STU204758A</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>Nguyen Van Nhom Truong</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754' }}>stu204758a@smartlab.edu.vn</TableCell>
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>STU204758B</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>Tran Thi Thanh Vien</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754' }}>stu204758b@smartlab.edu.vn</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>

        {/* Right Column: Phân công giảng viên */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 0.5 }}>
                2. Phân công giảng viên
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 12, mb: 2 }}>
                API: <code>POST /api/classes/assign-instructor</code>
              </Typography>

              {/* Giảng viên hiện tại của lớp */}
              {assignedResult || currentClass?.instructorName ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: '#0058be',
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    <PersonIcon />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
                      {assignedResult?.fullName || currentClass?.instructorName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11, display: 'block', mb: 0.5 }}>
                      {assignedResult?.email || 'email-gv@smartlab.edu.vn'}
                    </Typography>
                    <Chip
                      label={assignedResult?.academicTitle || 'Giảng viên phụ trách'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: '#eaedff',
                        color: '#0058be',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                </Paper>
              ) : (
                <Alert severity="info" sx={{ mb: 3, fontSize: 12, borderRadius: 1.5 }}>
                  Lớp này hiện chưa có giảng viên phụ trách. Vui lòng phân công bên dưới.
                </Alert>
              )}

              {/* Gợi ý chọn giảng viên */}
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 1 }}>
                CHỌN NHANH GIẢNG VIÊN MẪU HOẶC NHẬP MỚI:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {sampleInstructors.map((sample) => (
                  <Paper
                    key={sample.code}
                    elevation={0}
                    onClick={() => handleSelectSampleInstructor(sample)}
                    sx={{
                      p: 1.2,
                      px: 2,
                      borderRadius: 1.5,
                      border: instructorForm.instructorCode === sample.code ? '2px solid #0058be' : '1px solid #e2e8f0',
                      bgcolor: instructorForm.instructorCode === sample.code ? '#f0f4ff' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e' }}>
                        {sample.name} ({sample.title})
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                        {sample.code} • {sample.email}
                      </Typography>
                    </Box>
                    <Chip
                      label="Chọn"
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: instructorForm.instructorCode === sample.code ? '#0058be' : '#f1f5f9',
                        color: instructorForm.instructorCode === sample.code ? '#ffffff' : '#64748b',
                      }}
                    />
                  </Paper>
                ))}
              </Box>

              <Button
                variant="outlined"
                fullWidth
                size="small"
                startIcon={<AssignmentIndIcon />}
                onClick={() => setOpenAssignDialog(true)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 1.5,
                  borderColor: '#0058be',
                  color: '#0058be',
                }}
              >
                Nhập thông tin giảng viên khác
              </Button>
            </Box>

            {/* Bottom Form Actions */}
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #f0f2f5' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleAssignInstructor}
                disabled={assigning || !selectedClassId}
                startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : <AssignmentIndIcon />}
                sx={{
                  bgcolor: '#0058be',
                  py: 1.2,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0049a3' },
                }}
              >
                {assigning ? 'Đang phân công...' : `Xác nhận phân công cho ${instructorForm.fullName}`}
              </Button>

              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
                {onPrev && (
                  <Button
                    variant="text"
                    startIcon={<ArrowBackIcon />}
                    onClick={onPrev}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, color: '#6b7280' }}
                  >
                    Quay lại
                  </Button>
                )}
                {onNext && (
                  <Button
                    variant="text"
                    endIcon={<ArrowForwardIcon />}
                    onClick={onNext}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, color: '#0058be', ml: 'auto' }}
                  >
                    Tiếp tục
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Modal Nhập Thông Tin Giảng Viên Mới */}
      <Dialog
        open={openAssignDialog}
        onClose={() => setOpenAssignDialog(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Phân công giảng viên mới
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                MÃ GIẢNG VIÊN (INSTRUCTOR CODE) *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={instructorForm.instructorCode}
                onChange={(e) => setInstructorForm({ ...instructorForm, instructorCode: e.target.value })}
                placeholder="Ví dụ: LEC-009"
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                HỌ VÀ TÊN GIẢNG VIÊN *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={instructorForm.fullName}
                onChange={(e) => setInstructorForm({ ...instructorForm, fullName: e.target.value })}
                placeholder="Ví dụ: TS. Đặng Quang Huy"
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                EMAIL *
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="email"
                value={instructorForm.email}
                onChange={(e) => setInstructorForm({ ...instructorForm, email: e.target.value })}
                placeholder="huydq@smartlab.edu.vn"
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                HỌC HÀM / HỌC VỊ
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={instructorForm.academicTitle}
                onChange={(e) => setInstructorForm({ ...instructorForm, academicTitle: e.target.value })}
                placeholder="Ví dụ: Tiến sĩ, Thạc sĩ, Giảng viên chính"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setOpenAssignDialog(false)}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#6b7280' }}
          >
            Đóng
          </Button>
          <Button
            variant="contained"
            onClick={() => setOpenAssignDialog(false)}
            sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
          >
            Lưu lựa chọn
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notification */}
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
