import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  InputAdornment,
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
  Add as AddIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ExitToApp as LeaveIcon,
  Groups as GroupsIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Mail as MailIcon,
  PersonAdd as PersonAddIcon,
  RocketLaunch as ProjectIcon,
  Schedule as ScheduleIcon,
  School as SchoolIcon,
  Search as SearchIcon,
  Star as StarIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { academicService } from '../../services/academicService'
import {
  getTeamFormationOverview,
  getMyTeam,
  getMyInvitations,
  createTeam,
  getTeamCandidates,
  inviteMember,
  cancelInvitation,
  leaveTeam,
  removeMember,
  changeTeamLeader,
  respondInvitation,
} from '../../services/teamFormationApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOCKED_REASON = 'Đã quá hạn chót chia nhóm. Bạn không thể thay đổi nhóm hoặc phản hồi lời mời.'

function formatDeadline(dateStr) {
  if (!dateStr) return 'Chưa thiết lập'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Chưa thiết lập'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function isMemberLeader(member) {
  if (!member) return false
  return member.role === 'Leader' || member.isLeader === true
}

function findMyMemberRecord(team, user) {
  if (!team?.members || !user) return null
  return (
    team.members.find(
      (m) =>
        (user.studentProfileId && m.studentProfileId === user.studentProfileId) ||
        (user.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) ||
        (user.username && m.studentCode?.toUpperCase() === user.username?.toUpperCase()) ||
        (user.email && m.studentCode?.toUpperCase() === user.email?.split('@')[0]?.toUpperCase()) ||
        (user.fullName && m.fullName?.toLowerCase() === user.fullName?.toLowerCase())
    ) || null
  )
}

// ─── Sub-component: Khung trạng thái & hạn chót ───────────────────────────────

