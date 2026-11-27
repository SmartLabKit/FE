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
  Close as CloseIcon,
  Delete as DeleteIcon,
  ExitToApp as LeaveIcon,
  Groups as GroupsIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Mail as MailIcon,
  PersonAdd as PersonAddIcon,
  RadioButtonUnchecked as SelectCircleIcon,
  RocketLaunch as ProjectIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  Star as StarIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { academicService } from '../../services/academicService'
import { projectService } from '../../services/projectService'
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
  respondLeaderTransfer,
} from '../../services/teamFormationApi'
import { useEntityChanged } from '../../hooks/useEntityChanged'

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const LOCKED_REASON = 'Chưa mở hoặc đã hết hạn chọn nhóm, bạn không thể thay đổi nhóm hoặc phản hồi lời mời.'
const PROJECT_LOCKED_REASON = 'Nhóm đã đăng ký đề tài, không thể thay đổi thành viên hoặc trưởng nhóm'

const BLUE_TOOLTIP_SLOT_PROPS = {
  tooltip: {
    sx: {
      bgcolor: '#0058be',
      color: '#ffffff',
      fontSize: 12,
      fontWeight: 600,
      px: 1.5,
      py: 0.9,
      borderRadius: 1.5,
      maxWidth: 280,
      lineHeight: 1.45,
      boxShadow: '0 6px 18px rgba(0, 88, 190, 0.25)',
    },
  },
  arrow: {
    sx: {
      color: '#0058be',
    },
  },
}

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
  const isConfigured = minTeamSize != null && maxTeamSize != null

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2.5,
        py: 2,
        mb: 3,
        borderRadius: 2,
        border: isOpen ? '1px solid #bfdbfe' : '1px solid #fcd34d',
        bgcolor: isOpen ? '#f0f7ff' : '#fffbeb',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', lg: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 1.5,
        }}
      >
        {/* Trạng thái mở / quá hạn + mô tả ngắn gọn */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
          <Chip
            icon={
              isOpen ? (
                <LockOpenIcon sx={{ fontSize: '14px !important' }} />
              ) : (
                <LockIcon sx={{ fontSize: '14px !important' }} />
              )
            }
            label={isOpen ? 'Đang chọn nhóm' : isConfigured ? 'Đã hết hạn chọn nhóm' : 'Chưa mở chọn nhóm'}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: 11.5,
              px: 0.5,
              flexShrink: 0,
              bgcolor: isOpen ? '#dbeafe' : '#fef3c7',
              color: isOpen ? '#1d4ed8' : '#b45309',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: isOpen ? '#1e3a8a' : '#92400e',
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            {isOpen
              ? 'Sinh viên có thể tạo nhóm, mời thành viên, chuyển trưởng nhóm, rời nhóm và phản hồi lời mời.'
              : isConfigured
                ? 'Giảng viên sẽ chia nhóm cho các bạn chưa có nhóm. Nhóm đủ người vẫn thiết lập dự án được.'
                : 'Giảng viên chưa đặt số thành viên và hạn chót, bạn chưa tạo nhóm được.'}
          </Typography>
        </Box>

        {/* Thông số hạn chót & quy mô nhóm */}
        <Box
          sx={{
            display: 'flex',
            columnGap: { xs: 2.5, sm: 3.5, lg: 4.5 },
            rowGap: 1.5,
            flexWrap: 'wrap',
            alignItems: 'center',
            flexShrink: 0,
            pl: { lg: 2 },
            pt: { xs: 0.5, lg: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <ScheduleIcon sx={{ fontSize: 17, color: isOpen ? '#0058be' : '#b45309' }} />
            <Box>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, lineHeight: 1.2 }}>
                HẠN CHÓT
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                {formatDeadline(deadline)}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, lineHeight: 1.2 }}>
              QUY MÔ NHÓM
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#131b2e', fontSize: 12.5, whiteSpace: 'nowrap' }}>
              {minTeamSize ?? '—'} – {maxTeamSize ?? '—'} thành viên
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}

