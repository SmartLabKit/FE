import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Class as ClassIcon,
  CheckCircle as ActiveIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'

/**
 * SemesterClassManager Component (Actor: ADMIN / Lab Staff)
 * Quản lý kỳ học & Lớp môn học (Phân hệ 1 trong quy trình Class Setup)
 */
export default function SemesterClassManager({ onNext }) {
  // State quản lý danh sách kỳ học & lớp môn học
  const [semesterForm, setSemesterForm] = useState({
    name: 'HK2 2025-2026',
    startDate: '2026-01-15',
    endDate: '2026-06-20',
    status: 'Active',
  })

  const [classList, setClassList] = useState([
    { code: 'EE302-01', name: 'EE302 Embedded Systems', lecturer: 'Dr. Evelyn Stone', students: 32, status: 'ACTIVE' },
    { code: 'CS101-01', name: 'CS101 Intro to Programming', lecturer: 'Prof. Alan Turing', students: 80, status: 'ACTIVE' },
    { code: 'ME204-01', name: 'ME204 Robotics Fundamentals', lecturer: 'Dr. Evelyn Stone', students: 45, status: 'ACTIVE' },
    { code: 'EE201-01', name: 'EE201 Circuits Analysis', lecturer: 'Dr. Raymond Finch', students: 22, status: 'ARCHIVED' },
  ])

  // State điều khiển modal Tạo lớp mới
  const [openAddClassModal, setOpenAddClassModal] = useState(false)
  const [newClass, setNewClass] = useState({ code: '', name: '', lecturer: '', students: 30 })

  // Notification state
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Handle tạo kỳ học
  const handleCreateSemester = (e) => {
    e.preventDefault()
    setToast({
      open: true,
      message: `Đã khởi tạo thành công kỳ học "${semesterForm.name}"!`,
      severity: 'success',
    })
  }

  // Handle tạo lớp mới
  const handleSaveNewClass = () => {
    if (!newClass.code || !newClass.name) return
    setClassList((prev) => [
      ...prev,
      {
        code: newClass.code,
        name: newClass.name,
        lecturer: newClass.lecturer || 'Dr. Evelyn Stone',
        students: Number(newClass.students) || 30,
        status: 'ACTIVE',
      },
    ])
    setOpenAddClassModal(false)
    setNewClass({ code: '', name: '', lecturer: '', students: 30 })
    setToast({ open: true, message: `Đã thêm lớp môn học "${newClass.code}" thành công!`, severity: 'success' })
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 0.5 }}>
          Quản lý kỳ học & Lớp môn học
        </Typography>
        <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
          Bước 1: Tạo kỳ học mới và thiết lập lớp môn học cho từng môn
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Form Tạo kỳ học mới */}
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
            <Box component="form" onSubmit={handleCreateSemester}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 0.5 }}>
                Tạo kỳ học mới
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2.5 }}>
                Nhập tháng, năm kỳ học và trạng thái để khởi tạo dữ liệu cơ bản.
              </Typography>

              {/* Tên kỳ học */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                  TÊN KỲ HỌC
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={semesterForm.name}
                  onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })}
                  placeholder="Ví dụ: HK2 2025-2026"
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 13 },
                  }}
                />
              </Box>

              {/* Ngày bắt đầu & Ngày kết thúc */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                    NGÀY BẮT ĐẦU
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    value={semesterForm.startDate}
                    onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 12 },
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                    NGÀY KẾT THÚC
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    value={semesterForm.endDate}
                    onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 12 },
                    }}
                  />
                </Grid>
              </Grid>

              {/* Trạng thái */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                  TRẠNG THÁI
                </Typography>
                <ToggleButtonGroup
                  value={semesterForm.status}
                  exclusive
                  onChange={(e, val) => val && setSemesterForm({ ...semesterForm, status: val })}
                  fullWidth
                  size="small"
                >
                  <ToggleButton
                    value="Active"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      py: 0.8,
                      '&.Mui-selected': { bgcolor: '#0058be', color: '#fff', '&:hover': { bgcolor: '#0049a3' } },
                    }}
                  >
                    Active
                  </ToggleButton>
                  <ToggleButton
                    value="Archived"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      py: 0.8,
                      '&.Mui-selected': { bgcolor: '#6b7280', color: '#fff' },
                    }}
                  >
                    Archived
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
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
                Tạo kỳ học
              </Button>
            </Box>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f0f2f5' }}>
              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                * Lưu ý: Tạo kỳ học sẽ khởi tạo không gian quản lý danh sách sinh viên & định mức linh kiện cho học kỳ mới.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Danh sách lớp môn học */}
        <Grid item xs={12} md={7}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e' }}>
                  Danh sách lớp môn học
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddClassModal(true)}
                  sx={{
                    bgcolor: '#0058be',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    fontSize: 12,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#0049a3' },
                  }}
                >
                  Tạo lớp mới
                </Button>
              </Box>

              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafbff' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ LỚP</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TÊN MÔN HỌC</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>GIẢNG VIÊN</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>SĨ SỐ</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {classList.map((cls) => (
                      <TableRow key={cls.code} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#0058be' }}>{cls.code}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#131b2e' }}>{cls.name}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754' }}>{cls.lecturer}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754', fontWeight: 600 }}>{cls.students}</TableCell>
                        <TableCell>
                          <Chip
                            label={cls.status}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 800,
                              bgcolor: cls.status === 'ACTIVE' ? '#e6f4ea' : '#f1f5f9',
                              color: cls.status === 'ACTIVE' ? '#137333' : '#475569',
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Bottom action to proceed */}
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
                  Tiếp tục: Nhập danh sách & Phân công
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Modal Tạo lớp môn học mới */}
      <Dialog open={openAddClassModal} onClose={() => setOpenAddClassModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Tạo Lớp Môn Học Mới</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Mã Lớp"
              placeholder="VD: EE302-02"
              size="small"
              fullWidth
              value={newClass.code}
              onChange={(e) => setNewClass({ ...newClass, code: e.target.value })}
            />
            <TextField
              label="Tên Môn Học"
              placeholder="VD: EE302 Embedded Systems"
              size="small"
              fullWidth
              value={newClass.name}
              onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
            />
            <TextField
              label="Giảng Viên Phụ Trách"
              placeholder="VD: Dr. Evelyn Stone"
              size="small"
              fullWidth
              value={newClass.lecturer}
              onChange={(e) => setNewClass({ ...newClass, lecturer: e.target.value })}
            />
            <TextField
              label="Sĩ Số Dự Kiến"
              type="number"
              size="small"
              fullWidth
              value={newClass.students}
              onChange={(e) => setNewClass({ ...newClass, students: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddClassModal(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            onClick={handleSaveNewClass}
            variant="contained"
            sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
          >
            Lưu lớp học
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Toast */}
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
