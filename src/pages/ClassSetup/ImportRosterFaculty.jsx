import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
  PersonAdd as PersonAddIcon,
  AssignmentInd as AssignmentIndIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  ForwardToInbox as MailIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'
import { userService } from '../../services/userService'
import AccountStatusChip from '../../components/common/AccountStatusChip'
import { useEntityChanged } from '../../hooks/useEntityChanged'

/**
 * ImportRosterFaculty Component (Actor: ADMIN / LAB STAFF)
 * Kết nối API MF2:
 * 1. GET /api/classes - Lấy danh sách lớp học
 * 2. POST /api/classes/{id}/roster - Import danh sách sinh viên bằng file Excel
 * 3. POST /api/classes/assign-instructor - Phân công giảng viên cho lớp
 */

/** Dòng của sinh viên đã học trong lớp: chỉ đếm, không liệt kê từng dòng. */
const isAlreadyInClass = (row) => row.outcome === 'Failed' && (row.message || '').startsWith('Sinh viên đã có trong lớp')

/** Chia kết quả import: dòng cần xem (lỗi thật trước, rồi bạn vừa thêm), số bạn đã có sẵn và số dòng lỗi thật. */
function readImportResult(result) {
  const rows = Array.isArray(result?.rows) ? result.rows : []
  const already = rows.filter(isAlreadyInClass)
  const failed = rows.filter((row) => row.outcome === 'Failed' && !isAlreadyInClass(row))
  const added = rows.filter((row) => row.outcome !== 'Failed')
  return { rows: [...failed, ...added], alreadyCount: already.length, failedCount: failed.length }
}

/** Câu tóm tắt: "Đã thêm 1 sinh viên. 16 bạn đã có trong lớp nên bỏ qua. 2 dòng lỗi." */
function importSummary(result) {
  const { alreadyCount, failedCount } = readImportResult(result)
  const parts = [`Đã thêm ${result?.enrolledStudents ?? 0} sinh viên`]
  if (result?.createdUsers > 0) parts.push(`gửi email kích hoạt cho ${result.createdUsers} tài khoản mới`)
  const sentences = [parts.join(', ')]
  if (alreadyCount > 0) sentences.push(`${alreadyCount} bạn đã có trong lớp nên bỏ qua`)
  if (failedCount > 0) sentences.push(`${failedCount} dòng lỗi`)
  return `${sentences.join('. ')}.`
}

