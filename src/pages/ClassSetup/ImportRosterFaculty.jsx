import { useState, useEffect, useCallback } from 'react'
import {
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
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'

/**
 * ImportRosterFaculty Component (Actor: ADMIN / LAB STAFF)
 * Kết nối API MF2:
 * 1. GET /api/classes - Lấy danh sách lớp học
 * 2. POST /api/classes/{id}/roster - Import danh sách sinh viên bằng file Excel
 * 3. POST /api/classes/assign-instructor - Phân công giảng viên cho lớp
 */
export default function ImportRosterFaculty({ onNext, onPrev }) {
  // State danh sách lớp học
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(false)

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

  // Tải danh sách lớp
  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const data = await academicService.getClasses()
      const classList = Array.isArray(data) ? data : data?.items || []
      setClasses(classList)
      if (classList.length > 0 && !selectedClassId) {
        setSelectedClassId(classList[0].classId)
        if (classList[0].instructorName) {
          setAssignedResult({
            fullName: classList[0].instructorName,
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
  }, [selectedClassId])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // Lớp đang chọn hiện tại
  const currentClass = classes.find((c) => c.classId === selectedClassId) || null

  // Khi thay đổi lớp chọn
  const handleClassChange = (e) => {
    const newClassId = e.target.value
    setSelectedClassId(newClassId)
    setImportResult(null)
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
      setToast({
        open: true,
        message: `Import thành công! Đã ghi danh ${res?.enrolledStudents ?? 0} sinh viên vào lớp.`,
        severity: 'success',
      })
      // Cập nhật lại số sinh viên trong danh sách lớp
      fetchClasses()
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
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
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
        <SchoolIcon sx={{ color: '#0058be', fontSize: 28 }} />
        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
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
              {classes.length === 0 && (
                <MenuItem value="" disabled>
                  Chưa có lớp nào, vui lòng tạo lớp trước
                </MenuItem>
              )}
              {classes.map((cls) => (
                <MenuItem key={cls.classId} value={cls.classId} sx={{ fontSize: 13 }}>
                  <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode} ({cls.semesterCode || 'Học kỳ'}) | Sĩ số: {cls.currentStudents || 0}/{cls.maxStudents || 30}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>

        {currentClass && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={`Môn: ${currentClass.courseCode || 'N/A'}`}
              size="small"
              sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 700, fontSize: 11 }}
            />
            <Chip
              label={`Sĩ số: ${currentClass.currentStudents || 0}/${currentClass.maxStudents || 30}`}
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
        <Grid item xs={12} md={7}>
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
            {importResult && (
              <Box sx={{ mt: 3 }}>
                <Alert
                  severity={importResult.errors && importResult.errors.length > 0 ? 'warning' : 'success'}
                  icon={<CheckCircleIcon fontSize="inherit" />}
                  sx={{ borderRadius: 1.5, fontSize: 13, fontWeight: 600 }}
                >
                  Kết quả import: Đã xử lý <strong>{importResult.totalRows ?? 0}</strong> dòng.
                  Ghi danh thành công: <strong>{importResult.enrolledStudents ?? 0}</strong> sinh viên.
                  Tạo tài khoản mới: <strong>{importResult.createdUsers ?? 0}</strong>.
                  {importResult.skippedRows > 0 && ` Bỏ qua: ${importResult.skippedRows} dòng trùng lặp.`}
                </Alert>

                {importResult.errors && importResult.errors.length > 0 && (
                  <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fee2e2' }}>
                    <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      Các dòng gặp lỗi:
                    </Typography>
                    {importResult.errors.map((err, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'block', color: '#ef4444', fontSize: 11 }}>
                        • Dòng {err.row}: {err.message}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Template Sample Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#131b2e', mt: 3, mb: 1 }}>
              Mẫu cấu trúc file Excel chuẩn:
            </Typography>
            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ SV</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HỌ VÀ TÊN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>EMAIL TRƯỜNG</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>GHI CHÚ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>SE160245</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>Lê Hoàng Nam</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#424754' }}>namlh.se16@fpt.edu.vn</TableCell>
                    <TableCell sx={{ fontSize: 11, color: '#81899a' }}>K16 - SE</TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>SE160388</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>Trần Thị Thu</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#424754' }}>thutt.se16@fpt.edu.vn</TableCell>
                    <TableCell sx={{ fontSize: 11, color: '#81899a' }}>K16 - SE</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Right Column: Phân công giảng viên */}
        <Grid item xs={12} md={5}>
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
