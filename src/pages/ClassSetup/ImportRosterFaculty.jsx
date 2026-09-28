import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
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
  Typography,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'

/**
 * ImportRosterFaculty Component (Actor: ADMIN / LAB STAFF)
 * Nhập danh sách sinh viên & Phân công giảng viên (Phân hệ 2 trong quy trình Class Setup)
 */
export default function ImportRosterFaculty({ onNext, onPrev }) {
  // State danh sách sinh viên nạp vào
  const [studentList, setStudentList] = useState([
    { id: 1, code: 'STU-2025-098', name: 'Alex Rivera', email: 'alex.rivera@edu.vn', role: 'Student' },
    { id: 2, code: 'STU-2025-112', name: 'Emily Watson', email: 'emily.watson@edu.vn', role: 'Student' },
    { id: 3, code: 'STU-2025-041', name: 'Marcus Brady', email: 'marcus.brady@edu.vn', role: 'Student' },
    { id: 4, code: 'STU-2025-105', name: 'Nghia Nguyen', email: 'nghia.nguyen@edu.vn', role: 'Student' },
    { id: 5, code: 'STU-2025-106', name: 'Le Van C', email: 'levan.c@edu.vn', role: 'Student' },
  ])

  // State giảng viên được chọn
  const [selectedLecturer, setSelectedLecturer] = useState('Dr. Evelyn Stone')
  const [uploadedFileName, setUploadedFileName] = useState('danh_sach_sv_ee302.xlsx')
  const [showSuccessAlert, setShowSuccessAlert] = useState(true)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Danh sách giảng viên hỗ trợ
  const lecturersList = [
    { name: 'Dr. Evelyn Stone', email: 'evelyn.stone@edu.vn', dept: 'Embedded Systems Lab' },
    { name: 'Prof. Alan Turing', email: 'alan.turing@edu.vn', dept: 'Computer Science Lab' },
    { name: 'Dr. Raymond Finch', email: 'raymond.finch@edu.vn', dept: 'Circuits & Hardware Lab' },
  ]

  const currentLecturerInfo = lecturersList.find((l) => l.name === selectedLecturer) || lecturersList[0]

  // Giả lập upload file excel
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFileName(file.name)
      setShowSuccessAlert(true)
      setToast({
        open: true,
        message: `Đã nạp file "${file.name}" thành công! 45 sinh viên đã được ghi nhận.`,
        severity: 'success',
      })
    }
  }

  const handleFinish = () => {
    setToast({
      open: true,
      message: `Đã hoàn tất phân công lớp EE302 cho ${selectedLecturer}!`,
      severity: 'success',
    })
    if (onNext) setTimeout(onNext, 800)
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Breadcrumb Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
          Class Management &gt; EE302 Embedded Systems &gt; Nhập danh sách &amp; Phân công
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.5 }}>
          Nhập danh sách &amp; Phân công
        </Typography>
        <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
          Bước 2: Tải file danh sách sinh viên và phân công giảng viên phụ trách
        </Typography>
      </Box>

      {/* Success Notification Alert Banner */}
      {showSuccessAlert && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon fontSize="inherit" />}
          onClose={() => setShowSuccessAlert(false)}
          sx={{
            mb: 3,
            borderRadius: 2,
            bgcolor: '#e6f4ea',
            color: '#137333',
            border: '1px solid #b7e1cd',
            '& .MuiAlert-icon': { color: '#137333' },
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Hệ thống đã xử lý ghi nhận: 45 sinh viên đã được nạp vào lớp EE302, quyền hạn đã kích hoạt
        </Alert>
      )}

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
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 2 }}>
              Tải file danh sách sinh viên
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
              <input type="file" accept=".xlsx, .csv" hidden onChange={handleFileUpload} />
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
                Kéo thả file Excel hoặc click để tải lên
              </Typography>
              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                File hỗ trợ .xlsx, .csv (Tối đa 10MB)
              </Typography>
            </Box>

            {/* Template Download & Current file badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 3 }}>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0058be', p: 0 }}
              >
                Download Import Template File
              </Button>
              {uploadedFileName && (
                <Chip
                  label={`File đã nạp: ${uploadedFileName}`}
                  size="small"
                  sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 700, fontSize: 11 }}
                />
              )}
            </Box>

            {/* Preview danh sách sinh viên Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#131b2e', mb: 1.5 }}>
              Preview danh sách sinh viên
            </Typography>

            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>STT</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ SV</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HỌ TÊN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>EMAIL</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ROLE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {studentList.map((st) => (
                    <TableRow key={st.id} hover>
                      <TableCell sx={{ fontSize: 12, color: '#6b7280' }}>{st.id}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>{st.code}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>{st.name}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#424754' }}>{st.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={st.role}
                          size="small"
                          sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
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
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 2 }}>
                Phân công giảng viên
              </Typography>

              {/* Lecturer Select Dropdown */}
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                Chọn giảng viên phụ trách cho lớp EE302
              </Typography>
              <Select
                fullWidth
                size="small"
                value={selectedLecturer}
                onChange={(e) => setSelectedLecturer(e.target.value)}
                sx={{ borderRadius: 1.5, height: 42, fontSize: 13, mb: 3 }}
              >
                {lecturersList.map((lec) => (
                  <MenuItem key={lec.name} value={lec.name} sx={{ fontSize: 13 }}>
                    {lec.name} - {lec.dept}
                  </MenuItem>
                ))}
              </Select>

              {/* Selected Lecturer Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Avatar
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: '#0058be',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  ES
                </Avatar>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 14 }}>
                    {currentLecturerInfo.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 12, display: 'block', mb: 0.5 }}>
                    {currentLecturerInfo.email}
                  </Typography>
                  <Chip
                    label="Giảng viên phụ trách lớp EE302 Embedded Systems"
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
            </Box>

            {/* Bottom action buttons */}
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #f0f2f5', display: 'flex', gap: 2 }}>
              {onPrev && (
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={onPrev}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    borderRadius: 1.5,
                    borderColor: '#c2c6d6',
                    color: '#424754',
                  }}
                >
                  Quay lại
                </Button>
              )}
              <Button
                fullWidth
                variant="contained"
                onClick={handleFinish}
                endIcon={<ArrowForwardIcon />}
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
                Hoàn tất nhập liệu &amp; Sang bước 3
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

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