function importSeverity(result) {
  if (readImportResult(result).failedCount === 0) return 'success'
  return (result?.enrolledStudents ?? 0) > 0 ? 'warning' : 'error'
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

function resolveAssignedInstructor(assignment, instructors) {
  const instructor = assignment?.instructor || assignment?.instructorProfile
  const instructorCode = String(assignment?.instructorCode || instructor?.instructorCode || '').trim().toLowerCase()
  const fullName = assignment?.fullName || assignment?.instructorName || instructor?.fullName || ''
  const normalizedName = fullName.trim().toLowerCase()
  const matchingInstructor = instructors.find((item) =>
    (instructorCode && item.code?.trim().toLowerCase() === instructorCode) ||
    (normalizedName && item.name?.trim().toLowerCase() === normalizedName)
  )

  return {
    fullName: fullName || matchingInstructor?.name || '',
    email: assignment?.email || assignment?.instructorEmail || instructor?.email || matchingInstructor?.email || '',
    academicTitle: assignment?.academicTitle || instructor?.academicTitle || matchingInstructor?.title || 'Giảng viên phụ trách',
  }
}

/** File mẫu đúng thứ tự cột BE đọc: Mã SV, Họ tên, Email, Ngành, Khóa (dòng 1 là tiêu đề). */
function downloadRosterTemplate() {
  const wb = XLSX.utils.book_new()
  const data = XLSX.utils.aoa_to_sheet([['Mã SV', 'Họ tên', 'Email', 'Ngành (không bắt buộc)', 'Khóa (không bắt buộc)']])
  data['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 32 }, { wch: 24 }, { wch: 20 }]
  const guide = XLSX.utils.aoa_to_sheet([
    ['Hướng dẫn'],
    ['Điền sinh viên vào sheet đầu tiên, từ dòng 2. Giữ nguyên thứ tự cột.'],
    ['Bắt buộc: Mã SV và Email. Dòng trùng MSSV hoặc email trong file sẽ bị bỏ qua.'],
    ['Sinh viên chưa có tài khoản sẽ được tạo tài khoản và gửi email kích hoạt.'],
  ])
  guide['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, data, 'DanhSachSinhVien')
  XLSX.utils.book_append_sheet(wb, guide, 'HuongDan')
  XLSX.writeFile(wb, 'Mau_DanhSach_SinhVien.xlsx')
}

export default function ImportRosterFaculty() {
  const [searchParams] = useSearchParams()
  const requestedSemester = searchParams.get('semester') || ''
  const requestedClassId = searchParams.get('classId') || ''

  // State danh sách lớp học
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [selectedSemester, setSelectedSemester] = useState(requestedSemester || 'ALL')

  // State danh sách sinh viên thực tế trong lớp
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudents, setShowStudents] = useState(false)

  // State upload file Excel
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Danh sách giảng viên trong hệ thống (khởi tạo với các giảng viên mẫu và cập nhật từ API)
  // Chỉ giảng viên thật lấy từ API (không dùng danh sách mẫu, tránh phân công nhầm tài khoản giả)
  const [instructors, setInstructors] = useState([])

  // State phân công giảng viên
  const [instructorForm, setInstructorForm] = useState({
    instructorCode: '',
    fullName: '',
    email: '',
    academicTitle: '',
  })
  const [assigning, setAssigning] = useState(false)
  const [assignedResult, setAssignedResult] = useState(null)
  const [openAssignDialog, setOpenAssignDialog] = useState(false)

  // State form modal Thêm Giảng Viên Mới
  const [newInstructorForm, setNewInstructorForm] = useState({
    instructorCode: '',
    fullName: '',
    email: '',
    academicTitle: 'Tiến sĩ',
  })
  const [newInstructorErrors, setNewInstructorErrors] = useState({})
  const [creatingInstructor, setCreatingInstructor] = useState(false)
  const [resendingId, setResendingId] = useState('')
  const [importError, setImportError] = useState('')

  // Toast alert
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  // Lớp đã có giảng viên khác: BE trả 409, hỏi Admin trước khi thay
  const [replaceConfirm, setReplaceConfirm] = useState(null)

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

  // Sinh viên vừa kích hoạt tài khoản thì trạng thái tự đổi, không cần tải lại trang
  const reloadStudents = useCallback(() => {
    if (!selectedClassId) return
    academicService
      .getClassStudents(selectedClassId)
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [selectedClassId])
  useEntityChanged(reloadStudents)

  // Trạng thái mới nhất của tài khoản trong kết quả import, lấy theo danh sách lớp
  const studentOf = (row) => students.find((student) => student.userId === row.userId) || row

  const handleResend = async (userId) => {
    setResendingId(userId)
    try {
      await userService.resendActivation(userId)
      setToast({ open: true, message: 'Đã gửi lại email kích hoạt.', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setResendingId('')
    }
  }

  const resendButton = (account) =>
    account.activationPending && (
      <Button
        size="small"
        disabled={resendingId === account.userId}
        onClick={() => handleResend(account.userId)}
        sx={{ textTransform: 'none', fontSize: 12, py: 0, whiteSpace: 'nowrap' }}
      >
        Gửi lại mail
      </Button>
    )

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
        if (targetId !== selectedClassId) setAssignedResult(null)
        fetchClassStudents(targetId)
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
          const requestedClass = classList.find((c) => c.classId === requestedClassId)
          const firstInSemester = classList.find((c) => c.semesterCode === requestedSemester)
          const initialClass = requestedClass || firstInSemester || classList[0]
          if (requestedSemester && !firstInSemester && !requestedClass) setSelectedSemester('ALL')
          if (initialClass) {
            setSelectedClassId(initialClass.classId)
            fetchClassStudents(initialClass.classId)
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
  }, [fetchClassStudents, requestedClassId, requestedSemester])

  // Tải danh sách giảng viên từ hệ thống
  useEffect(() => {
    let ignore = false
    userService
      .getUsers({ role: 'Lecturer', page: 1, size: 50 })
      .then((data) => {
        if (!ignore && data) {
          const items = Array.isArray(data) ? data : data?.items || []
          if (items.length > 0) {
            const apiInstructors = items.map((u) => ({
              code:
                u.instructorProfile?.instructorCode ||
                u.instructorCode ||
                `LEC-${String(u.userId || '').slice(0, 4) || '00'}`,
              name: u.fullName || u.username,
              email: u.email,
              title: u.instructorProfile?.academicTitle || u.academicTitle || 'Giảng viên',
            }))

            setInstructors(apiInstructors)
          }
        }
      })
      .catch((err) => {
        console.warn('Không thể tải danh sách giảng viên từ API:', err)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Lớp đang chọn hiện tại
  const currentClass = classes.find((c) => c.classId === selectedClassId) || null
  const assignedInstructor = useMemo(() => {
    const assignment = { ...(currentClass || {}), ...(assignedResult || {}) }
    if (!assignment.fullName && !assignment.instructorName) return null
    return resolveAssignedInstructor(assignment, instructors)
  }, [assignedResult, currentClass, instructors])

  // Khi thay đổi lớp chọn
  const handleClassChange = (e) => {
    const newClassId = e.target.value
    setSelectedClassId(newClassId)
    setImportResult(null)
    setImportError('')
    setStudentSearch('')
    setAssignedResult(null)
    fetchClassStudents(newClassId)
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
      setImportError('')
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
      setImportError('')
      const res = await academicService.importRoster(selectedClassId, selectedFile)
      setImportResult(res)
      setToast({ open: true, message: importSummary(res), severity: importSeverity(res) })
      // Cập nhật lại số sinh viên trong danh sách lớp và tải lại danh sách sinh viên thực tế
      await Promise.all([
        fetchClasses(),
        fetchClassStudents(selectedClassId),
      ])
    } catch (err) {
      setImportResult(null)
      setImportError(err.message || 'Lỗi khi import danh sách sinh viên')
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
    const payload = {
      classId: selectedClassId,
      instructorCode: instructorForm.instructorCode,
      fullName: instructorForm.fullName,
      email: instructorForm.email,
      academicTitle: instructorForm.academicTitle || 'Giảng viên',
    }
    try {
      await submitAssignment(payload)
    } catch (err) {
      if (err.cause?.response?.status === 409) {
        setReplaceConfirm({ message: err.message, payload })
      } else {
        setToast({
          open: true,
          message: err.message || 'Phân công giảng viên thất bại',
          severity: 'error',
        })
      }
    } finally {
      setAssigning(false)
    }
  }

  // Gửi phân công và báo rõ đã đổi gì (giảng viên cũ -> mới, lớp nào)
  const submitAssignment = async (payload) => {
    const res = await academicService.assignInstructor(payload)
    const newName = res?.fullName || payload.fullName
    const classLabel = res?.classCode ? ` lớp ${res.classCode}` : ' lớp'
    setAssignedResult({
      ...(res || {}),
      fullName: newName,
      email: res?.email || payload.email,
      academicTitle: res?.academicTitle || payload.academicTitle || 'Giảng viên',
    })
    setOpenAssignDialog(false)
    setToast({
      open: true,
      message: res?.previousInstructorName
        ? `Đã thay giảng viên ${res.previousInstructorName} bằng ${newName} cho${classLabel}.`
        : `Đã phân công giảng viên ${newName} cho${classLabel}.`,
      severity: 'success',
    })
    fetchClasses()
    return res
  }

  const handleConfirmReplace = async () => {
    if (!replaceConfirm) return
    setAssigning(true)
    try {
      await submitAssignment({ ...replaceConfirm.payload, replaceExisting: true })
      setReplaceConfirm(null)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Phân công giảng viên thất bại', severity: 'error' })
    } finally {
      setAssigning(false)
    }
  }

  // Chọn một giảng viên từ danh sách
  const handleSelectSampleInstructor = (sample) => {
    setInstructorForm({
      instructorCode: sample.code,
      fullName: sample.name,
      email: sample.email,
      academicTitle: sample.title || 'Giảng viên',
    })
  }

  // Mở modal Thêm giảng viên mới
  const handleOpenAddInstructorDialog = () => {
    const nextIndex = instructors.length + 1
    const suggestedCode = `LEC-${String(nextIndex).padStart(3, '0')}`
    setNewInstructorForm({
      instructorCode: suggestedCode,
      fullName: '',
      email: '',
      academicTitle: 'Tiến sĩ',
    })
    setNewInstructorErrors({})
    setOpenAssignDialog(true)
  }

  // Thêm giảng viên mới vào hệ thống và chọn để phân công
  const handleCreateNewInstructor = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    const errors = {}
    if (!selectedClassId) errors.submit = 'Vui lòng chọn một lớp học'
    if (!newInstructorForm.instructorCode.trim()) {
      errors.instructorCode = 'Mã giảng viên không được để trống'
    }
    if (!newInstructorForm.fullName.trim()) {
      errors.fullName = 'Họ và tên giảng viên không được để trống'
    }
    if (!newInstructorForm.email.trim()) {
      errors.email = 'Email không được để trống'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newInstructorForm.email.trim())) {
      errors.email = 'Email không đúng định dạng'
    }

    if (Object.keys(errors).length > 0) {
      setNewInstructorErrors(errors)
      return
    }

    setCreatingInstructor(true)
    setNewInstructorErrors({})

    const newInst = {
      code: newInstructorForm.instructorCode.trim().toUpperCase(),
      name: newInstructorForm.fullName.trim(),
      email: newInstructorForm.email.trim().toLowerCase(),
      title: newInstructorForm.academicTitle?.trim() || 'Giảng viên',
    }

    // BE tạo tài khoản (nếu chưa có), gửi email kích hoạt và phân công luôn vào lớp đang chọn
    const payload = {
      classId: selectedClassId,
      instructorCode: newInst.code,
      fullName: newInst.name,
      email: newInst.email,
      academicTitle: newInst.title,
    }
    let assigned
    try {
      assigned = await submitAssignment(payload)
    } catch (err) {
      if (err.cause?.response?.status === 409) {
        setOpenAssignDialog(false)
        setReplaceConfirm({ message: err.message, payload })
      } else {
        setNewInstructorErrors({ submit: err.message || 'Không thể phân công giảng viên.' })
      }
      setCreatingInstructor(false)
      return
    }

    setCreatingInstructor(false)

    // Cập nhật danh sách giảng viên cục bộ (đặt lên đầu danh sách để dễ thấy)
    setInstructors((prev) => {
      const exists = prev.some(
        (item) => item.code.toUpperCase() === newInst.code || item.email.toLowerCase() === newInst.email
      )
      if (exists) {
        return prev.map((item) =>
          item.code.toUpperCase() === newInst.code || item.email.toLowerCase() === newInst.email ? newInst : item
        )
      }
      return [newInst, ...prev]
    })

    // Tự động chọn ngay giảng viên mới tạo
    setInstructorForm({
      instructorCode: newInst.code,
      fullName: newInst.name,
      email: newInst.email,
      academicTitle: newInst.title,
    })

    if (assigned?.accountCreated) {
      setToast({
        open: true,
        message: `Đã phân công ${newInst.name}. Email kích hoạt đã gửi tới ${newInst.email}.`,
        severity: 'success',
      })
    }
  }

  return (
    <Box>
      {/* Class Selector Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
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
          {/* Phân loại theo kỳ học */}
          <Box sx={{ minWidth: 190 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
              Học kỳ
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
              Lớp
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e' }}>
                Sinh viên
              </Typography>
              <Button
                size="small"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={downloadRosterTemplate}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}
              >
                Tải file mẫu
              </Button>
            </Box>

            {/* Drag and Drop Zone */}
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
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
              <CloudUploadIcon sx={{ fontSize: 26, color: '#0058be', mb: 0.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0058be', mb: 0.5 }}>
                {selectedFile ? selectedFile.name : 'Bấm để chọn file hoặc kéo thả file Excel vào đây'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                Cột: Mã SV, Họ tên, Email (Ngành, Khóa không bắt buộc) · .xlsx, .xls, .csv · tối đa 10MB
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

            {importError && (
              <Alert severity="error" sx={{ mt: 3 }} onClose={() => setImportError('')}>
                {importError}
              </Alert>
            )}

            {/* Import Result Notification */}
            {importResult && (() => {
              const { rows } = readImportResult(importResult)

              return (
                <Box sx={{ mt: 3 }}>
                  <Alert
                    severity={importSeverity(importResult)}
                    sx={{ borderRadius: 1.5, fontSize: 13, fontWeight: 600 }}
                  >
                    {importSummary(importResult)}
                  </Alert>

                  {rows.length > 0 && (
                    <TableContainer sx={{ mt: 1.5, border: '1px solid #e5e7eb', borderRadius: 1.5, maxHeight: 360 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {['Dòng', 'MSSV', 'Họ tên', 'Email', 'Trạng thái', 'Ghi chú'].map((h) => (
                              <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, bgcolor: '#f8fafc' }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => {
                            const account = studentOf(row)
                            return (
                              <TableRow key={row.rowNumber}>
                                <TableCell sx={{ fontSize: 12 }}>{row.rowNumber}</TableCell>
                                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{row.studentCode || '—'}</TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{row.fullName || '—'}</TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{row.email || '—'}</TableCell>
                                <TableCell>
                                  {row.outcome === 'Failed' ? (
                                    <Chip size="small" label="Lỗi" sx={{ fontSize: 11, fontWeight: 700, height: 22, bgcolor: '#fef2f2', color: '#ef4444' }} />
                                  ) : (
                                    <AccountStatusChip account={account} />
                                  )}
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, color: '#64748b' }}>
                                  {row.outcome === 'Failed' ? row.message : resendButton(account)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
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
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                  onClick={() => setShowStudents((current) => !current)}
                >
                  <ExpandMoreIcon
                    sx={{ fontSize: 20, color: '#0058be', transform: showStudents ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 14 }}>
                    {showStudents ? 'Ẩn danh sách sinh viên' : 'Xem danh sách sinh viên'}
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

                {showStudents && students.length > 0 && (
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
                </Box>
                )}
              </Box>

              <Collapse in={showStudents} unmountOnExit>
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
                    <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': { px: 1 } }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: 11, color: '#475569' } }}>
                          <TableCell align="center" sx={{ width: 40 }}>STT</TableCell>
                          <TableCell>MÃ SV</TableCell>
                          <TableCell>HỌ VÀ TÊN</TableCell>
                          <TableCell>EMAIL</TableCell>
                          <TableCell sx={{ width: 140 }}>TÀI KHOẢN</TableCell>
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
                                <TableCell sx={{ fontSize: 12, color: '#475569', wordBreak: 'break-all' }}>
                                  {email}
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
                                    <AccountStatusChip account={s} />
                                    {s.activationPending && (
                                      <Tooltip title="Gửi lại mail">
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="primary"
                                            aria-label="Gửi lại mail"
                                            disabled={resendingId === s.userId}
                                            onClick={() => handleResend(s.userId)}
                                            sx={{ p: 0.25 }}
                                          >
                                            <MailIcon sx={{ fontSize: 18 }} />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    )}
                                  </Box>
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
              </Collapse>
            </Box>

          </Paper>
        </Grid>

        {/* Right Column: Phân công giảng viên */}
        <Grid size={{ xs: 12, md: 5 }} sx={{ alignSelf: 'start' }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 1.5 }}>
                Giảng viên phụ trách
              </Typography>

              {/* Giảng viên hiện tại của lớp */}
              {assignedInstructor ? (
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
                    mb: 2.5,
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
                      {assignedInstructor.fullName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11, display: 'block', mb: 0.5 }}>
                      {assignedInstructor.email || 'Chưa có email trong hồ sơ'}
                    </Typography>
                    <Chip
                      label={assignedInstructor.academicTitle}
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
                <Alert severity="info" sx={{ mb: 2.5, fontSize: 12, borderRadius: 1.5 }}>
                  Lớp chưa có giảng viên phụ trách.
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  options={instructors}
                  value={instructors.find((inst) => inst.code === instructorForm.instructorCode) || null}
                  onChange={(_, selected) => {
                    if (selected) handleSelectSampleInstructor(selected)
                  }}
                  getOptionLabel={(inst) => `${inst.name} (${inst.title})`}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  filterOptions={(options, { inputValue }) => {
                    const q = inputValue.trim().toLowerCase()
                    if (!q) return options
                    return options.filter((inst) =>
                      [inst.name, inst.code, inst.email].some((v) => v && v.toLowerCase().includes(q))
                    )
                  }}
                  renderOption={(props, inst) => (
                    <li {...props} key={inst.code}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{inst.name} ({inst.title})</Typography>
                        <Typography sx={{ fontSize: 11, color: '#6b7280' }}>{inst.code} • {inst.email}</Typography>
                      </Box>
                    </li>
                  )}
                  noOptionsText="Không tìm thấy giảng viên"
                  renderInput={(params) => (
                    <TextField {...params} label="Đổi giảng viên" placeholder="Gõ tên, mã hoặc email" />
                  )}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
                  onClick={handleOpenAddInstructorDialog}
                  sx={{
                    height: 40,
                    flexShrink: 0,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: 1.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Thêm mới
                </Button>
              </Box>
            </Box>

            {/* Bottom Form Actions */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #f0f2f5' }}>
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
                  lineHeight: 1.4,
                  whiteSpace: 'normal',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0049a3' },
                }}
              >
                {assigning ? 'Đang phân công...' : instructorForm.fullName ? `Xác nhận phân công cho ${instructorForm.fullName}` : 'Chọn giảng viên để phân công'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Modal Thêm Giảng Viên Mới */}
      <Dialog open={Boolean(replaceConfirm)} onClose={() => setReplaceConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Xác nhận thay đổi giảng viên phụ trách</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 14, mb: 1.5 }}>{replaceConfirm?.message?.split(' Xác nhận')[0]}</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Thay bằng <strong>{replaceConfirm?.payload?.fullName}</strong> ({replaceConfirm?.payload?.instructorCode})?
            Giảng viên cũ sẽ không còn phụ trách lớp này.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReplaceConfirm(null)} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={assigning}
            onClick={handleConfirmReplace}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Thay đổi
          </Button>
        </DialogActions>
      </Dialog>

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
            {newInstructorErrors.submit && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {newInstructorErrors.submit}
              </Alert>
            )}

            <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px solid #bae6fd' }}>
              <Typography variant="caption" sx={{ color: '#0369a1', display: 'block', lineHeight: 1.5 }}>
                Giảng viên chưa có tài khoản sẽ nhận email gồm tên đăng nhập, mật khẩu và link kích hoạt. Kích hoạt xong mới đăng nhập được.
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                MÃ GIẢNG VIÊN *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={newInstructorForm.instructorCode}
                onChange={(e) => setNewInstructorForm({ ...newInstructorForm, instructorCode: e.target.value })}
                error={Boolean(newInstructorErrors.instructorCode)}
                helperText={newInstructorErrors.instructorCode}
                placeholder="Ví dụ: LEC-004"
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                HỌ VÀ TÊN GIẢNG VIÊN *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={newInstructorForm.fullName}
                onChange={(e) => setNewInstructorForm({ ...newInstructorForm, fullName: e.target.value })}
                error={Boolean(newInstructorErrors.fullName)}
                helperText={newInstructorErrors.fullName}
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
                value={newInstructorForm.email}
                onChange={(e) => setNewInstructorForm({ ...newInstructorForm, email: e.target.value })}
                error={Boolean(newInstructorErrors.email)}
                helperText={newInstructorErrors.email}
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
                value={newInstructorForm.academicTitle}
                onChange={(e) => setNewInstructorForm({ ...newInstructorForm, academicTitle: e.target.value })}
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
            onClick={handleCreateNewInstructor}
            disabled={creatingInstructor}
            startIcon={creatingInstructor ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#0049a3' } }}
          >
            {creatingInstructor ? 'Đang lưu...' : 'Lưu lựa chọn'}
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
