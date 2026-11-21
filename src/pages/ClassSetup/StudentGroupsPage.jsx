import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
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
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
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
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  ExitToApp as LeaveIcon,
  Groups as GroupsIcon,
  HourglassEmpty as PendingIcon,
  Mail as MailIcon,
  PersonAdd as PersonAddIcon,
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
  respondInvitation,
} from '../../services/teamFormationApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

// Kiểm tra user có phải Leader trong nhóm không (dựa theo role field)
function isUserLeader(team, user) {
  if (!team || !user) return false
  const myMember = team.members?.find(
    (m) =>
      (user.studentCode && m.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) ||
      (user.username && m.studentCode?.toUpperCase() === user.username?.toUpperCase()) ||
      (user.email && m.studentCode?.toUpperCase() === user.email?.split('@')[0]?.toUpperCase()) ||
      (user.fullName && m.fullName?.toLowerCase() === user.fullName?.toLowerCase())
  )
  return myMember?.role === 'Leader'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Banner trạng thái Mở / Quá hạn */
function StatusBanner({ overview }) {
  if (!overview) return null
  const isOpen = overview.studentsCanChangeTeams === true
  const { deadline, minTeamSize, maxTeamSize } = overview

  if (isOpen) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'info.50',
          borderColor: 'info.200',
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Chip label="Đang mở" color="info" size="small" sx={{ fontWeight: 700 }} />
        <Typography variant="body2" color="text.secondary">
          {deadline
            ? `Hạn chót đăng ký nhóm: ${formatDeadline(deadline)}`
            : 'Chưa có hạn chót'}
          {(minTeamSize || maxTeamSize) && (
            <Box component="span" sx={{ ml: 2 }}>
              · Số thành viên:{' '}
              <strong>
                {minTeamSize ?? '?'} – {maxTeamSize ?? '?'}
              </strong>
            </Box>
          )}
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        bgcolor: 'warning.50',
        borderColor: 'warning.300',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >
      <Chip label="Quá hạn" color="warning" size="small" sx={{ fontWeight: 700 }} />
      <Typography variant="body2" color="text.secondary">
        Thời gian đăng ký nhóm đã kết thúc. Bạn không thể thay đổi nhóm.
        {deadline && ` (Hạn chót: ${formatDeadline(deadline)})`}
      </Typography>
    </Paper>
  )
}

