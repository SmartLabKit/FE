import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  DeleteOutlined as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material'

/**
 * GroupInviteManager Component (Actor: STUDENT / GROUP LEADER)
 * Tạo nhóm & Mời thành viên (Phân hệ 4 trong quy trình Class Setup)
 */
export default function GroupInviteManager({ onPrev }) {
  // State form tạo nhóm mới
  const [groupForm, setGroupForm] = useState({
    name: 'Nhóm 1 - IoT Smart Garden',
    classCode: 'EE302 - Embedded Systems',
    description: 'Dự án IoT giám sát vườn thông minh với cảm biến nhiệt độ, độ ẩm và điều khiển tự động.',
  })

  // State danh sách tìm kiếm sinh viên
  const [searchQuery, setSearchQuery] = useState('')
  const [candidateStudents, setCandidateStudents] = useState([
    { code: 'STU-2025-001', name: 'Nguyen Van A', email: 'nguyenvana@edu.vn', invited: false },
    { code: 'STU-2025-002', name: 'Tran Thi B', email: 'tranthib@edu.vn', invited: false },
    { code: 'STU-2025-003', name: 'Pham Minh C', email: 'phamminhc@edu.vn', invited: false },
  ])

  // State danh sách thành viên hiện tại trong nhóm
  const [members, setMembers] = useState([
    { code: 'STU-2025-101', name: 'Le Hoang Nam', role: 'NHÓM TRƯỞNG', isLeader: true },
    { code: 'STU-2025-004', name: 'Hoang Thi D', role: 'THÀNH VIÊN', isLeader: false },
    { code: 'STU-2025-005', name: 'Le Quang E', role: 'THÀNH VIÊN', isLeader: false },
  ])

  // Toast alert
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Handle tạo nhóm
  const handleCreateGroup = (e) => {
    e.preventDefault()
    setToast({
      open: true,
      message: `Đã tạo nhóm "${groupForm.name}" thành công! Bây giờ bạn có thể mời thành viên.`,
      severity: 'success',
    })
  }

  // Handle mời sinh viên vào nhóm
  const handleInviteStudent = (student) => {
    // Thêm vào danh sách thành viên
    setMembers((prev) => [
      ...prev,
      { code: student.code, name: student.name, role: 'THÀNH VIÊN', isLeader: false },
    ])

    // Cập nhật trạng thái mời
    setCandidateStudents((prev) =>
      prev.map((s) => (s.code === student.code ? { ...s, invited: true } : s))
    )

    setToast({
      open: true,
      message: `Đã gửi lời mời tham gia nhóm tới sinh viên ${student.name}!`,
      severity: 'success',
    })
  }

  // Handle xóa thành viên khỏi nhóm
  const handleRemoveMember = (code) => {
    setMembers((prev) => prev.filter((m) => m.code !== code))
    setCandidateStudents((prev) =>
      prev.map((s) => (s.code === code ? { ...s, invited: false } : s))
    )
    setToast({ open: true, message: 'Đã xoá thành viên khỏi nhóm.', severity: 'info' })
  }

  // Filter candidate students
  const filteredCandidates = candidateStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header section */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
          My Classes &gt; EE302 Embedded Systems &gt; Tạo nhóm
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.5 }}>
          Tạo nhóm &amp; Mời thành viên
        </Typography>
        <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
          Bước 4: Nhóm trưởng tạo nhóm trong lớp và mời thành viên tham gia (Dành cho Sinh viên)
        </Typography>
      </Box>

      {/* Class Overview Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid #e4e6ef',
          bgcolor: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              CLASS
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be' }}>
              EE302 Embedded Systems
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              TERM
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e' }}>
              Semester 2 - 2025-2026
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              STUDENTS
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e' }}>
              32
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              GROUPS
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e' }}>
              6
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
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
           Create New Group
        </Button>
      </Paper>

      <Grid container spacing={3}>
        {/* Left Column: Form Tạo nhóm mới */}
        <Grid item xs={12} md={6}>
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
            <Box component="form" onSubmit={handleCreateGroup}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 0.5 }}>
                Tạo nhóm mới
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2.5 }}>
                Điền thông tin nhóm và chọn lớp môn học trước khi mời thành viên.
              </Typography>

              {/* Tên nhóm */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                  TÊN NHÓM
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ví dụ: Nhóm 1 - IoT Smart Garden"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 13 } }}
                />
              </Box>

              {/* Lớp môn học */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                  LỚP MÔN HỌC
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={groupForm.classCode}
                  onChange={(e) => setGroupForm({ ...groupForm, classCode: e.target.value })}
                  sx={{ borderRadius: 1.5, height: 42, fontSize: 13 }}
                >
                  <MenuItem value="EE302 - Embedded Systems">EE302 - Embedded Systems</MenuItem>
                  <MenuItem value="CS101 - Intro to Programming">CS101 - Intro to Programming</MenuItem>
                  <MenuItem value="ME204 - Robotics Fundamentals">ME204 - Robotics Fundamentals</MenuItem>
                </Select>
              </Box>

              {/* Mô tả ngắn */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#263247', mb: 0.8, display: 'block' }}>
                  MÔ TẢ NGẮN
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="Mô tả đề tài hoặc hướng nghiên cứu của nhóm..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                />
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
                Tạo nhóm
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Mời thành viên */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e' }}>
                Mời thành viên
              </Typography>
              <Chip
                label={`${members.length}/5 phòng trống`}
                size="small"
                sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 800, fontSize: 10 }}
              />
            </Box>

            {/* Search Input */}
            <TextField
              fullWidth
              size="small"
              placeholder="Tìm sinh viên theo tên hoặc mã số"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 40, fontSize: 12 },
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

            {/* Search Results / Invite List */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', mb: 1, display: 'block' }}>
              KẾT QUẢ TÌM KIẾM
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {filteredCandidates.map((st) => (
                <Paper
                  key={st.code}
                  elevation={0}
                  sx={{
                    p: 1.2,
                    px: 2,
                    borderRadius: 1.5,
                    bgcolor: '#fafbff',
                    border: '1px solid #eef2f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#0284c7', fontSize: 12, fontWeight: 700 }}>
                      {st.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12 }}>
                        {st.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                        {st.code}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    size="small"
                    variant={st.invited ? 'outlined' : 'contained'}
                    disabled={st.invited}
                    onClick={() => handleInviteStudent(st)}
                    sx={{
                      minWidth: 64,
                      height: 28,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1,
                      bgcolor: st.invited ? 'transparent' : '#0058be',
                    }}
                  >
                    {st.invited ? 'Đã mời' : 'Mời'}
                  </Button>
                </Paper>
              ))}
            </Box>

            {/* Current Group Members Section */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', mb: 1, display: 'block' }}>
              THÀNH VIÊN HIỆN TẠI ({members.length})
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {members.map((m) => (
                <Paper
                  key={m.code}
                  elevation={0}
                  sx={{
                    p: 1.2,
                    px: 2,
                    borderRadius: 1.5,
                    bgcolor: '#ffffff',
                    border: '1px solid #e4e6ef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: m.isLeader ? '#0058be' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {m.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12 }}>
                        {m.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                        {m.code}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={m.role}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 9,
                        fontWeight: 800,
                        bgcolor: m.isLeader ? '#eaedff' : '#f1f5f9',
                        color: m.isLeader ? '#0058be' : '#475569',
                      }}
                    />
                    {!m.isLeader && (
                      <IconButton size="small" onClick={() => handleRemoveMember(m.code)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>



      {/* Snackbar */}
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
