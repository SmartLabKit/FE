import { useState, useEffect } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import {
  SupervisorAccount as AdminIcon,
  School as LecturerIcon,
  Person as StudentIcon,
  SettingsSuggest as SystemIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as CheckIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import SemesterClassManager from './SemesterClassManager'
import ImportRosterFaculty from './ImportRosterFaculty'
import CourseQuotaSetting from './CourseQuotaSetting'
import GroupInviteManager from './GroupInviteManager'
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext'

/**
 * ClassSetup Component: Trang trung tâm chính cho quy trình Class Setup
 * Tự động điều hướng và hiển thị phân hệ tương ứng với tài khoản Actor đang đăng nhập.
 */
export default function ClassSetup() {
  const { user, loginAsRole, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const currentUser = user || DEMO_ACCOUNTS.ADMIN

  // Xác định tab tương ứng với URL hoặc vai trò tài khoản
  const getTabFromPathOrUser = (path, userRole) => {
    if (path.includes('/admin/semesters')) return 0
    if (path.includes('/admin/roster')) return 1
    if (path.includes('/lecturer/quotas')) return 2
    if (path.includes('/student/groups')) return 3

    // Nếu chỉ gõ `/class-setup`, tự chọn tab theo vai trò actor đăng nhập
    if (userRole === 'LECTURER') return 2
    if (userRole === 'STUDENT') return 3
    return 0 // Default ADMIN stage 0
  }

  const [activeTab, setActiveTab] = useState(getTabFromPathOrUser(location.pathname, currentUser.roleLabel))

  useEffect(() => {
    setActiveTab(getTabFromPathOrUser(location.pathname, currentUser.roleLabel))
  }, [location.pathname, currentUser.roleLabel])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
    switch (newValue) {
      case 0:
        navigate('/class-setup/admin/semesters')
        break
      case 1:
        navigate('/class-setup/admin/roster')
        break
      case 2:
        navigate('/class-setup/lecturer/quotas')
        break
      case 3:
        navigate('/class-setup/student/groups')
        break
      default:
        break
    }
  }

  // Chuyển nhanh tài khoản actor
  const handleSwitchActor = (roleKey) => {
    const newUser = loginAsRole(roleKey)
    navigate(newUser.defaultRoute)
  }

  return (
    <PortalLayout>
      <Container maxWidth="xl" disableGutters>
        {/* Banner Header MF2 Class Setup */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid #e4e6ef',
            background: 'linear-gradient(135deg, #ffffff 0%, #f4f7ff 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip
                label="MF2. CLASS SETUP"
                sx={{
                  bgcolor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  height: 24,
                  borderRadius: 1,
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e' }}>
                Quy trình Thiết lập Lớp môn học (Class Setup)
              </Typography>
            </Box>

            {/* Account Role Banner Indicator */}
            <Paper
              elevation={0}
              sx={{
                p: 1,
                px: 2,
                borderRadius: 2,
                bgcolor: '#ffffff',
                border: '1px solid #dcdfe6',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: currentUser.avatarBg || '#0058be',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {currentUser.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 10, display: 'block', fontWeight: 700 }}>
                  ĐANG ĐĂNG NHẬP
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                  {currentUser.name} ({currentUser.roleLabel})
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => navigate('/login')}
                startIcon={<LogoutIcon fontSize="small" />}
                sx={{ ml: 1, textTransform: 'none', fontSize: 11, color: '#ef4444', fontWeight: 700 }}
              >
                Đổi tài khoản
              </Button>
            </Paper>
          </Box>

          {/* Actor Fast Switch Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#6b7280', mr: 1, textTransform: 'uppercase', fontSize: 10 }}>
              Kịch bản Demo Login Actor:
            </Typography>
            <Button
              size="small"
              variant={currentUser.roleLabel === 'ADMIN' ? 'contained' : 'outlined'}
              onClick={() => handleSwitchActor('ADMIN')}
              startIcon={<AdminIcon fontSize="small" />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 11, fontWeight: 700, bgcolor: currentUser.roleLabel === 'ADMIN' ? '#0058be' : 'transparent' }}
            >
              Admin (Nguyễn Văn Minh)
            </Button>
            <Button
              size="small"
              variant={currentUser.roleLabel === 'LECTURER' ? 'contained' : 'outlined'}
              onClick={() => handleSwitchActor('LECTURER')}
              startIcon={<LecturerIcon fontSize="small" />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 11, fontWeight: 700, bgcolor: currentUser.roleLabel === 'LECTURER' ? '#0284c7' : 'transparent', color: currentUser.roleLabel === 'LECTURER' ? '#fff' : '#0284c7', borderColor: '#0284c7' }}
            >
              Giảng viên (Dr. Evelyn Stone)
            </Button>
            <Button
              size="small"
              variant={currentUser.roleLabel === 'STUDENT' ? 'contained' : 'outlined'}
              onClick={() => handleSwitchActor('STUDENT')}
              startIcon={<StudentIcon fontSize="small" />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 11, fontWeight: 700, bgcolor: currentUser.roleLabel === 'STUDENT' ? '#059669' : 'transparent', color: currentUser.roleLabel === 'STUDENT' ? '#fff' : '#059669', borderColor: '#059669' }}
            >
              Sinh viên (Lê Hoàng Nam)
            </Button>
          </Box>

          {/* Mini Interactive Swimlane Flowchart visualization matching diagram */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mt: 2,
              borderRadius: 2,
              bgcolor: '#ffffff',
              border: '1px solid #e0e6ed',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', mb: 1, display: 'block', textTransform: 'uppercase' }}>
              Sơ đồ quy trình làm việc (Swimlane Workflow Diagram)
            </Typography>

            <Grid container spacing={1} alignItems="center">
              {/* Step 1: Admin Create Semester */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  onClick={() => handleTabChange(null, 0)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: activeTab === 0 ? '#0058be' : '#e2e8f0',
                    bgcolor: activeTab === 0 ? '#eaedff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#0058be' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AdminIcon sx={{ fontSize: 16, color: '#0058be' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0058be' }}>
                      ADMIN / LAB STAFF
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                    1. Create Semester &amp; Classes
                  </Typography>
                </Paper>
              </Grid>

              {/* Step 2: Import Roster */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  onClick={() => handleTabChange(null, 1)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: activeTab === 1 ? '#0058be' : '#e2e8f0',
                    bgcolor: activeTab === 1 ? '#eaedff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#0058be' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AdminIcon sx={{ fontSize: 16, color: '#0058be' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0058be' }}>
                      ADMIN / SYSTEM
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                    2. Import Roster &amp; Faculty
                  </Typography>
                </Paper>
              </Grid>

              {/* Step 3: Lecturer Quotas */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  onClick={() => handleTabChange(null, 2)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: activeTab === 2 ? '#0284c7' : '#e2e8f0',
                    bgcolor: activeTab === 2 ? '#e0f2fe' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#0284c7' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <LecturerIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0284c7' }}>
                      LECTURER
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                    3. Set Course Quotas
                  </Typography>
                </Paper>
              </Grid>

              {/* Step 4: Student Group */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  onClick={() => handleTabChange(null, 3)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: activeTab === 3 ? '#059669' : '#e2e8f0',
                    bgcolor: activeTab === 3 ? '#d1fae5' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#059669' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <StudentIcon sx={{ fontSize: 16, color: '#059669' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#059669' }}>
                      STUDENT (LEADER)
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                    4. Create Group &amp; Invite
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          {/* Tabs switch */}
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mt: 2.5,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                minHeight: 40,
                borderRadius: 1.5,
                mr: 1,
              },
              '& .Mui-selected': { color: '#0058be', bgcolor: '#ffffff' },
              '& .MuiTabs-indicator': { height: 3, borderRadius: 1.5, bgcolor: '#0058be' },
            }}
          >
            <Tab label="1. Quản lý Kỳ học & Lớp (Admin)" />
            <Tab label="2. Nhập Danh sách & Phân công (Admin)" />
            <Tab label="3. Cài đặt Định mức Linh kiện (Lecturer)" />
            <Tab label="4. Tạo nhóm & Mời thành viên (Student)" />
          </Tabs>
        </Paper>

        {/* Dynamic Step View Rendering */}
        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && <SemesterClassManager onNext={() => handleTabChange(null, 1)} />}
          {activeTab === 1 && (
            <ImportRosterFaculty
              onNext={() => handleTabChange(null, 2)}
              onPrev={() => handleTabChange(null, 0)}
            />
          )}
          {activeTab === 2 && (
            <CourseQuotaSetting
              onNext={() => handleTabChange(null, 3)}
              onPrev={() => handleTabChange(null, 1)}
            />
          )}
          {activeTab === 3 && <GroupInviteManager onPrev={() => handleTabChange(null, 2)} />}
        </Box>
      </Container>
    </PortalLayout>
  )
}
