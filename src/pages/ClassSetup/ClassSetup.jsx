import { useState, useEffect } from 'react'
import {
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
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout, { ACTORS } from '../../components/layout/PortalLayout'
import SemesterClassManager from './SemesterClassManager'
import ImportRosterFaculty from './ImportRosterFaculty'
import CourseQuotaSetting from './CourseQuotaSetting'
import GroupInviteManager from './GroupInviteManager'

/**
 * ClassSetup Component: Trang trung tâm chính cho quy trình Class Setup
 * Tích hợp sơ đồ Swimlane Flowchart và 4 phân hệ tương ứng với các Actor (Admin, Lecturer, Student)
 */
export default function ClassSetup() {
  const location = useLocation()
  const navigate = useNavigate()

  // Xกำหนด tab hiện tại dựa trên path
  const getTabFromPath = (path) => {
    if (path.includes('/admin/semesters')) return 0
    if (path.includes('/admin/roster')) return 1
    if (path.includes('/lecturer/quotas')) return 2
    if (path.includes('/student/groups')) return 3
    return 0 // Default stage 1
  }

  const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname))

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname))
  }, [location.pathname])

  // Lấy actor tương ứng với tab đang chọn
  const getActorForTab = (tabIndex) => {
    switch (tabIndex) {
      case 0:
      case 1:
        return 'ADMIN'
      case 2:
        return 'LECTURER'
      case 3:
        return 'STUDENT'
      default:
        return 'ADMIN'
    }
  }

  const activeActor = getActorForTab(activeTab)

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

  const handleActorChange = (actorId) => {
    if (actorId === 'ADMIN') {
      setActiveTab(0)
      navigate('/class-setup/admin/semesters')
    } else if (actorId === 'LECTURER') {
      setActiveTab(2)
      navigate('/class-setup/lecturer/quotas')
    } else if (actorId === 'STUDENT') {
      setActiveTab(3)
      navigate('/class-setup/student/groups')
    }
  }

  return (
    <PortalLayout activeActor={activeActor} onActorChange={handleActorChange}>
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

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip icon={<AdminIcon sx={{ fontSize: '16px !important' }} />} label="Admin" size="small" variant={activeActor === 'ADMIN' ? 'filled' : 'outlined'} color="primary" />
              <Chip icon={<LecturerIcon sx={{ fontSize: '16px !important' }} />} label="Lecturer" size="small" variant={activeActor === 'LECTURER' ? 'filled' : 'outlined'} color="info" />
              <Chip icon={<StudentIcon sx={{ fontSize: '16px !important' }} />} label="Student Leader" size="small" variant={activeActor === 'STUDENT' ? 'filled' : 'outlined'} color="success" />
            </Box>
          </Box>

          {/* Mini Interactive Swimlane Flowchart visualization matching diagram */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#ffffff',
              border: '1px solid #e0e6ed',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', mb: 1, display: 'block', textTransform: 'uppercase' }}>
              Sơ đồ quy trình làm việc (Actor Workflow Swimlane)
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