/** Modal mời thành viên */
function InviteModal({ open, onClose, classId, teamId, isOpen: registrationOpen, onInvited }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [invitingId, setInvitingId] = useState(null)
  const [invitedIds, setInvitedIds] = useState(new Set())

  useEffect(() => {
    if (!open || !classId) return
    setLoading(true)
    setSearch('')
    setInvitedIds(new Set())
    getTeamCandidates(classId)
      .then((list) => setCandidates(Array.isArray(list) ? list : []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [open, classId])

  const filtered = candidates.filter(
    (c) =>
      c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      c.studentCode?.toLowerCase().includes(search.toLowerCase())
  )

  const handleInvite = async (studentProfileId) => {
    setInvitingId(studentProfileId)
    try {
      await inviteMember(teamId, studentProfileId)
      setInvitedIds((prev) => new Set([...prev, studentProfileId]))
      if (onInvited) onInvited()
    } catch (err) {
      console.error(err)
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon fontSize="small" />
        Mời thành viên vào nhóm
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo tên hoặc MSSV…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {candidates.length === 0
              ? 'Không có sinh viên nào chưa có nhóm.'
              : 'Không tìm thấy sinh viên phù hợp.'}
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={0}>
            {filtered.map((c) => {
              const alreadyInvited = invitedIds.has(c.studentProfileId)
              return (
                <Box
                  key={c.studentProfileId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1.25,
                    px: 0.5,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {c.fullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.studentCode}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={alreadyInvited ? 'outlined' : 'contained'}
                    color={alreadyInvited ? 'success' : 'primary'}
                    disabled={alreadyInvited || !registrationOpen || invitingId === c.studentProfileId}
                    startIcon={alreadyInvited ? <CheckCircleIcon /> : undefined}
                    onClick={() => handleInvite(c.studentProfileId)}
                    sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                  >
                    {invitingId === c.studentProfileId ? (
                      <CircularProgress size={14} sx={{ mr: 0.5 }} />
                    ) : alreadyInvited ? (
                      'Đã mời'
                    ) : (
                      'Mời'
                    )}
                  </Button>
                </Box>
              )
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Dialog xác nhận hành động */
function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" disabled={loading}>
          Hủy
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={16} /> : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentGroupsPage() {
  const { user } = useAuth()

  // ── State lớp học ──────────────────────────────────────────────────────────
  const [myClasses, setMyClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [classesError, setClassesError] = useState('')

  // ── State dữ liệu chính ───────────────────────────────────────────────────
  const [overview, setOverview] = useState(null)
  const [myTeam, setMyTeam] = useState(null) // null = chưa có nhóm
  const [myInvitations, setMyInvitations] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // ── State UI ──────────────────────────────────────────────────────────────
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState(null) // { type, payload }
  const [confirmLoading, setConfirmLoading] = useState(false)

  const [respondingId, setRespondingId] = useState(null) // teamId đang xử lý

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // ── Computed ───────────────────────────────────────────────────────────────
  const isOpen = overview?.studentsCanChangeTeams === true
  const amLeader = isUserLeader(myTeam, user)
  const isFull = myTeam?.isFull ?? false
  const maxTeamSize = overview?.maxTeamSize ?? null

  const selectedClass = myClasses.find((c) => c.classId === selectedClassId)

  // Nhóm lớp theo học kỳ, sắp mới → cũ
  const semesterGroups = (() => {
    const groups = {}
    myClasses.forEach((cls) => {
      const sem = cls.semesterCode || 'Chưa phân kỳ'
      if (!groups[sem]) groups[sem] = []
      groups[sem].push(cls)
    })
    return Object.keys(groups)
      .sort((a, b) => getSemesterWeight(b) - getSemesterWeight(a))
      .map((sem) => ({ semesterCode: sem, classes: groups[sem] }))
  })()

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchPageData = useCallback(async (classId) => {
    if (!classId) return
    setLoadingData(true)
    try {
      const [ov, team, invites] = await Promise.all([
        getTeamFormationOverview(classId),
        getMyTeam(classId),
        getMyInvitations(),
      ])
      setOverview(ov)
      setMyTeam(team)
      setMyInvitations(Array.isArray(invites) ? invites : [])
    } catch (err) {
      showToast(err.message || 'Không thể tải dữ liệu nhóm', 'error')
    } finally {
      setLoadingData(false)
    }
  }, [])

  const refreshTeamAndInvitations = useCallback(async () => {
    if (!selectedClassId) return
    try {
      const [team, invites] = await Promise.all([
        getMyTeam(selectedClassId),
        getMyInvitations(),
      ])
      setMyTeam(team)
      setMyInvitations(Array.isArray(invites) ? invites : [])
    } catch (err) {
      console.warn('Lỗi refresh nhóm/lời mời:', err)
    }
  }, [selectedClassId])

  // ── Initial load: danh sách lớp ───────────────────────────────────────────
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
          const initial =
            list.find(
              (c) =>
                (activeSem?.semesterId && c.semesterId === activeSem.semesterId) ||
                (activeSem?.semesterCode && c.semesterCode === activeSem.semesterCode)
            ) || list[0]
          setSelectedClassId(initial.classId)
        }
      })
      .catch((err) => {
        if (!ignore) setClassesError(err.message || 'Không thể tải lớp học của bạn.')
      })
      .finally(() => {
        if (!ignore) setLoadingClasses(false)
      })
    return () => { ignore = true }
  }, [])

  // ── Load dữ liệu khi đổi lớp ──────────────────────────────────────────────
  useEffect(() => {
    if (selectedClassId) fetchPageData(selectedClassId)
  }, [selectedClassId, fetchPageData])

  // ── Handlers: Tạo nhóm ────────────────────────────────────────────────────
  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim()) {
      showToast('Vui lòng nhập tên nhóm', 'warning')
      return
    }
    setCreatingTeam(true)
    try {
      const team = await createTeam(selectedClassId, newTeamName.trim())
      setNewTeamName('')
      showToast(`Đã tạo nhóm "${team?.teamName || newTeamName.trim()}" thành công! Bạn là Trưởng nhóm.`)
      await fetchPageData(selectedClassId)
    } catch (err) {
      showToast(err.message || 'Không thể tạo nhóm', 'error')
    } finally {
      setCreatingTeam(false)
    }
  }

  // ── Handlers: Rời nhóm ───────────────────────────────────────────────────
  const handleLeaveTeam = () => {
    setConfirmDialog({ type: 'leave', payload: { teamId: myTeam.teamId } })
  }

  // ── Handlers: Xóa thành viên ─────────────────────────────────────────────
  const handleRemoveMember = (member) => {
    setConfirmDialog({ type: 'removeMember', payload: { member } })
  }

  // ── Handlers: Hủy lời mời đã gửi ─────────────────────────────────────────
  const handleCancelInvitation = (member) => {
    setConfirmDialog({ type: 'cancelInvitation', payload: { member } })
  }

  // ── Confirm dialog executor ───────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmDialog) return
    setConfirmLoading(true)
    try {
      const { type, payload } = confirmDialog
      if (type === 'leave') {
        await leaveTeam(payload.teamId)
        showToast('Đã rời nhóm thành công.')
        await fetchPageData(selectedClassId)
      } else if (type === 'removeMember') {
        await removeMember(myTeam.teamId, payload.member.studentProfileId)
        showToast(`Đã xóa ${payload.member.fullName} khỏi nhóm.`)
        await fetchPageData(selectedClassId)
      } else if (type === 'cancelInvitation') {
        await cancelInvitation(myTeam.teamId, payload.member.studentProfileId)
        showToast(`Đã hủy lời mời tới ${payload.member.fullName}.`)
        await fetchPageData(selectedClassId)
      }
      setConfirmDialog(null)
    } catch (err) {
      showToast(err.message || 'Thao tác thất bại', 'error')
    } finally {
      setConfirmLoading(false)
    }
  }

  // ── Handlers: Phản hồi lời mời ───────────────────────────────────────────
  const handleRespondInvitation = async (teamId, decision) => {
    setRespondingId(teamId + decision)
    try {
      await respondInvitation(teamId, decision)
      showToast(
        decision === 'Accepted'
          ? 'Đã chấp nhận lời mời vào nhóm!'
          : 'Đã từ chối lời mời.',
        decision === 'Accepted' ? 'success' : 'info'
      )
      await refreshTeamAndInvitations()
    } catch (err) {
      showToast(err.message || 'Phản hồi lời mời thất bại', 'error')
    } finally {
      setRespondingId(null)
    }
  }

  // ── Các thành viên đã tham gia & đang chờ ────────────────────────────────
  const acceptedMembers = myTeam?.members?.filter((m) => m.status === 'Accepted') ?? []
  const pendingMembers = myTeam?.members?.filter((m) => m.status === 'Pending') ?? []
  const pendingCount = pendingMembers.length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PortalLayout
      headerTitle="Nhóm & Lời mời"
      headerSubtitle="Tạo nhóm, mời thành viên và phản hồi lời mời"
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* ── Selector lớp học ─────────────────────────────────────────────── */}
        {loadingClasses ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : classesError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {classesError}
          </Alert>
        ) : myClasses.length === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Bạn chưa được đăng ký vào lớp học nào.
          </Alert>
        ) : (
          <>
            {/* Chọn lớp */}
<Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
    <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', minWidth: 80 }}>
      Lớp học:
    </Typography>
    <TextField
      select
      size="small"
      value={selectedClassId}
      onChange={(e) => setSelectedClassId(e.target.value)}
      sx={{ minWidth: 260 }}
      label="Chọn lớp"
    >
      {semesterGroups.map((group) =>
        group.classes.map((cls) => (
          <MenuItem key={cls.classId} value={cls.classId}>
            <Box>
              <Typography variant="body2" component="span" fontWeight={600}>
                {cls.classCode}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {cls.courseName} [{group.semesterCode}]
              </Typography>
            </Box>
          </MenuItem>
        ))
      )}
    </TextField>
  </Stack>
</Paper>

            {/* Loading dữ liệu nhóm */}
            {loadingData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* ── Banner trạng thái ─────────────────────────────────── */}
                <StatusBanner overview={overview} />

                {/* ── Khối Nhóm của tôi ─────────────────────────────────── */}
                <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <GroupsIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>
                      Nhóm của tôi
                    </Typography>
                  </Stack>

                  {myTeam === null ? (
                    /* ── Chưa có nhóm: form tạo nhóm ── */
                    <Box component="form" onSubmit={handleCreateTeam}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Bạn chưa tham gia nhóm nào trong lớp này.
                        {isOpen
                          ? ' Hãy tạo nhóm mới hoặc chờ lời mời từ nhóm khác.'
                          : ' Thời hạn đăng ký nhóm đã kết thúc.'}
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                          size="small"
                          label="Tên nhóm"
                          placeholder="Nhập tên nhóm…"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          disabled={!isOpen || creatingTeam}
                          sx={{ flex: 1, maxWidth: 360 }}
                          inputProps={{ maxLength: 100 }}
                        />
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={!isOpen || creatingTeam || !newTeamName.trim()}
                          startIcon={creatingTeam ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                          Tạo nhóm
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    /* ── Đã có nhóm ── */
                    <>
                      {/* Header nhóm */}
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                        spacing={2}
                        sx={{ mb: 2 }}
                      >
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {myTeam.teamName}
                            </Typography>
                            {amLeader && (
                              <Chip
                                icon={<StarIcon sx={{ fontSize: 14 }} />}
                                label="Trưởng nhóm"
                                size="small"
                                color="warning"
                                sx={{ fontWeight: 600 }}
                              />
                            )}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {myTeam.memberCount}{maxTeamSize ? `/${maxTeamSize}` : ''} thành viên
                            {pendingCount > 0 && (
                              <Box component="span" sx={{ ml: 1 }}>
                                · {pendingCount} lời mời đang chờ
                              </Box>
                            )}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {/* Nút Mời: chỉ hiện nếu là Leader & !isFull */}
                          {amLeader && !isFull && (
                            <Tooltip title={!isOpen ? 'Thời hạn đăng ký đã kết thúc' : ''}>
                              <span>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<PersonAddIcon />}
                                  disabled={!isOpen}
                                  onClick={() => setInviteModalOpen(true)}
                                >
                                  Mời thành viên
                                </Button>
                              </span>
                            </Tooltip>
                          )}

                          {/* Nút Rời nhóm */}
                          <Tooltip title={!isOpen ? 'Thời hạn đăng ký đã kết thúc' : ''}>
                            <span>
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<LeaveIcon />}
                                disabled={!isOpen}
                                onClick={handleLeaveTeam}
                              >
                                Rời nhóm
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      {/* Bảng thành viên */}
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Tên</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Mã SV</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Vai trò</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                              {amLeader && isOpen && (
                                <TableCell sx={{ fontWeight: 700 }} align="right">
                                  Hành động
                                </TableCell>
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {myTeam.members?.map((member) => {
                              const isAccepted = member.status === 'Accepted'
                              const isLeader = member.role === 'Leader'
                              return (
                                <TableRow key={member.studentProfileId} hover>
                                  <TableCell>
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                      {isLeader && (
                                        <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                      )}
                                      <Typography variant="body2">{member.fullName}</Typography>
                                    </Stack>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {member.studentCode}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={isLeader ? 'Trưởng nhóm' : 'Thành viên'}
                                      size="small"
                                      color={isLeader ? 'warning' : 'default'}
                                      variant={isLeader ? 'filled' : 'outlined'}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                      {isAccepted ? (
                                        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                      ) : (
                                        <PendingIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                      )}
                                      <Typography
                                        variant="caption"
                                        color={isAccepted ? 'success.main' : 'text.secondary'}
                                      >
                                        {isAccepted ? 'Đã tham gia' : 'Đang chờ chấp nhận'}
                                      </Typography>
                                    </Stack>
                                  </TableCell>

                                  {/* Cột hành động (Leader & isOpen) */}
                                  {amLeader && isOpen && (
                                    <TableCell align="right">
                                      {/* Không hiện nút cho chính trưởng nhóm */}
                                      {!isLeader && isAccepted && (
                                        <Tooltip title="Xóa thành viên">
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleRemoveMember(member)}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                      {!isAccepted && (
                                        <Tooltip title="Hủy lời mời">
                                          <IconButton
                                            size="small"
                                            color="warning"
                                            onClick={() => handleCancelInvitation(member)}
                                          >
                                            <CloseIcon fontSize="small" />
                                          </IconButton>
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
                    </>
                  )}
                </Paper>

                {/* ── Khối Lời mời đến bạn ──────────────────────────────── */}
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <MailIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>
                      Lời mời đến bạn
                    </Typography>
                    {myInvitations.length > 0 && (
                      <Chip
                        label={myInvitations.length}
                        size="small"
                        color="primary"
                        sx={{ ml: 0.5 }}
                      />
                    )}
                  </Stack>

                  {myInvitations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Bạn không có lời mời nhóm nào đang chờ phản hồi.
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {myInvitations.map((inv) => {
                        const isProcessing =
                          respondingId === inv.teamId + 'Accepted' ||
                          respondingId === inv.teamId + 'Rejected'
                        return (
                          <Paper
                            key={inv.teamId}
                            variant="outlined"
                            sx={{
                              p: 2,
                              display: 'flex',
                              alignItems: { xs: 'flex-start', sm: 'center' },
                              flexDirection: { xs: 'column', sm: 'row' },
                              gap: 2,
                              bgcolor: 'background.default',
                            }}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {inv.teamName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                trưởng nhóm {inv.leaderFullName} · {inv.memberCount}
                                {inv.maxTeamSize ? `/${inv.maxTeamSize}` : ''} thành viên
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexShrink={0}>
                              <Tooltip title={!isOpen ? 'Thời hạn đăng ký đã kết thúc' : ''}>
                                <span>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    disabled={!isOpen || isProcessing}
                                    onClick={() => handleRespondInvitation(inv.teamId, 'Accepted')}
                                    startIcon={
                                      respondingId === inv.teamId + 'Accepted' ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <CheckCircleIcon />
                                      )
                                    }
                                  >
                                    Chấp nhận
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip title={!isOpen ? 'Thời hạn đăng ký đã kết thúc' : ''}>
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled={!isOpen || isProcessing}
                                    onClick={() => handleRespondInvitation(inv.teamId, 'Rejected')}
                                    startIcon={
                                      respondingId === inv.teamId + 'Rejected' ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <CloseIcon />
                                      )
                                    }
                                  >
                                    Từ chối
                                  </Button>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Paper>
                        )
                      })}
                    </Stack>
                  )}
                </Paper>
              </>
            )}
          </>
        )}
      </Container>

      {/* ── Modal mời thành viên ─────────────────────────────────────────── */}
      <InviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        classId={selectedClassId}
        teamId={myTeam?.teamId}
        isOpen={isOpen}
        onInvited={() => fetchPageData(selectedClassId)}
      />

      {/* ── Dialog xác nhận ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDialog}
        loading={confirmLoading}
        title={
          confirmDialog?.type === 'leave'
            ? 'Rời nhóm'
            : confirmDialog?.type === 'removeMember'
            ? 'Xóa thành viên'
            : 'Hủy lời mời'
        }
        message={
          confirmDialog?.type === 'leave'
            ? 'Bạn có chắc muốn rời nhóm? Thao tác này không thể hoàn tác.'
            : confirmDialog?.type === 'removeMember'
            ? `Bạn có chắc muốn xóa "${confirmDialog.payload?.member?.fullName}" khỏi nhóm?`
            : `Bạn có chắc muốn hủy lời mời tới "${confirmDialog?.payload?.member?.fullName}"?`
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* ── Snackbar toast ───────────────────────────────────────────────── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