function TeamFormationStatusCard({ overview }) {
  if (!overview) return null

  const isOpen = overview.studentsCanChangeTeams === true
  const { deadline, minTeamSize, maxTeamSize } = overview

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 2,
        border: isOpen ? '1px solid #bfdbfe' : '1px solid #fcd34d',
        bgcolor: isOpen ? '#f0f7ff' : '#fffbeb',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        {/* Trạng thái mở / quá hạn */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip
            icon={
              isOpen ? (
                <LockOpenIcon sx={{ fontSize: '15px !important' }} />
              ) : (
                <LockIcon sx={{ fontSize: '15px !important' }} />
              )
            }
            label={isOpen ? 'Đang mở chia nhóm' : 'Đã quá hạn chia nhóm'}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: 12,
              px: 0.5,
              bgcolor: isOpen ? '#dbeafe' : '#fef3c7',
              color: isOpen ? '#1d4ed8' : '#b45309',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: isOpen ? '#1e3a8a' : '#92400e',
              fontSize: 13,
            }}
          >
            {isOpen
              ? 'Sinh viên có thể tạo nhóm, mời thành viên, chuyển trưởng nhóm, rời nhóm và phản hồi lời mời.'
              : 'Thời gian tự chia nhóm đã kết thúc. Các thao tác đổi nhóm và phản hồi lời mời đã bị khóa.'}
          </Typography>
        </Box>

        {/* Thông số hạn chót & quy mô nhóm */}
        <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <ScheduleIcon sx={{ fontSize: 18, color: isOpen ? '#0058be' : '#b45309' }} />
            <Box>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
                HẠN CHÓT
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12.5 }}>
                {formatDeadline(deadline)}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              QUY MÔ NHÓM
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12.5 }}>
              {minTeamSize ?? '—'} – {maxTeamSize ?? '—'} thành viên
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10 }}>
              TỰ ĐỔI NHÓM
            </Typography>
            <Chip
              label={isOpen ? 'Cho phép' : 'Đã khóa'}
              size="small"
              sx={{
                height: 20,
                fontSize: 10.5,
                fontWeight: 700,
                bgcolor: isOpen ? '#dcfce7' : '#fee2e2',
                color: isOpen ? '#15803d' : '#b91c1c',
              }}
            />
          </Box>
        </Box>
      </Box>

      {!isOpen && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: '#92400e', fontSize: 12 }}>
          Lưu ý: Nếu nhóm của bạn đã đạt đủ điều kiện thành viên, bạn vẫn có thể nhấn <strong>Thiết lập dự án</strong> để đăng ký đề tài.
        </Typography>
      )}
    </Paper>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentGroupsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── State lớp học & học kỳ ────────────────────────────────────────────────
  const [myClasses, setMyClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSemester, setSelectedSemester] = useState(() => {
    try {
      return localStorage.getItem('student_selected_semester') || ''
    } catch {
      return ''
    }
  })
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [classesError, setClassesError] = useState('')

  // ── State dữ liệu chính ───────────────────────────────────────────────────
  const [overview, setOverview] = useState(null)
  const [currentTeam, setCurrentTeam] = useState(null) // null = 404 (chưa có nhóm)
  const [myInvitations, setMyInvitations] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // ── State tạo nhóm ────────────────────────────────────────────────────────
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // ── State ứng viên & thao tác thành viên ──────────────────────────────────
  const [candidates, setCandidates] = useState([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [invitingId, setInvitingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [transferringId, setTransferringId] = useState(null)
  const [leavingTeam, setLeavingTeam] = useState(false)
  const [respondingKey, setRespondingKey] = useState(null)

  // ── Confirm Dialog & Toast ────────────────────────────────────────────────
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'transfer' | 'remove' | 'leave' | 'cancelInvitation', member? }
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }, [])

  // ── Danh sách học kỳ & lớp theo học kỳ ────────────────────────────────────
  const semestersList = useMemo(() => {
    const semMap = new Map()
    myClasses.forEach((cls) => {
      const code = cls.semesterCode || 'Chưa phân kỳ'
      if (!semMap.has(code)) {
        semMap.set(code, { code, weight: getSemesterWeight(code), count: 1 })
      } else {
        semMap.get(code).count += 1
      }
    })
    return Array.from(semMap.values()).sort((a, b) => b.weight - a.weight)
  }, [myClasses])

  const groupedClassesBySemester = useMemo(() => {
    const groups = {}
    myClasses.forEach((cls) => {
      const sem = cls.semesterCode || 'Chưa phân kỳ'
      if (!groups[sem]) groups[sem] = []
      groups[sem].push(cls)
    })
    Object.keys(groups).forEach((sem) => {
      groups[sem].sort((a, b) => (a.classCode || '').localeCompare(b.classCode || ''))
    })
    return Object.keys(groups)
      .sort((a, b) => getSemesterWeight(b) - getSemesterWeight(a))
      .map((sem) => ({ semesterCode: sem, classes: groups[sem] }))
  }, [myClasses])

  const filteredClasses = useMemo(() => {
    const found = groupedClassesBySemester.find((g) => g.semesterCode === selectedSemester)
    return found ? found.classes : myClasses
  }, [selectedSemester, groupedClassesBySemester, myClasses])

  const selectedClass = useMemo(
    () => myClasses.find((c) => c.classId === selectedClassId) || null,
    [myClasses, selectedClassId]
  )

  const handleSemesterChange = (e) => {
    const sem = e.target.value
    setSelectedSemester(sem)
    try {
      localStorage.setItem('student_selected_semester', sem)
    } catch {
      // ignore storage error
    }
    const inSem = myClasses.filter((c) => (c.semesterCode || 'Chưa phân kỳ') === sem)
    if (inSem.length > 0 && !inSem.some((c) => c.classId === selectedClassId)) {
      setSelectedClassId(inSem[0].classId)
    }
  }

  // ── Tải danh sách ứng viên (chỉ khi là Leader & nhóm chưa đầy) ────────────
  const fetchCandidates = useCallback(async (classId) => {
    if (!classId) return
    setLoadingCandidates(true)
    try {
      const list = await getTeamCandidates(classId)
      setCandidates(Array.isArray(list) ? list : [])
    } catch {
      setCandidates([])
    } finally {
      setLoadingCandidates(false)
    }
  }, [])

  // ── Tải toàn bộ dữ liệu màn hình cho lớp đang chọn ────────────────────────
  const fetchPageData = useCallback(
    async (classId, { silent = false } = {}) => {
      if (!classId) return
      if (!silent) setLoadingData(true)
      try {
        const [ov, team, invites] = await Promise.all([
          getTeamFormationOverview(classId),
          getMyTeam(classId),
          getMyInvitations(),
        ])
        setOverview(ov)
        setCurrentTeam(team)
        setMyInvitations(Array.isArray(invites) ? invites : [])

        if (team && !team.isFull) {
          const myRec = findMyMemberRecord(team, user)
          const leaderFlag = myRec ? isMemberLeader(myRec) : team.members?.length === 1
          if (leaderFlag) {
            fetchCandidates(classId)
          } else {
            setCandidates([])
          }
        } else {
          setCandidates([])
        }
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu nhóm và lời mời', 'error')
      } finally {
        if (!silent) setLoadingData(false)
      }
    },
    [user, fetchCandidates, showToast]
  )

  // ── Initial load: danh sách lớp + lời mời đến tôi ─────────────────────────
  useEffect(() => {
    let ignore = false
    setLoadingClasses(true)
    Promise.all([academicService.getMyClasses(), academicService.getSemesters()])
      .then(([data, semesters]) => {
        if (ignore) return
        const list = Array.isArray(data) ? data : data?.items || []
        const semList = Array.isArray(semesters) ? semesters : semesters?.items || []
        list.sort((a, b) => {
          const wd = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
          return wd !== 0 ? wd : (a.classCode || '').localeCompare(b.classCode || '')
        })
        setMyClasses(list)
        setClassesError('')
        if (list.length > 0) {
          const activeSem = semList.find((s) => s.isActive)
          const initialClass =
            list.find(
              (c) =>
                (activeSem?.semesterId && c.semesterId === activeSem.semesterId) ||
                (activeSem?.semesterCode && c.semesterCode === activeSem.semesterCode)
            ) || list[0]
          setSelectedSemester(initialClass.semesterCode || 'Chưa phân kỳ')
          setSelectedClassId(initialClass.classId)
        }
      })
      .catch((err) => {
        if (!ignore) setClassesError(err.message || 'Không thể tải lớp học của bạn.')
      })
      .finally(() => {
        if (!ignore) setLoadingClasses(false)
      })

    getMyInvitations()
      .then((list) => {
        if (!ignore) setMyInvitations(Array.isArray(list) ? list : [])
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [])

  // ── Tải dữ liệu nhóm khi đổi lớp ──────────────────────────────────────────
  useEffect(() => {
    if (selectedClassId) {
      setCandidateSearch('')
      fetchPageData(selectedClassId)
    }
  }, [selectedClassId, fetchPageData])

  // ── Computed flags ────────────────────────────────────────────────────────
  const isOpen = overview ? overview.studentsCanChangeTeams === true : true
  const myMemberRecord = useMemo(() => findMyMemberRecord(currentTeam, user), [currentTeam, user])
  const isLeader = myMemberRecord
    ? isMemberLeader(myMemberRecord)
    : Boolean(candidates.length > 0 || currentTeam?.members?.length === 1)

  const acceptedMembers = useMemo(
    () => currentTeam?.members?.filter((m) => m.status === 'Accepted') ?? [],
    [currentTeam]
  )
  const pendingMembers = useMemo(
    () => currentTeam?.members?.filter((m) => m.status === 'Pending') ?? [],
    [currentTeam]
  )
  const isFull = currentTeam?.isFull === true
  const isReadyForProject = currentTeam?.isReadyForProject === true
  const maxTeamSize = overview?.maxTeamSize ?? null
  const minTeamSize = overview?.minTeamSize ?? null

  // Trưởng nhóm phải chuyển quyền trước khi rời nếu còn thành viên Accepted khác
  const leaderMustTransferBeforeLeave = isLeader && acceptedMembers.length > 1

  const filteredCandidates = useMemo(
    () =>
      candidates.filter(
        (s) =>
          s.fullName?.toLowerCase().includes(candidateSearch.toLowerCase()) ||
          s.studentCode?.toLowerCase().includes(candidateSearch.toLowerCase())
      ),
    [candidates, candidateSearch]
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  // 1. Tạo nhóm mới (POST /api/classes/{classId}/teams)
  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!isOpen) {
      showToast(LOCKED_REASON, 'warning')
      return
    }
    if (!selectedClassId) {
      showToast('Vui lòng chọn lớp học', 'warning')
      return
    }
    if (!newTeamName.trim()) {
      showToast('Vui lòng nhập tên nhóm', 'warning')
      return
    }

    setCreatingTeam(true)
    try {
      const team = await createTeam(selectedClassId, newTeamName.trim())
      setNewTeamName('')
      showToast(`Đã tạo nhóm "${team?.teamName || newTeamName.trim()}" thành công! Bạn là Trưởng nhóm.`)
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Không thể tạo nhóm', 'error')
    } finally {
      setCreatingTeam(false)
    }
  }

  // 2. Phản hồi lời mời (PUT /api/team-invitations/{teamId}/response)
  const handleRespondInvitation = async (teamId, decision) => {
    if (!isOpen) {
      showToast(LOCKED_REASON, 'warning')
      return
    }
    const payloadDecision = decision === 'Accepted' ? 'Accepted' : 'Rejected'
    setRespondingKey(`${teamId}:${payloadDecision}`)
    try {
      await respondInvitation(teamId, payloadDecision)
      showToast(
        payloadDecision === 'Accepted'
          ? 'Bạn đã chấp nhận lời mời vào nhóm thành công!'
          : 'Đã từ chối lời mời.',
        payloadDecision === 'Accepted' ? 'success' : 'info'
      )
      if (selectedClassId) {
        await fetchPageData(selectedClassId, { silent: true })
      } else {
        const list = await getMyInvitations()
        setMyInvitations(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      showToast(err.message || 'Phản hồi lời mời thất bại', 'error')
    } finally {
      setRespondingKey(null)
    }
  }

  // 3. Mời thành viên (POST /api/teams/{teamId}/invitations)
  const handleInviteMember = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId || !isOpen || isFull) return
    setInvitingId(studentProfileId)
    try {
      await inviteMember(currentTeam.teamId, studentProfileId)
      showToast(`Đã gửi lời mời tham gia nhóm tới ${fullName}!`)
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Gửi lời mời thất bại', 'error')
    } finally {
      setInvitingId(null)
    }
  }

  // 4. Hủy lời mời chưa nhận (DELETE /api/teams/{teamId}/invitations/{studentProfileId})
  const handleCancelInvitation = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId || !isOpen) return
    setCancellingId(studentProfileId)
    try {
      await cancelInvitation(currentTeam.teamId, studentProfileId)
      showToast(`Đã hủy lời mời sinh viên ${fullName}.`, 'info')
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Hủy lời mời thất bại', 'error')
    } finally {
      setCancellingId(null)
    }
  }

  // 5. Xóa thành viên (DELETE /api/teams/{teamId}/members/{studentProfileId})
  const handleRemoveMember = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId || !isOpen) return
    setCancellingId(studentProfileId)
    try {
      await removeMember(currentTeam.teamId, studentProfileId)
      showToast(`Đã xóa thành viên ${fullName} khỏi nhóm.`)
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Xóa thành viên thất bại', 'error')
    } finally {
      setCancellingId(null)
    }
  }

  // 6. Chuyển quyền trưởng nhóm (PUT /api/teams/{teamId}/leader)
  const handleTransferLeader = async (studentProfileId, fullName) => {
    if (!currentTeam?.teamId || !isOpen) return
    setTransferringId(studentProfileId)
    try {
      await changeTeamLeader(currentTeam.teamId, studentProfileId)
      showToast(`Đã chuyển quyền trưởng nhóm cho ${fullName}.`)
      setCandidates([])
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Chuyển quyền trưởng nhóm thất bại', 'error')
    } finally {
      setTransferringId(null)
    }
  }

  // 7. Rời nhóm (POST /api/teams/{teamId}/leave)
  const handleLeaveTeam = async () => {
    if (!currentTeam?.teamId || !isOpen) return
    setLeavingTeam(true)
    try {
      await leaveTeam(currentTeam.teamId)
      showToast('Bạn đã rời nhóm thành công.', 'info')
      setCandidates([])
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Rời nhóm thất bại', 'error')
    } finally {
      setLeavingTeam(false)
    }
  }

  // Thực thi xác nhận từ Dialog
  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const { type, member } = confirmAction
    setConfirmAction(null)
    if (type === 'transfer' && member) {
      await handleTransferLeader(member.studentProfileId, member.fullName)
    } else if (type === 'remove' && member) {
      await handleRemoveMember(member.studentProfileId, member.fullName)
    } else if (type === 'cancelInvitation' && member) {
      await handleCancelInvitation(member.studentProfileId, member.fullName)
    } else if (type === 'leave') {
      await handleLeaveTeam()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PortalLayout
      headerTitle="Nhóm & Lời mời"
      headerSubtitle="Tạo nhóm, mời thành viên và phản hồi lời mời"
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto', boxSizing: 'border-box' }}
      >
        <Box>
          {/* Header section */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
                Không gian sinh viên &gt; Quản lý Nhóm &amp; Lời mời
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.5 }}>
                Tạo nhóm, Quản lý thành viên &amp; Lời mời tham gia
              </Typography>
            </Box>
          </Box>

          {/* ── 1. Chọn học kỳ & lớp học (GET /api/classes/my) ───────────────── */}
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

              {/* Học kỳ */}
              <Box sx={{ minWidth: 190 }}>
                <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
                  Học kỳ:
                </Typography>
                {loadingClasses ? (
                  <CircularProgress size={20} />
                ) : (
                  <Select
                    fullWidth
                    size="small"
                    value={selectedSemester}
                    onChange={handleSemesterChange}
                    displayEmpty
                    sx={{ borderRadius: 1.5, height: 40, fontSize: 13, bgcolor: '#fafbff' }}
                  >
                    {semestersList.length === 0 && (
                      <MenuItem value="" disabled>
                        Chưa có học kỳ
                      </MenuItem>
                    )}
                    {semestersList.map((sem) => (
                      <MenuItem key={sem.code} value={sem.code} sx={{ fontSize: 13 }}>
                        Kỳ {sem.code} ({sem.count} lớp)
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </Box>

              {/* Môn học / Lớp */}
              <Box sx={{ flex: 1, minWidth: 260 }}>
                <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
                  Môn học:
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
                    {filteredClasses.map((cls) => (
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

          {classesError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {classesError}
            </Alert>
          )}

          {!loadingClasses && !classesError && myClasses.length === 0 && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Bạn chưa được đăng ký vào lớp học nào.
            </Alert>
          )}

          {/* ── 2. Khung trạng thái & hạn chót (GET /api/classes/{classId}/team-formation) ── */}
          {!loadingData && selectedClassId && <TeamFormationStatusCard overview={overview} />}

          {/* ── 3. Lời mời đến tôi (GET /api/team-invitations/me) ────────────── */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              border: myInvitations.length > 0 ? '1px solid #fed7aa' : '1px solid #e4e6ef',
              bgcolor: myInvitations.length > 0 ? '#fffbeb' : '#ffffff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: myInvitations.length > 0 ? 1.5 : 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Badge badgeContent={myInvitations.length} color="warning">
                  <MailIcon sx={{ color: myInvitations.length > 0 ? '#d97706' : '#0058be' }} />
                </Badge>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: myInvitations.length > 0 ? '#92400e' : '#131b2e',
                    fontSize: 15,
                  }}
                >
                  Lời mời đến tôi
                </Typography>
              </Box>
              {!isOpen && myInvitations.length > 0 && (
                <Chip
                  icon={<LockIcon sx={{ fontSize: '13px !important' }} />}
                  label="Đã khóa phản hồi do quá hạn"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: '#fef3c7',
                    color: '#b45309',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
              )}
            </Box>

            {myInvitations.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13 }}>
                Bạn hiện không có lời mời tham gia nhóm nào đang chờ phản hồi.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {myInvitations.map((inv) => {
                  const accepting = respondingKey === `${inv.teamId}:Accepted`
                  const rejecting = respondingKey === `${inv.teamId}:Rejected`
                  const isBusy = accepting || rejecting
                  return (
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
                        opacity: !isOpen ? 0.78 : 1,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                            {inv.teamName}
                          </Typography>
                          {inv.classCode && (
                            <Chip
                              label={`Lớp: ${inv.classCode}`}
                              size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#eaedff', color: '#0058be' }}
                            />
                          )}
                          {inv.memberCount !== undefined && (
                            <Chip
                              label={`${inv.memberCount}${inv.maxTeamSize ? `/${inv.maxTeamSize}` : ''} thành viên`}
                              size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                          Trưởng nhóm:{' '}
                          <strong>{inv.leaderFullName || inv.leaderStudentCode || inv.invitedBy || 'Trưởng nhóm'}</strong>
                          {inv.invitedAt && ` • Ngày gửi: ${new Date(inv.invitedAt).toLocaleDateString('vi-VN')}`}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!isOpen || isBusy}
                              startIcon={
                                accepting ? <CircularProgress size={13} color="inherit" /> : <CheckIcon />
                              }
                              onClick={() => handleRespondInvitation(inv.teamId, 'Accepted')}
                              sx={{
                                bgcolor: '#16a34a',
                                color: '#ffffff',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 12,
                                boxShadow: 'none',
                                '&:hover': { bgcolor: '#15803d' },
                              }}
                            >
                              Chấp nhận
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!isOpen || isBusy}
                              startIcon={
                                rejecting ? <CircularProgress size={13} color="inherit" /> : <CloseIcon />
                              }
                              onClick={() => handleRespondInvitation(inv.teamId, 'Rejected')}
                              sx={{
                                color: '#dc2626',
                                borderColor: '#fca5a5',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 12,
                                '&:hover': { bgcolor: '#fee2e2', borderColor: '#f87171' },
                              }}
                            >
                              Từ chối
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </Paper>
                  )
                })}
              </Box>
            )}
          </Paper>

          {/* ── 4. Đang tải dữ liệu nhóm ────────────────────────────────────── */}
          {loadingData && selectedClassId && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          )}

          {/* ── 5A. CHƯA CÓ NHÓM TRONG LỚP (404) -> Form tạo nhóm ───────────── */}
          {!loadingData && selectedClassId && !currentTeam && (
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
              <GroupsIcon sx={{ fontSize: 56, color: isOpen ? '#0058be' : '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
                Bạn chưa có nhóm trong lớp này
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 2.5 }}>
                {isOpen ? (
                  <>
                    Hãy đặt tên nhóm và tạo nhóm ngay. Sau khi tạo, bạn sẽ là <strong>Trưởng nhóm</strong> và có quyền mời các bạn cùng lớp tham gia.
                  </>
                ) : (
                  'Thời hạn tự tạo nhóm đã kết thúc. Vui lòng liên hệ giảng viên phụ trách lớp để được hỗ trợ phân nhóm.'
                )}
              </Typography>

              {!isOpen && (
                <Alert severity="warning" sx={{ mb: 2.5, textAlign: 'left', borderRadius: 1.5, fontSize: 12.5 }}>
                  {LOCKED_REASON}
                </Alert>
              )}

              <Box
                component="form"
                onSubmit={handleCreateTeam}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  textAlign: 'left',
                  opacity: isOpen ? 1 : 0.6,
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', display: 'block', mb: 0.5 }}>
                    TÊN NHÓM MỚI *
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={!isOpen || creatingTeam}
                    placeholder="Ví dụ: Nhóm 1 - IoT Smart Home Project"
                    inputProps={{ maxLength: 100 }}
                  />
                </Box>

                <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                  <span>
                    <Button
                      fullWidth
                      type="submit"
                      variant="contained"
                      disabled={!isOpen || creatingTeam || !newTeamName.trim()}
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
                      {creatingTeam ? 'Đang tạo nhóm...' : 'Tạo nhóm ngay'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Paper>
          )}

          {/* ── 5B. ĐÃ CÓ NHÓM TRONG LỚP ────────────────────────────────────── */}
          {!loadingData && selectedClassId && currentTeam && (
            <Grid container spacing={3}>
              {/* Cột Trái: Thông tin nhóm & Danh sách thành viên */}
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
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 1.5,
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 17 }}>
                          {currentTeam.teamName}
                        </Typography>
                        {isLeader && (
                          <Chip
                            icon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                            label="Trưởng nhóm"
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 800,
                              bgcolor: '#fef3c7',
                              color: '#b45309',
                              '& .MuiChip-icon': { color: 'inherit' },
                            }}
                          />
                        )}
                        {isFull && (
                          <Chip
                            label="Nhóm đã đầy"
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 700,
                              bgcolor: '#f1f5f9',
                              color: '#475569',
                            }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12.5, mt: 0.5 }}>
                        <strong>
                          {currentTeam.memberCount ?? acceptedMembers.length}
                          {maxTeamSize ? `/${maxTeamSize}` : ''}
                        </strong>{' '}
                        thành viên chính thức
                        {pendingMembers.length > 0 && ` • ${pendingMembers.length} lời mời đang chờ`}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexDirection: 'column' }}>
                      <Chip
                        label={isReadyForProject ? 'Đủ điều kiện lập dự án' : 'Đang tuyển thành viên'}
                        size="small"
                        sx={{
                          bgcolor: isReadyForProject ? '#ecfdf5' : '#eff6ff',
                          color: isReadyForProject ? '#047857' : '#1d4ed8',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      />

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {/* Nút lối tắt Thiết lập dự án (vẫn mở khi quá hạn nếu isReadyForProject === true) */}
                        <Tooltip
                          title={
                            isReadyForProject
                              ? 'Đi tới màn hình thiết lập dự án cho nhóm'
                              : `Nhóm cần đủ tối thiểu ${minTeamSize ?? 'số'} thành viên để thiết lập dự án`
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!isReadyForProject}
                              startIcon={<ProjectIcon sx={{ fontSize: 15 }} />}
                              onClick={() => navigate(`/class-setup/student/project/${currentTeam.teamId}`)}
                              sx={{
                                bgcolor: '#0058be',
                                textTransform: 'none',
                                fontWeight: 700,
                                boxShadow: 'none',
                                whiteSpace: 'nowrap',
                                '&:hover': { bgcolor: '#0049a3' },
                              }}
                            >
                              Thiết lập dự án
                            </Button>
                          </span>
                        </Tooltip>

                        {/* Nút Rời nhóm */}
                        <Tooltip
                          title={
                            !isOpen
                              ? LOCKED_REASON
                              : leaderMustTransferBeforeLeave
                                ? 'Trưởng nhóm cần chuyển quyền trưởng nhóm cho thành viên khác trước khi rời nhóm'
                                : ''
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={!isOpen || leavingTeam || leaderMustTransferBeforeLeave}
                              startIcon={
                                leavingTeam ? (
                                  <CircularProgress size={13} color="inherit" />
                                ) : (
                                  <LeaveIcon sx={{ fontSize: 15 }} />
                                )
                              }
                              onClick={() => setConfirmAction({ type: 'leave' })}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {leavingTeam ? 'Đang rời...' : 'Rời nhóm'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Bảng thành viên nhóm */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                      Thành viên nhóm ({currentTeam.members?.length || 0})
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
                        {currentTeam.members?.map((m) => {
                          const memberIsLeader = isMemberLeader(m)
                          const isAccepted = m.status === 'Accepted'
                          const isSelf =
                            (myMemberRecord && m.studentProfileId === myMemberRecord.studentProfileId) ||
                            (user?.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase())

                          return (
                            <TableRow key={m.studentProfileId || m.studentCode} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      bgcolor: memberIsLeader ? '#0058be' : '#64748b',
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {m.fullName?.charAt(0) || 'U'}
                                  </Avatar>
                                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e' }}>
                                    {m.fullName}
                                    {isSelf && (
                                      <Box component="span" sx={{ color: '#0058be', fontWeight: 600, ml: 0.5 }}>
                                        (Bạn)
                                      </Box>
                                    )}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontSize: 12, color: '#424754', fontWeight: 600 }}>
                                {m.studentCode}
                              </TableCell>
                              <TableCell>
                                {memberIsLeader ? (
                                  <Chip
                                    icon={<StarIcon sx={{ fontSize: '12px !important' }} />}
                                    label="Trưởng nhóm"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: 10,
                                      fontWeight: 800,
                                      bgcolor: '#fef3c7',
                                      color: '#b45309',
                                      '& .MuiChip-icon': { color: 'inherit' },
                                    }}
                                  />
                                ) : (
                                  <Chip
                                    label="Thành viên"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      bgcolor: '#f1f5f9',
                                      color: '#475569',
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={isAccepted ? 'Đã tham gia' : 'Chờ phản hồi'}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    bgcolor: isAccepted ? '#dcfce7' : '#fff7ed',
                                    color: isAccepted ? '#15803d' : '#c2410c',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right' }}>
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  {/* Hủy lời mời (Pending & Leader) */}
                                  {!isAccepted && isLeader && (
                                    <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                                      <span>
                                        <Button
                                          size="small"
                                          color="error"
                                          variant="outlined"
                                          onClick={() => setConfirmAction({ type: 'cancelInvitation', member: m })}
                                          disabled={!isOpen || cancellingId === m.studentProfileId}
                                          sx={{
                                            textTransform: 'none',
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            height: 24,
                                            minWidth: 64,
                                            px: 0.75,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {cancellingId === m.studentProfileId ? 'Đang hủy...' : 'Hủy lời mời'}
                                        </Button>
                                      </span>
                                    </Tooltip>
                                  )}

                                  {/* Chuyển trưởng nhóm & Xóa khỏi nhóm (Accepted & Leader & không phải chính mình) */}
                                  {isAccepted && isLeader && !memberIsLeader && (
                                    <>
                                      <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                                        <span>
                                          <Button
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                            startIcon={<StarIcon sx={{ fontSize: '12px !important' }} />}
                                            onClick={() => setConfirmAction({ type: 'transfer', member: m })}
                                            disabled={
                                              !isOpen ||
                                              transferringId === m.studentProfileId ||
                                              cancellingId === m.studentProfileId
                                            }
                                            sx={{
                                              textTransform: 'none',
                                              fontSize: 10.5,
                                              fontWeight: 700,
                                              height: 24,
                                              px: 0.75,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {transferringId === m.studentProfileId
                                              ? 'Đang chuyển...'
                                              : 'Chuyển trưởng nhóm'}
                                          </Button>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                                        <span>
                                          <Button
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                            onClick={() => setConfirmAction({ type: 'remove', member: m })}
                                            disabled={
                                              !isOpen ||
                                              cancellingId === m.studentProfileId ||
                                              transferringId === m.studentProfileId
                                            }
                                            sx={{
                                              textTransform: 'none',
                                              fontSize: 10.5,
                                              fontWeight: 700,
                                              height: 24,
                                              px: 0.75,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {cancellingId === m.studentProfileId ? 'Đang xóa...' : 'Xóa khỏi nhóm'}
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    </>
                                  )}

                                  {/* Rời nhóm ngay trên dòng của chính thành viên thường */}
                                  {isAccepted && !memberIsLeader && isSelf && (
                                    <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                                      <span>
                                        <Button
                                          size="small"
                                          color="warning"
                                          variant="outlined"
                                          disabled={!isOpen || leavingTeam}
                                          onClick={() => setConfirmAction({ type: 'leave' })}
                                          sx={{
                                            textTransform: 'none',
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            height: 24,
                                            px: 0.75,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {leavingTeam ? 'Đang rời...' : 'Rời nhóm'}
                                        </Button>
                                      </span>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Cột Phải: Mời thành viên cùng lớp (Chỉ Trưởng nhóm; ẩn thao tác mời khi isFull === true) */}
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
                    isFull ? (
                      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                        <CheckCircleIcon sx={{ fontSize: 48, color: '#16a34a', mb: 1.5 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
                          Nhóm đã đủ số lượng thành viên tối đa
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13, maxWidth: 320, mx: 'auto' }}>
                          Nhóm hiện có{' '}
                          <strong>
                            {currentTeam.memberCount ?? acceptedMembers.length}
                            {maxTeamSize ? `/${maxTeamSize}` : ''}
                          </strong>{' '}
                          thành viên nên chức năng gửi lời mời mới đã được ẩn.
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, color: '#131b2e' }}>
                            Mời thành viên cùng lớp
                          </Typography>
                          {!isOpen && (
                            <Chip
                              icon={<LockIcon sx={{ fontSize: '12px !important' }} />}
                              label="Đã khóa"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: 10.5,
                                fontWeight: 700,
                                bgcolor: '#fef3c7',
                                color: '#b45309',
                                '& .MuiChip-icon': { color: 'inherit' },
                              }}
                            />
                          )}
                        </Box>

                        {!isOpen && (
                          <Alert severity="warning" sx={{ mb: 2, fontSize: 12, borderRadius: 1.5 }}>
                            {LOCKED_REASON}
                          </Alert>
                        )}

                        {/* Tìm kiếm ứng viên */}
                        <TextField
                          fullWidth
                          size="small"
                          disabled={!isOpen}
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
                            {candidateSearch
                              ? 'Không tìm thấy sinh viên phù hợp.'
                              : 'Không có sinh viên nào chưa có nhóm trong lớp này.'}
                          </Alert>
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              maxHeight: 380,
                              overflowY: 'auto',
                              opacity: isOpen ? 1 : 0.65,
                            }}
                          >
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
                                  gap: 1,
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#0284c7', fontSize: 11, fontWeight: 700 }}>
                                    {cand.fullName?.charAt(0) || 'S'}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12 }}>
                                      {cand.fullName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11 }}>
                                      {cand.studentCode}
                                      {cand.major ? ` • ${cand.major}` : ''}
                                      {cand.cohort ? ` (${cand.cohort})` : ''}
                                    </Typography>
                                  </Box>
                                </Box>

                                <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                                  <span>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      disabled={!isOpen || invitingId === cand.studentProfileId}
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
                                        whiteSpace: 'nowrap',
                                        '&:hover': { bgcolor: '#0049a3' },
                                      }}
                                    >
                                      {invitingId === cand.studentProfileId ? 'Đang gửi...' : 'Mời'}
                                    </Button>
                                  </span>
                                </Tooltip>
                              </Paper>
                            ))}
                          </Box>
                        )}
                      </>
                    )
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
        </Box>
      </Container>

      {/* ── Hộp thoại xác nhận hành động ───────────────────────────────────── */}
      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirmAction?.type === 'transfer'
            ? 'Xác nhận chuyển quyền trưởng nhóm'
            : confirmAction?.type === 'remove'
              ? 'Xác nhận xóa thành viên'
              : confirmAction?.type === 'cancelInvitation'
                ? 'Xác nhận hủy lời mời'
                : 'Xác nhận rời nhóm'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, color: '#334155' }}>
            {confirmAction?.type === 'transfer' ? (
              <>
                Bạn có chắc chắn muốn chuyển quyền <strong>Trưởng nhóm</strong> cho sinh viên{' '}
                <strong>{confirmAction.member?.fullName}</strong>
                {confirmAction.member?.studentCode ? ` (${confirmAction.member.studentCode})` : ''}? Sau khi chuyển, bạn sẽ trở thành thành viên thường (chỉ thực hiện được khi nhóm chưa đăng ký dự án).
              </>
            ) : confirmAction?.type === 'remove' ? (
              <>
                Bạn có chắc chắn muốn xóa <strong>{confirmAction.member?.fullName}</strong>
                {confirmAction.member?.studentCode ? ` (${confirmAction.member.studentCode})` : ''} khỏi nhóm không? (Chỉ thực hiện được khi nhóm chưa đăng ký dự án.)
              </>
            ) : confirmAction?.type === 'cancelInvitation' ? (
              <>
                Bạn có chắc chắn muốn hủy lời mời tham gia nhóm đã gửi tới{' '}
                <strong>{confirmAction.member?.fullName}</strong>
                {confirmAction.member?.studentCode ? ` (${confirmAction.member.studentCode})` : ''} không?
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn rời khỏi nhóm <strong>{currentTeam?.teamName}</strong> không? Thao tác này không thể hoàn tác.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmAction(null)} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color={confirmAction?.type === 'transfer' ? 'primary' : 'error'}
            onClick={handleConfirmAction}
            sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            {confirmAction?.type === 'transfer'
              ? 'Chuyển trưởng nhóm'
              : confirmAction?.type === 'remove'
                ? 'Xóa khỏi nhóm'
                : confirmAction?.type === 'cancelInvitation'
                  ? 'Hủy lời mời'
                  : 'Rời nhóm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar thông báo ─────────────────────────────────────────────── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
