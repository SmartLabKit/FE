import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
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
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Groups as GroupsIcon,
  Mail as MailIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  Star as StarIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'
import { teamService } from '../../services/teamService'
import { useAuth } from '../../context/AuthContext'

/**
 * GroupInviteManager Component (Actor: STUDENT / GROUP LEADER)
 * Kết nối đầy đủ 8 API Nhóm & Lời mời MF2:
 * 1. GET /api/classes/my - Lấy lớp của tôi
 * 2. GET /api/team-invitations/me - Danh sách lời mời đang chờ phản hồi
 * 3. PUT /api/team-invitations/{teamId}/response - Chấp nhận / từ chối lời mời
 * 4. GET /api/classes/{classId}/team - Lấy nhóm đã tham gia trong lớp
 * 5. POST /api/classes/{classId}/teams - Tạo nhóm mới (tự động làm trưởng nhóm)
 * 6. GET /api/classes/{classId}/team-candidates - Danh sách SV cùng lớp có thể mời
 * 7. GET /api/teams/{teamId} - Chi tiết nhóm
 * 8. POST /api/teams/{teamId}/invitations - Mời SV vào nhóm
 * 9. DELETE /api/teams/{teamId}/invitations/{studentProfileId} - Hủy lời mời
 */
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

export default function GroupInviteManager() {
  const { user } = useAuth()

  // State lớp học của sinh viên
  const [myClasses, setMyClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [selectedSemester, setSelectedSemester] = useState('ALL')

  // State lời mời nhóm nhận được
  const [myInvitations, setMyInvitations] = useState([])

  // State nhóm hiện tại trong lớp
  const [currentTeam, setCurrentTeam] = useState(null)
  const [loadingTeam, setLoadingTeam] = useState(false)

  // State form tạo nhóm
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // State ứng viên có thể mời
  const [candidates, setCandidates] = useState([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [invitingId, setInvitingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  // Toast alert
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Danh sách các học kỳ có lớp, sắp xếp từ mới nhất đến cũ nhất
  const semestersList = useMemo(() => {
    const semMap = new Map()
    myClasses.forEach((cls) => {
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
  }, [myClasses])

  // Gom nhóm các lớp theo học kỳ và sắp xếp
  const groupedClassesBySemester = useMemo(() => {
    const groups = {}
    myClasses.forEach((cls) => {
      const sem = cls.semesterCode || 'Khác'
      if (!groups[sem]) groups[sem] = []
      groups[sem].push(cls)
    })

    // Sắp xếp lớp bên trong từng kỳ theo mã lớp
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
  }, [myClasses])

  // Lọc danh sách lớp theo học kỳ đang chọn
  const filteredClasses = useMemo(() => {
    if (selectedSemester === 'ALL') {
      return groupedClassesBySemester.flatMap((g) => g.classes)
    }
    const found = groupedClassesBySemester.find((g) => g.semesterCode === selectedSemester)
    return found ? found.classes : []
  }, [selectedSemester, groupedClassesBySemester])

  const handleSemesterChange = (e) => {
    const sem = e.target.value
    setSelectedSemester(sem)
    if (sem === 'ALL') {
      if (myClasses.length > 0 && !myClasses.some((c) => c.classId === selectedClassId)) {
        setSelectedClassId(myClasses[0].classId)
      }
    } else {
      const inSem = myClasses.filter((c) => c.semesterCode === sem)
      if (inSem.length > 0 && !inSem.some((c) => c.classId === selectedClassId)) {
        setSelectedClassId(inSem[0].classId)
      }
    }
  }

  // 1. Tải danh sách lớp học của sinh viên (GET /api/classes/my)
  const fetchMyClasses = useCallback(async () => {
    try {
      const data = await academicService.getMyClasses()
      const list = Array.isArray(data) ? data : data?.items || []
      list.sort((a, b) => {
        const weightDiff = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
        if (weightDiff !== 0) return weightDiff
        return (a.classCode || '').localeCompare(b.classCode || '')
      })
      setMyClasses(list)
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].classId)
      }
    } catch (err) {
      console.warn('Lỗi khi tải lớp của tôi:', err)
    } finally {
      setLoadingClasses(false)
    }
  }, [selectedClassId])

  // 2. Tải danh sách lời mời nhóm gửi tới tôi (GET /api/team-invitations/me)
  const fetchMyInvitations = useCallback(async () => {
    try {
      const data = await teamService.getMyInvitations()
      setMyInvitations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Lỗi khi tải danh sách lời mời:', err)
    }
  }, [])

  // 4. Tải danh sách ứng viên có thể mời (GET /api/classes/{classId}/team-candidates)
  const fetchCandidates = useCallback(async (classId) => {
    if (!classId) return
    setLoadingCandidates(true)
    try {
      const list = await teamService.getTeamCandidates(classId)
      setCandidates(Array.isArray(list) ? list : [])
    } catch (err) {
      console.warn('Lỗi khi tải ứng viên:', err)
      setCandidates([])
    } finally {
      setLoadingCandidates(false)
    }
  }, [])

  // 3. Tải nhóm của sinh viên trong lớp đang chọn (GET /api/classes/{classId}/team)
  const fetchMyTeamInClass = useCallback(async (classId) => {
    if (!classId) return
    setLoadingTeam(true)
    try {
      const team = await teamService.getMyTeam(classId)
      setCurrentTeam(team)
      if (team) {
        const myRecord = team.members?.find(
          (m) =>
            (user?.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) ||
            (user?.username && m.studentCode?.toUpperCase() === user.username?.toUpperCase()) ||
            (user?.email && m.studentCode?.toUpperCase() === user.email?.split('@')[0]?.toUpperCase()) ||
            (user?.fullName && m.fullName?.toLowerCase() === user.fullName?.toLowerCase())
        )
        if (!myRecord || myRecord.isLeader) {
          fetchCandidates(classId)
        } else {
          setCandidates([])
        }
      } else {
        setCandidates([])
      }
    } catch (err) {
      console.warn('Chưa có nhóm hoặc lỗi tải nhóm:', err)
      setCurrentTeam(null)
      setCandidates([])
    } finally {
      setLoadingTeam(false)
    }
  }, [user, fetchCandidates])

  // Initial load
  useEffect(() => {
    let ignore = false
    academicService
      .getMyClasses()
      .then((data) => {
        if (!ignore) {
          const list = Array.isArray(data) ? data : data?.items || []
          list.sort((a, b) => {
            const weightDiff = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
            if (weightDiff !== 0) return weightDiff
            return (a.classCode || '').localeCompare(b.classCode || '')
          })
          setMyClasses(list)
          if (list.length > 0) {
            setSelectedClassId(list[0].classId)
          }
        }
      })
      .catch((err) => console.warn(err))
      .finally(() => {
        if (!ignore) setLoadingClasses(false)
      })

    teamService
      .getMyInvitations()
      .then((data) => {
        if (!ignore) setMyInvitations(Array.isArray(data) ? data : [])
      })
      .catch((err) => console.warn(err))

    return () => {
      ignore = true
    }
  }, [])

  // Load team & candidates khi đổi classId
  useEffect(() => {
    if (!selectedClassId) return
    let ignore = false

    teamService
      .getMyTeam(selectedClassId)
      .then((team) => {
        if (ignore) return
        setCurrentTeam(team)

        // Chỉ khi sinh viên ĐÃ CÓ NHÓM và là TRƯỞNG NHÓM mới tải danh sách ứng viên (tránh 403 Forbidden từ backend)
        if (team) {
          const myRecord = team.members?.find(
            (m) =>
              (user?.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) ||
              (user?.username && m.studentCode?.toUpperCase() === user.username?.toUpperCase()) ||
              (user?.email && m.studentCode?.toUpperCase() === user.email?.split('@')[0]?.toUpperCase()) ||
              (user?.fullName && m.fullName?.toLowerCase() === user.fullName?.toLowerCase())
          )
          const definitelyNotLeader = myRecord && !myRecord.isLeader

          if (!definitelyNotLeader) {
            setLoadingCandidates(true)
            teamService
              .getTeamCandidates(selectedClassId)
              .then((list) => {
                if (!ignore) setCandidates(Array.isArray(list) ? list : [])
              })
              .catch(() => {
                if (!ignore) setCandidates([])
              })
              .finally(() => {
                if (!ignore) setLoadingCandidates(false)
              })
          }
        }
      })
      .catch(() => {
        if (!ignore) {
          setCurrentTeam(null)
          setCandidates([])
        }
      })
      .finally(() => {
        if (!ignore) setLoadingTeam(false)
      })

    return () => {
      ignore = true
    }
  }, [selectedClassId, user])

  // Phản hồi lời mời (Chấp nhận: Accepted / Từ chối: Rejected)
  const handleRespondInvitation = async (teamId, decision) => {
    const isAccepted =
      decision === 'Accepted' ||
      decision === 'Accept' ||
      decision === 'Chấp nhận' ||
      decision === 'chap nhan'
    const payloadDecision = isAccepted ? 'Accepted' : 'Rejected'
    try {
      await teamService.respondInvitation(teamId, payloadDecision)
      setToast({
        open: true,
        message: isAccepted ? 'Bạn đã chấp nhận lời mời vào nhóm thành công!' : 'Đã từ chối lời mời.',
        severity: isAccepted ? 'success' : 'info',
      })
      // Cập nhật lại danh sách lời mời và nhóm của lớp
      fetchMyInvitations()
      if (selectedClassId) {
        fetchMyTeamInClass(selectedClassId)
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Thao tác không thành công',
        severity: 'error',
      })
    }
  }

  // Tạo nhóm mới (POST /api/classes/{classId}/teams)
  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!selectedClassId) {
      setToast({ open: true, message: 'Vui lòng chọn lớp học', severity: 'warning' })
      return
    }
    if (!newTeamName.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập tên nhóm', severity: 'warning' })
      return
    }

    setCreatingTeam(true)
    try {
      const team = await teamService.createTeam(selectedClassId, { teamName: newTeamName.trim() })
      setCurrentTeam(team)
      setNewTeamName('')
      setToast({
        open: true,
        message: `Đã tạo nhóm "${team.teamName}" thành công! Bạn là nhóm trưởng.`,
        severity: 'success',
      })
      fetchCandidates(selectedClassId)
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Không thể tạo nhóm',
        severity: 'error',
      })
    } finally {
      setCreatingTeam(false)
    }
  }

  // Mời thành viên (POST /api/teams/{teamId}/invitations)
  const handleInviteMember = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId) return
    setInvitingId(studentProfileId)
    try {
      const updatedTeam = await teamService.inviteMember(currentTeam.teamId, studentProfileId)
      setCurrentTeam(updatedTeam)
      setToast({
        open: true,
        message: `Đã gửi lời mời tham gia nhóm tới ${fullName}!`,
        severity: 'success',
      })
      fetchCandidates(selectedClassId)
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Gửi lời mời thất bại',
        severity: 'error',
      })
    } finally {
      setInvitingId(null)
    }
  }

  // Hủy lời mời chưa chấp nhận (DELETE /api/teams/{teamId}/invitations/{studentProfileId})
  const handleCancelInvitation = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId) return
    setCancellingId(studentProfileId)
    try {
      const updatedTeam = await teamService.cancelInvitation(currentTeam.teamId, studentProfileId)
      setCurrentTeam(updatedTeam)
      setToast({
        open: true,
        message: `Đã hủy lời mời sinh viên ${fullName}.`,
        severity: 'info',
      })
      fetchCandidates(selectedClassId)
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Hủy lời mời thất bại',
        severity: 'error',
      })
    } finally {
      setCancellingId(null)
    }
  }

  // Kiểm tra xem sinh viên hiện tại có phải là Trưởng nhóm của nhóm này hay không
  const myMemberRecord = currentTeam?.members?.find(
    (m) =>
      (user?.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) ||
      (user?.username && m.studentCode?.toUpperCase() === user.username?.toUpperCase()) ||
      (user?.email && m.studentCode?.toUpperCase() === user.email?.split('@')[0]?.toUpperCase()) ||
      (user?.fullName && m.fullName?.toLowerCase() === user.fullName?.toLowerCase())
  )
  const isLeader = myMemberRecord
    ? Boolean(myMemberRecord.isLeader)
    : Boolean(candidates.length > 0 || currentTeam?.members?.length === 1)

  // Filter candidate students
  const filteredCandidates = candidates.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      s.studentCode?.toLowerCase().includes(candidateSearch.toLowerCase())
  )

  const selectedClass = myClasses.find((c) => c.classId === selectedClassId) || null

  return (
    <Box>
      {/* Header section */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
            Student Workspace &gt; Quản lý Nhóm &amp; Lời mời
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.5 }}>
            Tạo nhóm, Quản lý thành viên &amp; Lời mời tham gia
          </Typography>
          <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
            Dành cho Sinh viên: Chọn lớp môn học đang tham gia để tạo nhóm đồ án hoặc phản hồi lời mời.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchMyClasses()
            fetchMyInvitations()
            if (selectedClassId) {
              fetchMyTeamInClass(selectedClassId)
            }
          }}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#dcdfe6' }}
        >
          Làm mới
        </Button>
      </Box>

      {/* 1. LỜI MỜI NHẬN ĐƯỢC SECTION (GET /api/team-invitations/me) */}
      {myInvitations.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            border: '1px solid #fed7aa',
            bgcolor: '#fffbeb',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Badge badgeContent={myInvitations.length} color="warning">
              <MailIcon sx={{ color: '#d97706' }} />
            </Badge>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#92400e', fontSize: 15 }}>
              Lời mời tham gia nhóm đang chờ bạn phản hồi
            </Typography>
            <Typography variant="caption" sx={{ color: '#b45309' }}>
              (API: <code>GET /api/team-invitations/me</code> &amp; <code>PUT /api/team-invitations/{'{teamId}'}/response</code>)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {myInvitations.map((inv) => (
              <Paper
                key={inv.invitationId || inv.teamId}
                elevation={0}
                sx={{
                  p: 1.5,
                  px: 2,
                  borderRadius: 1.5,
                  bgcolor: '#ffffff',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                      {inv.teamName}
                    </Typography>
                    <Chip
                      label={`Lớp: ${inv.classCode}`}
                      size="small"
                      sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#eaedff', color: '#0058be' }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>
                    Người mời: <strong>{inv.leaderFullName || inv.leaderStudentCode || inv.invitedBy || 'Trưởng nhóm'}</strong> • Ngày gửi:{' '}
                    {inv.invitedAt ? new Date(inv.invitedAt).toLocaleDateString('vi-VN') : 'Gần đây'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={() => handleRespondInvitation(inv.teamId, 'Accepted')}
                    sx={{
                      bgcolor: '#16a34a',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      '&:hover': { bgcolor: '#15803d' },
                    }}
                  >
                    Chấp nhận
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloseIcon />}
                    onClick={() => handleRespondInvitation(inv.teamId, 'Rejected')}
                    sx={{
                      color: '#dc2626',
                      borderColor: '#fca5a5',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      '&:hover': { bgcolor: '#fee2e2' },
                    }}
                  >
                    Từ chối
                  </Button>
                </Box>
              </Paper>
            ))}
          </Box>
        </Paper>
      )}

      {/* Class Overview & Selection Bar (GET /api/classes/my) */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
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
                Tất cả các kỳ ({myClasses.length} lớp)
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
              CHỌN LỚP MÔN HỌC BẠN ĐANG HỌC:
            </Typography>
            {loadingClasses ? (
              <CircularProgress size={20} />
            ) : (
              <Select
                fullWidth
                size="small"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
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
                          <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode}
                        </MenuItem>
                      )),
                    ])
                  : filteredClasses.map((cls) => (
                      <MenuItem key={cls.classId} value={cls.classId} sx={{ fontSize: 13 }}>
                        <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode} ({cls.semesterCode || 'Học kỳ'})
                      </MenuItem>
                    ))}
              </Select>
            )}
          </Box>
        </Box>

        {selectedClass && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={`Học kỳ: ${selectedClass.semesterCode || 'N/A'}`}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 11 }}
            />
            <Box>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
                GIẢNG VIÊN
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e' }}>
                {selectedClass.instructorName || 'Chưa phân công'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
                SĨ SỐ LỚP
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0058be' }}>
                {selectedClass.currentStudents || 0}/{selectedClass.maxStudents || 30}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* NẾU CHƯA CÓ NHÓM TRONG LỚP NÀY */}
      {!currentTeam && !loadingTeam && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            border: '1px dashed #c2c6d6',
            bgcolor: '#ffffff',
            textAlign: 'center',
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          <GroupsIcon sx={{ fontSize: 56, color: '#0058be', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
            Bạn chưa có nhóm trong lớp này
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 3 }}>
            Hãy đặt tên nhóm và tạo nhóm ngay. Sau khi tạo, bạn sẽ là <strong>Trưởng nhóm</strong> và có quyền mời các bạn cùng lớp tham gia.
          </Typography>

          <Box
            component="form"
            onSubmit={handleCreateTeam}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}
          >
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                TÊN NHÓM MỚI (CREATE TEAM) *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Ví dụ: Nhóm 1 - IoT Smart Home Project"
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={creatingTeam || !newTeamName.trim()}
              startIcon={creatingTeam ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
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
              {creatingTeam ? 'Đang tạo nhóm...' : 'Tạo nhóm ngay (POST /api/classes/{id}/teams)'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ĐANG TẢI DỮ LIỆU NHÓM */}
      {loadingTeam && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={36} />
        </Box>
      )}

      {/* NẾU ĐÃ CÓ NHÓM TRONG LỚP */}
      {currentTeam && !loadingTeam && (
        <Grid container spacing={3}>
          {/* Cột Trái: Thông tin nhóm & Danh sách thành viên (GET /api/teams/{teamId}) */}
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
              {/* Header nhóm */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 17 }}>
                    {currentTeam.teamName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>
                    Mã nhóm: <code>{currentTeam.teamId}</code> • Lớp: {currentTeam.classCode || selectedClass?.classCode}
                  </Typography>
                </Box>
                <Chip
                  label={currentTeam.isReadyForProject ? 'Đã đủ thành viên' : 'Đang tuyển thành viên'}
                  size="small"
                  sx={{
                    bgcolor: currentTeam.isReadyForProject ? '#ecfdf5' : '#eff6ff',
                    color: currentTeam.isReadyForProject ? '#047857' : '#1d4ed8',
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Bảng thành viên nhóm */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                  Thành viên nhóm ({currentTeam.members?.length || 0})
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                  API: <code>GET /api/teams/{'{id}'}</code>
                </Typography>
              </Box>

              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafbff' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>THÀNH VIÊN</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MÃ SV</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>VAI TRÒ</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
                        THAO TÁC
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentTeam.members?.map((m) => (
                      <TableRow key={m.studentProfileId || m.studentCode} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                bgcolor: m.isLeader ? '#0058be' : '#64748b',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {m.fullName?.charAt(0) || 'U'}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e' }}>
                              {m.fullName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754', fontWeight: 600 }}>
                          {m.studentCode}
                        </TableCell>
                        <TableCell>
                          {m.isLeader ? (
                            <Chip
                              icon={<StarIcon sx={{ fontSize: '12px !important' }} />}
                              label="Trưởng nhóm"
                              size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: '#fef3c7', color: '#b45309' }}
                            />
                          ) : (
                            <Chip
                              label="Thành viên"
                              size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={m.status === 'Accepted' ? 'Đã tham gia' : 'Chờ phản hồi'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              bgcolor: m.status === 'Accepted' ? '#dcfce7' : '#fff7ed',
                              color: m.status === 'Accepted' ? '#15803d' : '#c2410c',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          {m.status === 'Pending' && isLeader && (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => handleCancelInvitation(m.studentProfileId, m.fullName)}
                              disabled={cancellingId === m.studentProfileId}
                              sx={{
                                textTransform: 'none',
                                fontSize: 10,
                                fontWeight: 700,
                                height: 24,
                                minWidth: 64,
                                p: 0.5,
                              }}
                            >
                              {cancellingId === m.studentProfileId ? 'Đang hủy...' : 'Hủy lời mời'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Cột Phải: Mời thành viên cùng lớp (Chỉ Trưởng nhóm mới có quyền) */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
                height: '100%',
              }}
            >
              {isLeader ? (
                <>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, color: '#131b2e', mb: 0.5 }}>
                    Mời thành viên cùng lớp
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
                    API: <code>GET /api/classes/{'{id}'}/team-candidates</code> &amp; <code>POST /api/teams/{'{id}'}/invitations</code>
                  </Typography>

                  {/* Tìm kiếm ứng viên */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm bạn cùng lớp theo tên hoặc mã SV..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 38, fontSize: 12 },
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

                  {loadingCandidates ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : filteredCandidates.length === 0 ? (
                    <Alert severity="info" sx={{ fontSize: 12, borderRadius: 1.5 }}>
                      {candidateSearch ? 'Không tìm thấy sinh viên phù hợp.' : 'Không có sinh viên nào trống trong lớp này.'}
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 380, overflowY: 'auto' }}>
                      {filteredCandidates.map((cand) => (
                        <Paper
                          key={cand.studentProfileId || cand.studentCode}
                          elevation={0}
                          sx={{
                            p: 1.2,
                            px: 1.5,
                            borderRadius: 1.5,
                            bgcolor: '#fafbff',
                            border: '1px solid #eef2f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#0284c7', fontSize: 11, fontWeight: 700 }}>
                              {cand.fullName?.charAt(0) || 'S'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12 }}>
                                {cand.fullName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                                {cand.studentCode} • {cand.major || 'Kỹ thuật'} ({cand.cohort || 'K16'})
                              </Typography>
                            </Box>
                          </Box>

                          <Button
                            size="small"
                            variant="contained"
                            disabled={invitingId === cand.studentProfileId}
                            startIcon={
                              invitingId === cand.studentProfileId ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <PersonAddIcon sx={{ fontSize: 14 }} />
                              )
                            }
                            onClick={() => handleInviteMember(cand.studentProfileId, cand.fullName)}
                            sx={{
                              height: 28,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'none',
                              borderRadius: 1,
                              bgcolor: '#0058be',
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#0049a3' },
                            }}
                          >
                            {invitingId === cand.studentProfileId ? 'Đang gửi...' : 'Mời'}
                          </Button>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                  <GroupsIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
                    Bạn là Thành viên của nhóm
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13, maxWidth: 320, mx: 'auto' }}>
                    Theo quy định hệ thống, chỉ <strong>Trưởng nhóm</strong> mới có quyền xem danh sách ứng viên cùng lớp và gửi lời mời tham gia nhóm.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

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