// ─── Sub-component: Khối Lời mời đến tôi ──────────────────────────────────────

function InvitationsCard({ invitations, isOpen, respondingKey, onRespond, compact = false, sx = {} }) {
  const hasInvitations = invitations.length > 0

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? 3 : 2.5,
        borderRadius: 2,
        border: hasInvitations ? '1px solid #fed7aa' : '1px solid #e4e6ef',
        bgcolor: hasInvitations ? '#fffbeb' : '#ffffff',
        height: compact ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          mb: hasInvitations ? 1.5 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Badge badgeContent={invitations.length} color="warning">
            <MailIcon sx={{ color: hasInvitations ? '#d97706' : '#0058be', fontSize: 22 }} />
          </Badge>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              color: hasInvitations ? '#92400e' : '#131b2e',
              fontSize: 15.5,
            }}
          >
            Lời mời đến tôi
          </Typography>
        </Box>
        {!isOpen && hasInvitations && (
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

      {!hasInvitations ? (
        <Box
          sx={{
            py: compact ? 4 : 1,
            px: compact ? 2 : 0,
            textAlign: compact ? 'center' : 'left',
            flex: compact ? 1 : 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: compact ? 'center' : 'flex-start',
          }}
        >
          {compact && <MailIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />}
          <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13 }}>
            Bạn hiện không có lời mời tham gia nhóm nào đang chờ phản hồi.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            maxHeight: compact ? 380 : 'none',
            overflowY: compact ? 'auto' : 'visible',
          }}
        >
          {invitations.map((inv) => {
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
                  alignItems: compact ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  flexDirection: compact ? 'column' : { xs: 'column', sm: 'row' },
                  gap: 1.25,
                  opacity: !isOpen ? 0.78 : 1,
                }}
              >
                <Box sx={{ minWidth: 0, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
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
                        label={`${inv.memberCount}${inv.maxTeamSize ? `/${inv.maxTeamSize}` : ''} TV`}
                        size="small"
                        sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', fontSize: 11.5 }}>
                    Trưởng nhóm:{' '}
                    <strong>{inv.leaderFullName || inv.leaderStudentCode || inv.invitedBy || 'Trưởng nhóm'}</strong>
                    {inv.invitedAt && ` • ${new Date(inv.invitedAt).toLocaleDateString('vi-VN')}`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignSelf: compact ? 'flex-end' : 'auto' }}>
                  <Tooltip title={!isOpen ? LOCKED_REASON : ''}>
                    <span>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!isOpen || isBusy}
                        startIcon={
                          accepting ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />
                        }
                        onClick={() => onRespond(inv.teamId, 'Accepted')}
                        sx={{
                          bgcolor: '#16a34a',
                          color: '#ffffff',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 11.5,
                          height: 28,
                          px: 1.25,
                          boxShadow: 'none',
                          whiteSpace: 'nowrap',
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
                          rejecting ? <CircularProgress size={12} color="inherit" /> : <CloseIcon sx={{ fontSize: 14 }} />
                        }
                        onClick={() => onRespond(inv.teamId, 'Rejected')}
                        sx={{
                          color: '#dc2626',
                          borderColor: '#fca5a5',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 11.5,
                          height: 28,
                          px: 1.25,
                          whiteSpace: 'nowrap',
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
  const [myProjects, setMyProjects] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // ── State tạo nhóm ────────────────────────────────────────────────────────
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // ── State ứng viên & thao tác thành viên ──────────────────────────────────
  const [candidates, setCandidates] = useState([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [invitingId, setInvitingId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [respondingKey, setRespondingKey] = useState(null)

  // ── Chế độ chọn trực tiếp trên bảng & khối xác nhận tại chỗ (không modal) ─
  const [selectionMode, setSelectionMode] = useState(null) // null | 'transfer' | 'remove'
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'transfer' | 'remove' | 'leave' | 'cancelInvitation', member? }

  // ── Toast ─────────────────────────────────────────────────────────────────
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
        const [ov, team, invites, projects] = await Promise.all([
          getTeamFormationOverview(classId),
          getMyTeam(classId),
          getMyInvitations(),
          projectService.getMyProjects().catch(() => []),
        ])
        setOverview(ov)
        setCurrentTeam(team)
        // Lời mời của lớp khác hiện ở trang lớp đó, không khóa theo trạng thái chọn nhóm của lớp đang xem
        setMyInvitations(Array.isArray(invites) ? invites.filter((inv) => !inv.classId || inv.classId === classId) : [])
        setMyProjects(Array.isArray(projects) ? projects : [])

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

  // Nhóm, lời mời hoặc đề nghị làm trưởng nhóm đổi ở nơi khác thì tự tải lại
  const reloadQuietly = useCallback(() => {
    if (selectedClassId) fetchPageData(selectedClassId, { silent: true })
  }, [fetchPageData, selectedClassId])
  useEntityChanged(reloadQuietly)

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
      setSelectionMode(null)
      setPendingConfirm(null)
      fetchPageData(selectedClassId)
    }
  }, [selectedClassId, fetchPageData])

  // ── Computed flags ────────────────────────────────────────────────────────
  const isOpen = overview ? overview.studentsCanChangeTeams === true : true
  // Lớp đã đủ số nhóm (sĩ số ÷ số người tối thiểu): không tạo thêm nhóm, chỉ nhận lời mời
  const maxTeamCount = overview?.maxTeamCount ?? null
  const classHasAllTeams = maxTeamCount !== null && (overview?.teamCount ?? 0) >= maxTeamCount
  const canCreateTeam = isOpen && !classHasAllTeams
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
  const eligibleTargetMembers = useMemo(
    () => acceptedMembers.filter((m) => !isMemberLeader(m)),
    [acceptedMembers]
  )

  // Kiểm tra nhóm đã đăng ký đề tài hay chưa từ team DTO, overview.teams và myProjects
  const hasProject = useMemo(() => {
    if (!currentTeam) return false
    if (
      currentTeam.hasProject === true ||
      Boolean(currentTeam.projectId) ||
      Boolean(currentTeam.project)
    ) {
      return true
    }
    const overviewTeam = overview?.teams?.find((t) => t.teamId === currentTeam.teamId)
    if (overviewTeam?.hasProject === true) return true
    if (myProjects.some((p) => p?.teamId && p.teamId === currentTeam.teamId)) return true
    return false
  }, [currentTeam, overview, myProjects])

  const canModifyTeam = isOpen && !hasProject

  const isFull = currentTeam?.isFull === true
  const isReadyForProject = currentTeam?.isReadyForProject === true
  const showsSidePanel = isLeader ? canModifyTeam && !isFull : myInvitations.length > 0
  const maxTeamSize = overview?.maxTeamSize ?? null
  const minTeamSize = overview?.minTeamSize ?? null

  // Trưởng nhóm phải chuyển quyền trước khi rời nếu còn thành viên Accepted khác
  const leaderMustTransferBeforeLeave = isLeader && acceptedMembers.length > 1
  const leaderIsAlone = isLeader && acceptedMembers.length <= 1

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
    if (!currentTeam?.teamId || !canModifyTeam || isFull) return
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

  // 4. Bật/tắt chế độ chọn trực tiếp trên bảng thành viên
  const handleToggleSelectionMode = (mode) => {
    if (!canModifyTeam) return
    setPendingConfirm(null)
    setSelectionMode((prev) => (prev === mode ? null : mode))
  }

  // 5. Khi click chọn 1 thành viên hợp lệ trên danh sách -> tắt chế độ chọn & mở thanh xác nhận tại chỗ
  const handleSelectMemberRow = (member) => {
    if (!selectionMode) return
    const isSelectable = member.status === 'Accepted' && !isMemberLeader(member)
    if (!isSelectable) return
    const currentMode = selectionMode
    setSelectionMode(null)
    setPendingConfirm({ type: currentMode, member })
  }

  // Thành viên được đề nghị làm trưởng nhóm bấm Nhận / Từ chối
  const handleRespondLeaderTransfer = async (decision) => {
    if (!currentTeam?.teamId) return
    setActionLoading(true)
    try {
      await respondLeaderTransfer(currentTeam.teamId, decision)
      if (decision === 'Accepted') showToast('Bạn đã là trưởng nhóm.')
      else showToast('Đã từ chối làm trưởng nhóm.', 'info')
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Thao tác thất bại', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // 6. Thực thi hành động sau khi bấm Xác nhận trên khối xác nhận tại chỗ
  const handleExecuteInlineConfirm = async () => {
    if (!pendingConfirm || !currentTeam?.teamId) return
    const { type, member } = pendingConfirm
    setActionLoading(true)
    try {
      if (type === 'transfer' && member) {
        await changeTeamLeader(currentTeam.teamId, member.studentProfileId)
        showToast(`Đã gửi đề nghị, chờ ${member.fullName} xác nhận làm trưởng nhóm.`)
        setCandidates([])
      } else if (type === 'remove' && member) {
        await removeMember(currentTeam.teamId, member.studentProfileId)
        showToast(`Đã xóa thành viên ${member.fullName} khỏi nhóm.`)
      } else if (type === 'cancelInvitation' && member) {
        await cancelInvitation(currentTeam.teamId, member.studentProfileId)
        showToast(`Đã hủy lời mời sinh viên ${member.fullName}.`, 'info')
      } else if (type === 'leave') {
        await leaveTeam(currentTeam.teamId)
        showToast(leaderIsAlone ? 'Đã giải tán nhóm.' : 'Bạn đã rời nhóm thành công.', 'info')
        setCandidates([])
      }
      setPendingConfirm(null)
      await fetchPageData(selectedClassId, { silent: true })
    } catch (err) {
      showToast(err.message || 'Thao tác thất bại', 'error')
    } finally {
      setActionLoading(false)
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
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flex: '1 1 520px', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              {/* Học kỳ */}
              <Box sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}>
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
              <Box sx={{ flex: '1 1 auto', minWidth: 0, maxWidth: { sm: 400 }, width: { xs: '100%', sm: 'auto' } }}>
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
                        <strong>{cls.classCode}</strong> - {cls.courseName || cls.courseCode}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </Box>
            </Box>

            {selectedClass && (
              <Box
                sx={{
                  display: 'flex',
                  columnGap: { xs: 2.5, sm: 3.5, lg: 4.5 },
                  rowGap: 1.5,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
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

          {/* ── 3. Đang tải dữ liệu nhóm ────────────────────────────────────── */}
          {loadingData && selectedClassId && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          )}

          {/* ── 4A. CHƯA CÓ NHÓM TRONG LỚP (404) -> Form tạo nhóm + Lời mời đến tôi ── */}
          {!loadingData && selectedClassId && !currentTeam && (
            <>
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
                <GroupsIcon sx={{ fontSize: 56, color: canCreateTeam ? '#0058be' : '#94a3b8', mb: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', mb: 1 }}>
                  Bạn chưa có nhóm trong lớp này
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 13, mb: 2.5 }}>
                  {isOpen && classHasAllTeams && (
                    <>
                      Lớp đã đủ <strong>{maxTeamCount} nhóm</strong> nên không tạo thêm được. Hãy nhận lời mời vào một nhóm bên dưới,
                      hoặc chờ giảng viên xếp nhóm cho bạn.
                    </>
                  )}
                  {canCreateTeam && (
                    <>
                      Hãy đặt tên nhóm và tạo nhóm ngay. Sau khi tạo, bạn sẽ là <strong>Trưởng nhóm</strong> và có quyền mời các bạn cùng lớp tham gia.
                    </>
                  )}
                  {!isOpen && 'Bạn chưa tạo nhóm được lúc này. Giảng viên sẽ mở chọn nhóm hoặc xếp nhóm cho bạn.'}
                </Typography>

                {canCreateTeam && (
                  <Box
                    component="form"
                    onSubmit={handleCreateTeam}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      textAlign: 'left',
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
                        disabled={creatingTeam}
                        placeholder="Ví dụ: Nhóm 1 - IoT Smart Home Project"
                        inputProps={{ maxLength: 100 }}
                      />
                    </Box>

                        <Button
                          fullWidth
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
                          {creatingTeam ? 'Đang tạo nhóm...' : 'Tạo nhóm ngay'}
                        </Button>
                  </Box>
                )}
              </Paper>

              {/* Khối Lời mời đến tôi ở dưới cùng */}
              <InvitationsCard
                invitations={myInvitations}
                isOpen={isOpen}
                respondingKey={respondingKey}
                onRespond={handleRespondInvitation}
                sx={{ mt: 3 }}
              />
            </>
          )}

          {/* ── 4B. ĐÃ CÓ NHÓM TRONG LỚP ────────────────────────────────────── */}
          {!loadingData && selectedClassId && currentTeam && (
            <>
              <Grid container spacing={3} alignItems="stretch">
                {/* Cột Trái: Thông tin nhóm & Bảng thành viên (đã bỏ cột THAO TÁC) */}
                <Grid size={{ xs: 12, md: showsSidePanel ? 7 : 12 }}>
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
                    {/* Header nhóm: Tên + trạng thái + cụm nút thao tác gọn gàng */}
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
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 17 }}>
                            {currentTeam.teamName}
                          </Typography>
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
                        {hasProject && (
                          <Typography variant="body2" sx={{ color: '#b45309', fontSize: 12.5, mt: 0.5 }}>
                            {PROJECT_LOCKED_REASON}.
                          </Typography>
                        )}
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: { xs: 'flex-start', sm: 'flex-end' },
                          gap: 1,
                          ml: 'auto',
                        }}
                      >
                        {isReadyForProject && (
                          <Chip
                            label="Đủ điều kiện lập dự án"
                            size="small"
                            sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: 11, flexShrink: 0 }}
                          />
                        )}

                        {/* Hàng nút thao tác nhóm: [Chuyển trưởng nhóm] [Xóa khỏi nhóm] [Thiết lập dự án] [Rời nhóm] */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
                        >
                          {isLeader && canModifyTeam && (
                            <>
                              <Tooltip
                                arrow
                                placement="top"
                                slotProps={BLUE_TOOLTIP_SLOT_PROPS}
                                title={
                                  eligibleTargetMembers.length === 0
                                    ? 'Chưa có thành viên chính thức khác để chuyển quyền'
                                    : ''
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    variant={selectionMode === 'transfer' ? 'contained' : 'outlined'}
                                    color="primary"
                                    disabled={eligibleTargetMembers.length === 0 || actionLoading}
                                    startIcon={<TransferIcon sx={{ fontSize: 15 }} />}
                                    onClick={() => handleToggleSelectionMode('transfer')}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      whiteSpace: 'nowrap',
                                      boxShadow: 'none',
                                    }}
                                  >
                                    Chuyển trưởng nhóm
                                  </Button>
                                </span>
                              </Tooltip>

                              <Tooltip
                                arrow
                                placement="top"
                                slotProps={BLUE_TOOLTIP_SLOT_PROPS}
                                title={
                                  eligibleTargetMembers.length === 0
                                    ? 'Chưa có thành viên chính thức khác trong nhóm'
                                    : ''
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    variant={selectionMode === 'remove' ? 'contained' : 'outlined'}
                                    color="error"
                                    disabled={eligibleTargetMembers.length === 0 || actionLoading}
                                    startIcon={<DeleteIcon sx={{ fontSize: 15 }} />}
                                    onClick={() => handleToggleSelectionMode('remove')}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      whiteSpace: 'nowrap',
                                      boxShadow: 'none',
                                    }}
                                  >
                                    Xóa khỏi nhóm
                                  </Button>
                                </span>
                              </Tooltip>
                            </>
                          )}

                          {/* Nút lối tắt Thiết lập dự án (vẫn mở khi quá hạn nếu isReadyForProject === true) */}
                          <Tooltip
                            arrow
                            placement="top"
                            slotProps={BLUE_TOOLTIP_SLOT_PROPS}
                            title={
                              isReadyForProject || hasProject
                                ? 'Đi tới màn hình thiết lập dự án cho nhóm'
                                : `Nhóm cần đủ tối thiểu ${minTeamSize ?? 'số'} thành viên để thiết lập dự án`
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={!isReadyForProject && !hasProject}
                                startIcon={<ProjectIcon sx={{ fontSize: 15 }} />}
                                onClick={() => navigate(`/class-setup/student/project/${currentTeam.teamId}`)}
                                sx={{
                                  bgcolor: '#0058be',
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: 12,
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
                          {canModifyTeam && (
                            <Tooltip
                              arrow
                              placement="top"
                              slotProps={BLUE_TOOLTIP_SLOT_PROPS}
                              title={
                                leaderMustTransferBeforeLeave
                                  ? 'Trưởng nhóm cần chuyển quyền trưởng nhóm cho thành viên khác trước khi rời nhóm'
                                  : ''
                              }
                            >
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={actionLoading || leaderMustTransferBeforeLeave}
                                  startIcon={<LeaveIcon sx={{ fontSize: 15 }} />}
                                  onClick={() => {
                                    setSelectionMode(null)
                                    setPendingConfirm({ type: 'leave' })
                                  }}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {leaderIsAlone ? 'Giải tán nhóm' : 'Rời nhóm'}
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {/* Thanh hướng dẫn khi đang bật chế độ chọn trực tiếp trên bảng */}
                    {selectionMode && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1,
                          px: 1.5,
                          py: 1,
                          mb: 1.5,
                          borderRadius: 1.5,
                          bgcolor: selectionMode === 'transfer' ? '#eff6ff' : '#fef2f2',
                          border: selectionMode === 'transfer' ? '1px solid #bfdbfe' : '1px solid #fecaca',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: selectionMode === 'transfer' ? '#1d4ed8' : '#b91c1c',
                          }}
                        >
                          {selectionMode === 'transfer'
                            ? 'Bấm chọn 1 thành viên chính thức trong bảng bên dưới để chuyển quyền trưởng nhóm.'
                            : 'Bấm chọn 1 thành viên chính thức trong bảng bên dưới để xóa khỏi nhóm.'}
                        </Typography>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setSelectionMode(null)}
                          sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11.5, minWidth: 'auto', px: 1 }}
                        >
                          Hủy chọn
                        </Button>
                      </Box>
                    )}

                    {/* Đề nghị làm trưởng nhóm đang chờ người được chọn xác nhận */}
                    {currentTeam.pendingLeaderId && currentTeam.pendingLeaderId === myMemberRecord?.studentProfileId && (
                      <Alert
                        severity="info"
                        sx={{ mb: 2, alignItems: 'center' }}
                        action={
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" color="inherit" disabled={actionLoading} onClick={() => handleRespondLeaderTransfer('Rejected')} sx={{ textTransform: 'none' }}>
                              Từ chối
                            </Button>
                            <Button size="small" variant="contained" disabled={actionLoading} onClick={() => handleRespondLeaderTransfer('Accepted')} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>
                              Nhận
                            </Button>
                          </Box>
                        }
                      >
                        Bạn được đề nghị làm <strong>trưởng nhóm</strong> {currentTeam.teamName}.
                      </Alert>
                    )}
                    {currentTeam.pendingLeaderId && isLeader && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Đang chờ <strong>{currentTeam.pendingLeaderFullName}</strong> xác nhận làm trưởng nhóm.
                      </Alert>
                    )}

                    {/* Khối xác nhận hành động ngay tại chỗ (không mở modal) */}
                    {pendingConfirm && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          justifyContent: 'space-between',
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1.5,
                          px: 2,
                          py: 1.5,
                          mb: 2,
                          borderRadius: 1.5,
                          bgcolor: pendingConfirm.type === 'transfer' ? '#eff6ff' : '#fef2f2',
                          border: pendingConfirm.type === 'transfer' ? '1px solid #93c5fd' : '1px solid #fca5a5',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: 12.5, color: '#1e293b', lineHeight: 1.45 }}>
                          {pendingConfirm.type === 'transfer' ? (
                            <>
                              Đề nghị <strong>{pendingConfirm.member?.fullName}</strong>
                              {pendingConfirm.member?.studentCode ? ` (${pendingConfirm.member.studentCode})` : ''} làm{' '}
                              <strong>Trưởng nhóm</strong>? Bạn ấy xác nhận thì mới đổi.
                            </>
                          ) : pendingConfirm.type === 'remove' ? (
                            <>
                              Xác nhận xóa <strong>{pendingConfirm.member?.fullName}</strong>
                              {pendingConfirm.member?.studentCode ? ` (${pendingConfirm.member.studentCode})` : ''} khỏi nhóm?
                            </>
                          ) : pendingConfirm.type === 'cancelInvitation' ? (
                            <>
                              Xác nhận hủy lời mời đã gửi tới <strong>{pendingConfirm.member?.fullName}</strong>?
                            </>
                          ) : (
                            <>
                              {leaderIsAlone ? 'Xác nhận giải tán nhóm' : 'Xác nhận rời khỏi nhóm'} <strong>{currentTeam.teamName}</strong>?
                            </>
                          )}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={actionLoading}
                            onClick={() => setPendingConfirm(null)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, height: 28 }}
                          >
                            Hủy
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color={pendingConfirm.type === 'transfer' ? 'primary' : 'error'}
                            disabled={actionLoading}
                            startIcon={actionLoading ? <CircularProgress size={12} color="inherit" /> : undefined}
                            onClick={handleExecuteInlineConfirm}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, height: 28, boxShadow: 'none' }}
                          >
                            {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Tiêu đề bảng thành viên */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                        Thành viên nhóm ({currentTeam.members?.length || 0})
                      </Typography>
                    </Box>

                    {/* Bảng thành viên nhóm (4 cột cân đối, đã bỏ cột THAO TÁC) */}
                    <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#fafbff' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '40%' }}>
                              THÀNH VIÊN
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '20%' }}>
                              MÃ SV
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '20%' }}>
                              VAI TRÒ
                            </TableCell>
                            {pendingMembers.length > 0 && (
                              <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '20%', textAlign: 'right' }}>
                                TRẠNG THÁI
                              </TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currentTeam.members?.map((m) => {
                            const memberIsLeader = isMemberLeader(m)
                            const isAccepted = m.status === 'Accepted'
                            const isSelf =
                              (myMemberRecord && m.studentProfileId === myMemberRecord.studentProfileId) ||
                              (user?.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase())
                            const isSelectable = Boolean(selectionMode) && isAccepted && !memberIsLeader
                            const isDimmedInSelectMode = Boolean(selectionMode) && !isSelectable

                            return (
                              <TableRow
                                key={m.studentProfileId || m.studentCode}
                                hover={!isDimmedInSelectMode}
                                onClick={() => isSelectable && handleSelectMemberRow(m)}
                                sx={{
                                  cursor: isSelectable ? 'pointer' : isDimmedInSelectMode ? 'not-allowed' : 'default',
                                  opacity: isDimmedInSelectMode ? 0.45 : 1,
                                  transition: 'background-color 0.15s ease',
                                  ...(isSelectable && {
                                    bgcolor: selectionMode === 'transfer' ? '#f8fbff' : '#fffafa',
                                    '&:hover': {
                                      bgcolor: selectionMode === 'transfer' ? '#e0f2fe !important' : '#fee2e2 !important',
                                    },
                                  }),
                                }}
                              >
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {isSelectable && (
                                      <SelectCircleIcon
                                        sx={{
                                          fontSize: 16,
                                          color: selectionMode === 'transfer' ? '#0058be' : '#dc2626',
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                    <Avatar
                                      sx={{
                                        width: 28,
                                        height: 28,
                                        bgcolor: memberIsLeader ? '#0058be' : '#64748b',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {m.fullName?.charAt(0) || 'U'}
                                    </Avatar>
                                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5, color: '#131b2e' }}>
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
                                        height: 22,
                                        fontSize: 10.5,
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
                                        height: 22,
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        bgcolor: '#f1f5f9',
                                        color: '#475569',
                                      }}
                                    />
                                  )}
                                </TableCell>
                                {pendingMembers.length > 0 && (
                                  <TableCell sx={{ textAlign: 'right' }}>
                                    {!isAccepted && (
                                      <Tooltip title={isLeader && canModifyTeam ? 'Bấm dấu × để hủy lời mời' : ''}>
                                        <Chip
                                          label="Chờ phản hồi"
                                          size="small"
                                          onDelete={
                                            isLeader && canModifyTeam && !selectionMode
                                              ? () => setPendingConfirm({ type: 'cancelInvitation', member: m })
                                              : undefined
                                          }
                                          sx={{
                                            height: 22,
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            bgcolor: '#fff7ed',
                                            color: '#c2410c',
                                            '& .MuiChip-deleteIcon': {
                                              fontSize: 14,
                                              color: '#c2410c',
                                              '&:hover': { color: '#9a3412' },
                                            },
                                          }}
                                        />
                                      </Tooltip>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                {/* Cột Phải:
                    - Trưởng nhóm: Khung Mời thành viên cùng lớp
                    - Thành viên thường: Thay card trống bằng khối Lời mời đến tôi */}
                {showsSidePanel && (
                <Grid size={{ xs: 12, md: 5 }}>
                  {isLeader ? (
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
                      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, color: '#131b2e', mb: 1.5 }}>
                        Mời thành viên cùng lớp
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
                            maxHeight: 360,
                            overflowY: 'auto',
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
                                <Avatar sx={{ width: 32, height: 32, bgcolor: '#0284c7', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
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
                                      whiteSpace: 'nowrap',
                                      '&:hover': { bgcolor: '#0049a3' },
                                    }}
                                  >
                                    {invitingId === cand.studentProfileId ? 'Đang gửi...' : 'Mời'}
                                  </Button>
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </Paper>
                  ) : (
                    /* Thành viên thường: thay thế card trống bằng khối Lời mời đến tôi */
                    <InvitationsCard
                      invitations={myInvitations}
                      isOpen={isOpen}
                      respondingKey={respondingKey}
                      onRespond={handleRespondInvitation}
                      compact
                    />
                  )}
                </Grid>
                )}
              </Grid>

              {/* Với Trưởng nhóm: đặt khối Lời mời đến tôi gọn gàng ở dưới cùng */}
              {isLeader && myInvitations.length > 0 && (
                <InvitationsCard
                  invitations={myInvitations}
                  isOpen={isOpen}
                  respondingKey={respondingKey}
                  onRespond={handleRespondInvitation}
                  sx={{ mt: 3 }}
                />
              )}
            </>
          )}
        </Box>
      </Container>

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
