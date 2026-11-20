import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Groups as GroupsIcon,
  Star as LeaderIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material'
import { academicService } from '../../services/academicService'
import { teamService } from '../../services/teamService'
import { useAuth } from '../../context/AuthContext'
import TeamFormationTab from './TeamFormationTab'

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.data)) return value.data
  return []
}

function studentName(student) {
  return student?.fullName || student?.studentName || student?.name || 'Chưa có tên'
}

function teamIdOf(student) {
  return student?.teamId || student?.team?.teamId || ''
}

function teamNameOf(student) {
  return student?.teamName || student?.team?.teamName || 'Chưa có nhóm'
}

function getErrorDetails(error) {
  let source = error
  while (source && !source.response && source.cause) source = source.cause

  const response = source?.response
  const data = response?.data
  const rawErrors = data?.errors
  const fieldErrors = rawErrors && typeof rawErrors === 'object'
    ? Object.entries(rawErrors).flatMap(([field, messages]) =>
      (Array.isArray(messages) ? messages : [messages])
        .filter(Boolean)
        .map((message) => `${field}: ${message}`)
    )
    : []

  return {
    status: response?.status,
    message: data?.message || error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.',
    fieldErrors,
  }
}

function isAccepted(student) {
  return String(student?.status || student?.memberStatus || student?.invitationStatus || '').toLowerCase() === 'accepted'
}

function isInTeam(student) {
  const status = String(student?.status || student?.memberStatus || student?.invitationStatus || '').toLowerCase()
  return Boolean(teamIdOf(student)) && !['pending', 'invited', 'rejected'].includes(status)
}

function hasRegisteredProject(team) {
  return Boolean(
    team?.hasProject ||
    team?.projectId ||
    team?.project?.projectId ||
    team?.project?.status ||
    team?.projectStatus,
  )
}

function statusLabel(status) {
  const labels = {
    Accepted: 'Đang tham gia',
    Pending: 'Chờ phản hồi',
    Invited: 'Đã mời',
    Rejected: 'Đã từ chối',
    Studying: 'Đang học',
    Active: 'Đang hoạt động',
    Dropped: 'Đã thôi học',
  }
  return labels[status] || status || '—'
}

export default function LecturerClassManagement() {
  const { hasRole } = useAuth()
  const isLecturer = hasRole('Lecturer')
  const [semesters, setSemesters] = useState([])
  const [semesterId, setSemesterId] = useState('')
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [students, setStudents] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [classSubTab, setClassSubTab] = useState(0)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [pageError, setPageError] = useState('')
  const [semesterError, setSemesterError] = useState('')
  const [studentError, setStudentError] = useState('')
  const [teamError, setTeamError] = useState('')
  const [transferError, setTransferError] = useState(null)
  const classRequestSequence = useRef(0)
  const studentRequestSequence = useRef(0)
  const semestersRef = useRef([])

  useEffect(() => {
    semestersRef.current = semesters
  }, [semesters])

  const selectedClass = classes.find((item) => item.classId === selectedClassId)

  const loadStudents = useCallback(async (classId) => {
    const requestSequence = ++studentRequestSequence.current
    if (!classId) {
      setStudents([])
      setLoadingStudents(false)
      return []
    }
    setLoadingStudents(true)
    setStudentError('')
    try {
      const result = await academicService.getClassStudents(classId)
      const list = asArray(result)
      if (requestSequence === studentRequestSequence.current) setStudents(list)
      return list
    } catch (error) {
      const details = getErrorDetails(error)
      if (requestSequence === studentRequestSequence.current) {
        setStudentError(details.status === 403
          ? 'Bạn không phụ trách lớp này hoặc không có quyền xem roster.'
          : details.message)
        setStudents([])
      }
      return []
    } finally {
      if (requestSequence === studentRequestSequence.current) setLoadingStudents(false)
    }
  }, [])

  const loadClasses = useCallback(async (nextSemesterId = '', preferredClassId = '') => {
    const requestSequence = ++classRequestSequence.current
    setLoadingClasses(true)
    setPageError('')
    try {
      const result = await academicService.getMyClasses(nextSemesterId || undefined)
      let list = asArray(result)
      if (requestSequence !== classRequestSequence.current) return

      // Nếu có chọn học kỳ cụ thể, đảm bảo chỉ giữ lớp thuộc học kỳ đó
      if (nextSemesterId && list.length > 0) {
        const targetSem = semestersRef.current.find((s) => s.semesterId === nextSemesterId)
        const filteredList = list.filter((item) =>
          item.semesterId === nextSemesterId ||
          (targetSem?.semesterCode && item.semesterCode === targetSem.semesterCode)
        )
        if (filteredList.length < list.length) {
          list = filteredList
        }
      }

      setClasses(list)
      const nextSelectedClass = list.find((item) => item.classId === preferredClassId) || list[0]
      setSelectedClassId(nextSelectedClass?.classId || '')
      if (nextSelectedClass?.classId) {
        await loadStudents(nextSelectedClass.classId)
      } else {
        setStudents([])
      }
    } catch (error) {
      if (requestSequence !== classRequestSequence.current) return
      const details = getErrorDetails(error)
      setPageError(details.status === 403
        ? 'Bạn không có quyền xem danh sách lớp này.'
        : details.message)
      setClasses([])
      setSelectedClassId('')
      setStudents([])
    } finally {
      if (requestSequence === classRequestSequence.current) setLoadingClasses(false)
    }
  }, [loadStudents])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      setLoadingClasses(true)
      setPageError('')
      setSemesterError('')

      let semList = []
      try {
        const result = await academicService.getSemesters()
        if (!active) return
        semList = asArray(result)
        setSemesters(semList)
        semestersRef.current = semList
      } catch (error) {
        if (active) setSemesterError(getErrorDetails(error).message)
      }

      try {
        // Tải danh sách tất cả lớp học của giảng viên (không lọc kỳ)
        const allClassesResult = await academicService.getMyClasses()
        if (!active) return
        const myClassesList = asArray(allClassesResult)

        // Kiểm tra xem kỳ đang active có lớp của giảng viên không
        const activeSem = semList.find((s) => s.isActive)
        const hasClassesInActiveSem = activeSem && myClassesList.some(
          (c) => c.semesterId === activeSem.semesterId || (activeSem.semesterCode && c.semesterCode === activeSem.semesterCode)
        )

        let initialSemester = ''
        let initialClasses = myClassesList

        if (hasClassesInActiveSem) {
          initialSemester = activeSem.semesterId
          initialClasses = myClassesList.filter(
            (c) => c.semesterId === activeSem.semesterId || (activeSem.semesterCode && c.semesterCode === activeSem.semesterCode)
          )
        } else if (myClassesList.length > 0) {
          // Nếu kỳ active không có lớp, nhưng giảng viên có lớp ở kỳ khác:
          // Mặc định chọn "" (Tất cả học kỳ) để hiển thị đầy đủ lớp ngay từ đầu
          initialSemester = ''
          initialClasses = myClassesList
        } else {
          initialSemester = activeSem?.semesterId || ''
          initialClasses = []
        }

        setSemesterId(initialSemester)
        setClasses(initialClasses)
        const firstClass = initialClasses[0]
        setSelectedClassId(firstClass?.classId || '')
        if (firstClass?.classId) {
          await loadStudents(firstClass.classId)
        } else {
          setStudents([])
        }
      } catch (error) {
        if (!active) return
        const details = getErrorDetails(error)
        setPageError(details.status === 403
          ? 'Bạn không có quyền xem danh sách lớp này.'
          : details.message)
        setClasses([])
        setSelectedClassId('')
        setStudents([])
      } finally {
        if (active) {
          setLoadingClasses(false)
        }
      }
    }
    initialize()
    return () => {
      active = false
    }
  }, [loadStudents])

  const studentGroups = useMemo(() => {
    const groups = new Map()
    students.forEach((student) => {
      const id = teamIdOf(student)
      if (!id) return
      if (!groups.has(id)) {
        groups.set(id, {
          teamId: id,
          teamName: teamNameOf(student),
          students: [],
        })
      }
      groups.get(id).students.push(student)
    })
    return Array.from(groups.values())
  }, [students])

  const filteredStudents = useMemo(() => {
    const search = studentSearch.trim().toLowerCase()
    return students.filter((student) => {
      const matchesSearch = !search ||
        [studentName(student), student.studentCode, student.email, teamNameOf(student)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      return matchesSearch
    })
  }, [students, studentSearch])

  const visibleTeamIds = useMemo(
    () => new Set(filteredStudents.filter(isInTeam).map(teamIdOf)),
    [filteredStudents],
  )
  const groupedFilteredStudents = filteredStudents.filter(isInTeam)
  const ungroupedFilteredStudents = filteredStudents.filter((student) => !isInTeam(student))
  const visibleTeams = studentGroups.filter((group) => visibleTeamIds.has(group.teamId))

  const openTeamDetail = async (teamId) => {
    setSelectedTeam(null)
    setSelectedLeaderId('')
    setTeamError('')
    setTransferError(null)
    setLoadingTeam(true)
    try {
      const team = await teamService.getTeamById(teamId)
      setSelectedTeam(team)
      const members = asArray(team?.members || team?.students)
      const leader = members.find((member) => member.isTeamLeader || member.isLeader) ||
        members.find((member) => String(member.studentProfileId) === String(team?.leaderId))
      const firstEligibleMember = members.find(
        (member) => isAccepted(member) && String(member.studentProfileId) !== String(leader?.studentProfileId),
      )
      setSelectedLeaderId(firstEligibleMember?.studentProfileId || '')
    } catch (error) {
      const details = getErrorDetails(error)
      setTeamError(details.status === 403
        ? 'Bạn không có quyền xem nhóm này.'
        : details.status === 404
          ? 'Không tìm thấy nhóm. Danh sách lớp sẽ được tải lại.'
          : details.message)
      if (details.status === 404) await loadStudents(selectedClassId)
    } finally {
      setLoadingTeam(false)
    }
  }

  const teamMembers = asArray(selectedTeam?.members || selectedTeam?.students)
  const acceptedMembers = teamMembers.filter(isAccepted)
  const projectRegistered = hasRegisteredProject(selectedTeam)
  const currentLeader = teamMembers.find((member) => member.isTeamLeader || member.isLeader) ||
    teamMembers.find((member) => String(member.studentProfileId) === String(selectedTeam?.leaderId))
  const eligibleLeaders = acceptedMembers.filter(
    (member) => String(member.studentProfileId) !== String(currentLeader?.studentProfileId),
  )

  const handleTransferLeader = async () => {
    if (!selectedTeam?.teamId || !selectedLeaderId || !isLecturer || projectRegistered) return
    setTransferring(true)
    setTransferError(null)
    try {
      const updatedTeam = await teamService.transferLeader(selectedTeam.teamId, selectedLeaderId)
      setSelectedTeam(updatedTeam)
      setSelectedLeaderId('')
      await loadStudents(selectedClassId)
    } catch (error) {
      const details = getErrorDetails(error)
      setTransferError(details)
      if (details.status === 409) {
        try {
          setSelectedTeam(await teamService.getTeamById(selectedTeam.teamId))
        } catch (reloadError) {
          const reloadDetails = getErrorDetails(reloadError)
          setTeamError(reloadDetails.message)
        }
        await loadStudents(selectedClassId)
      } else if (details.status === 404) {
        await loadStudents(selectedClassId)
      }
    } finally {
      setTransferring(false)
    }
  }

  const handleSelectSemester = async (nextSemesterId) => {
    setSemesterId(nextSemesterId)
    setSelectedTeam(null)
    await loadClasses(nextSemesterId)
  }

  const handleSemesterChange = (event) => {
    handleSelectSemester(event.target.value)
  }

  const handleSelectClass = (classId) => {
    setSelectedClassId(classId)
    loadStudents(classId)
  }

  if (!isLecturer) {
    return <Alert severity="warning">Chức năng này chỉ dành cho giảng viên.</Alert>
  }

  return (
    <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>
            Lớp giảng dạy & nhóm
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chỉ hiển thị lớp do bạn phụ trách. Thông tin nhóm ở chế độ xem; chuyển trưởng nhóm chỉ khả dụng trước khi đăng ký project.
          </Typography>
        </Box>
      </Box>

      {pageError && <Alert severity="error">{pageError}</Alert>}
      {semesterError && <Alert severity="warning">Không tải được danh sách học kỳ: {semesterError}. Danh sách lớp vẫn được tải không lọc.</Alert>}

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(270px, 0.78fr) minmax(0, 2.22fr)' },
        alignItems: 'start',
        gap: { xs: 2, lg: 2.5 },
        minWidth: 0,
      }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderColor: 'grey.200', borderRadius: 2, minWidth: 0 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="lecturer-semester-label">Học kỳ</InputLabel>
                <Select
                  labelId="lecturer-semester-label"
                  label="Học kỳ"
                  value={semesterId}
                  onChange={handleSemesterChange}
                >
                  <MenuItem value="">Tất cả học kỳ</MenuItem>
                  {semesters.map((semester) => (
                    <MenuItem key={semester.semesterId} value={semester.semesterId}>
                      {semester.semesterCode} · HK{semester.term} {semester.year}{semester.isActive ? ' (Đang mở)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Quick filter chips cho các kỳ học (tương tự thiết kế mobile trong hình) */}
              {semesters.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.8,
                    overflowX: 'auto',
                    pb: 0.5,
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 },
                  }}
                >
                  <Chip
                    label="Tất cả"
                    size="small"
                    clickable
                    color={semesterId === '' ? 'primary' : 'default'}
                    variant={semesterId === '' ? 'filled' : 'outlined'}
                    onClick={() => handleSelectSemester('')}
                    sx={{
                      fontWeight: semesterId === '' ? 700 : 500,
                      fontSize: 11,
                      bgcolor: semesterId === '' ? '#0058be' : undefined,
                      flexShrink: 0,
                    }}
                  />
                  {semesters.map((sem) => {
                    const isSelected = semesterId === sem.semesterId
                    return (
                      <Chip
                        key={sem.semesterId}
                        label={sem.semesterCode}
                        size="small"
                        clickable
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        onClick={() => handleSelectSemester(sem.semesterId)}
                        sx={{
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 11,
                          bgcolor: isSelected ? '#0058be' : undefined,
                          flexShrink: 0,
                        }}
                      />
                    )
                  })}
                </Box>
              )}
            </Box>

            <Box sx={{ px: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.4, color: 'text.primary' }}>
                Lớp của tôi
              </Typography>
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 5,
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {classes.length} lớp
              </Box>
            </Box>

            {loadingClasses ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : !classes.length ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                Không có lớp được phân công trong học kỳ này.
              </Alert>
            ) : (
              classes.map((classItem) => (
                <Box
                  key={classItem.classId}
                  component="button"
                  type="button"
                  aria-pressed={selectedClassId === classItem.classId}
                  onClick={() => handleSelectClass(classItem.classId)}
                  sx={{
                    p: { xs: 1.5, sm: 1.75 },
                    cursor: 'pointer',
                    width: '100%',
                    minWidth: 0,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: 'inherit',
                    appearance: 'none',
                    border: '1px solid',
                    borderRadius: 2,
                    borderColor: selectedClassId === classItem.classId ? 'primary.main' : 'divider',
                    bgcolor: selectedClassId === classItem.classId ? 'primary.50' : 'background.paper',
                    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                    '&:hover': {
                      bgcolor: '#eaf3ff',
                      borderColor: '#60a5fa',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.14)',
                      transform: 'translateY(-1px)',
                    },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.4 }} noWrap>
                        {classItem.classCode}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        title={classItem.courseName || classItem.courseCode || 'Môn học'}
                        sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {classItem.courseName || classItem.courseCode || 'Môn học'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {classItem.semesterCode || '—'} · {classItem.currentStudents ?? classItem.studentCount ?? 0}
                        {classItem.maxStudents ? `/${classItem.maxStudents} SV` : ' SV'}
                      </Typography>
                    </Box>
                    <ChevronRightIcon fontSize="small" color={selectedClassId === classItem.classId ? 'primary' : 'disabled'} />
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </Paper>

        <Box sx={{ p: { xs: 1.5, sm: 2.25 }, minWidth: 0 }}>
          {loadingClasses ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !classes.length ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderColor: 'grey.200', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                Không có lớp học nào trong học kỳ này
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Vui lòng chọn học kỳ khác hoặc bấm &quot;Tất cả&quot; để xem các lớp bạn phụ trách.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{selectedClass?.classCode || 'Danh sách sinh viên'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedClass?.courseName || selectedClass?.courseCode || ''} · {filteredStudents.length} / {students.length} sinh viên
                  </Typography>
                </Box>
                {classSubTab === 0 && (
                  <TextField
                    size="small"
                    placeholder="Tìm sinh viên hoặc nhóm"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    sx={{ width: { xs: '100%', sm: 280 } }}
                  />
                )}
              </Box>

              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={classSubTab}
                  onChange={(e, val) => setClassSubTab(val)}
                  sx={{
                    minHeight: 40,
                    '& .MuiTab-root': {
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: 'none',
                      minHeight: 40,
                      py: 1,
                    },
                  }}
                >
                  <Tab label="Danh sách sinh viên & nhóm" />
                  <Tab label="Chia nhóm" />
                </Tabs>
              </Box>

              {classSubTab === 1 ? (
                <TeamFormationTab classId={selectedClassId} />
              ) : (
                <>
                  {studentError && <Alert severity="error">{studentError}</Alert>}
                  {loadingStudents ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
                  ) : (
                    <Stack spacing={1.25}>
                      {groupedFilteredStudents.length > 0 && (
                        <Accordion
                          defaultExpanded
                          disableGutters
                          elevation={0}
                          sx={{
                            border: '1px solid',
                            borderColor: 'grey.200',
                            borderRadius: '8px !important',
                            overflow: 'hidden',
                            '&:before': { display: 'none' },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              minHeight: 48,
                              px: 1.5,
                              bgcolor: 'grey.50',
                              '&:hover': { bgcolor: '#eef5ff' },
                              '& .MuiAccordionSummary-content': { my: 1 },
                            }}
                          >
                            <Typography fontWeight={800}>
                              Đã vào nhóm <Typography component="span" variant="body2" color="text.secondary">({groupedFilteredStudents.length})</Typography>
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: { xs: 1, sm: 1.5 } }}>
                            <Stack spacing={1.25}>
                              {visibleTeams.map((group) => (
                        <Paper key={group.teamId} variant="outlined" sx={{ overflow: 'hidden', borderColor: 'grey.200', borderRadius: 1.75 }}>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => openTeamDetail(group.teamId)}
                            aria-label={`Xem chi tiết nhóm ${group.teamName}`}
                            sx={{
                              width: '100%',
                              minWidth: 0,
                              border: 0,
                              textAlign: 'left',
                              font: 'inherit',
                              color: 'inherit',
                              cursor: 'pointer',
                              p: 1.5,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 1,
                              bgcolor: 'grey.50',
                              transition: 'background-color 160ms ease',
                              '&:hover': {
                                bgcolor: '#eaf3ff',
                                boxShadow: 'inset 3px 0 #60a5fa',
                                '& .team-open-chevron': { transform: 'translateX(3px)' },
                              },
                              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <GroupsIcon color="primary" fontSize="small" />
                              <Box>
                                <Typography fontWeight={700}>{group.teamName}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {group.students.filter(isInTeam).length} thành viên · Nhấn để xem chi tiết
                                </Typography>
                              </Box>
                            </Stack>
                            <ChevronRightIcon
                              className="team-open-chevron"
                              color="action"
                              sx={{ transition: 'transform 160ms ease' }}
                            />
                          </Box>
                          <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 560 }}>
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'background.default' }}>
                                  <TableCell sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>SINH VIÊN</TableCell>
                                  <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>MSSV</TableCell>
                                  <TableCell sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>EMAIL</TableCell>
                                  <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>TRẠNG THÁI</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.students.filter((student) => filteredStudents.includes(student)).map((student) => (
                                  <TableRow key={student.studentProfileId || student.studentCode} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                    <TableCell sx={{ py: 1.2, fontWeight: 600 }}>
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <span>{studentName(student)}</span>
                                        {(student.isTeamLeader || student.isLeader) && (
                                          <LeaderIcon
                                            titleAccess="Trưởng nhóm"
                                            sx={{ fontSize: 17, color: 'warning.main' }}
                                          />
                                        )}
                                      </Stack>
                                    </TableCell>
                                    <TableCell align="center" sx={{ py: 1.2, fontFamily: 'monospace' }}>{student.studentCode || '—'}</TableCell>
                                    <TableCell sx={{ py: 1.2 }}>{student.email || '—'}</TableCell>
                                    <TableCell align="center" sx={{ py: 1.2 }}>{statusLabel(student.status || student.memberStatus)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Paper>
                              ))}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {ungroupedFilteredStudents.length > 0 && (
                        <Accordion
                          defaultExpanded
                          disableGutters
                          elevation={0}
                          sx={{
                            border: '1px solid',
                            borderColor: 'grey.200',
                            borderRadius: '8px !important',
                            overflow: 'hidden',
                            '&:before': { display: 'none' },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              minHeight: 48,
                              px: 1.5,
                              bgcolor: 'grey.50',
                              '&:hover': { bgcolor: '#eef5ff' },
                              '& .MuiAccordionSummary-content': { my: 1 },
                            }}
                          >
                            <Typography fontWeight={800}>
                              Chưa vào nhóm <Typography component="span" variant="body2" color="text.secondary">({ungroupedFilteredStudents.length})</Typography>
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: { xs: 1, sm: 1.5 } }}>
                            <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: 'grey.200', borderRadius: 1.75 }}>
                              <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ minWidth: 540 }}>
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'background.default' }}>
                                      <TableCell sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>SINH VIÊN</TableCell>
                                      <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>MSSV</TableCell>
                                      <TableCell sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>EMAIL</TableCell>
                                      <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>TRẠNG THÁI</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {ungroupedFilteredStudents.map((student) => (
                                      <TableRow key={student.studentProfileId || student.studentCode} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                        <TableCell sx={{ py: 1.2, fontWeight: 600 }}>{studentName(student)}</TableCell>
                                        <TableCell align="center" sx={{ py: 1.2, fontFamily: 'monospace' }}>{student.studentCode || '—'}</TableCell>
                                        <TableCell>{student.email || '—'}</TableCell>
                                        <TableCell align="center">{statusLabel(student.status)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Paper>
                          </AccordionDetails>
                        </Accordion>
                      )}
                      {!filteredStudents.length && <Alert severity="info">Không tìm thấy sinh viên phù hợp.</Alert>}
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          )}
        </Box>
      </Box>

      <Dialog
        open={loadingTeam || Boolean(selectedTeam) || Boolean(teamError)}
        onClose={() => {
          if (!transferring) {
            setSelectedTeam(null)
            setTeamError('')
            setTransferError(null)
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Chi tiết nhóm{selectedTeam?.teamName ? ` · ${selectedTeam.teamName}` : ''}</DialogTitle>
        <DialogContent dividers>
          {loadingTeam ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : teamError ? (
            <Alert severity="error">{teamError}</Alert>
          ) : selectedTeam ? (
            <Stack spacing={2}>
              {transferError && (
                <Alert severity="error">
                  {transferError.message}
                  {transferError.fieldErrors.map((message) => <Typography key={message} variant="body2">{message}</Typography>)}
                </Alert>
              )}
              {projectRegistered && (
                <Alert severity="info">Nhóm đã đăng ký project; không thể chuyển quyền trưởng nhóm theo quy tắc nghiệp vụ.</Alert>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main' }}><GroupsIcon /></Avatar>
                <Box>
                  <Typography fontWeight={800}>{selectedTeam.teamName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedTeam.classCode || selectedClass?.classCode || ''} · {teamMembers.length} thành viên
                  </Typography>
                </Box>
              </Stack>
              <TableContainer>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>SINH VIÊN</TableCell>
                      <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>MSSV</TableCell>
                      <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>VAI TRÒ</TableCell>
                      <TableCell align="center" sx={{ py: 1.1, fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>TRẠNG THÁI</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.studentProfileId || member.studentCode} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ py: 1.2, fontWeight: 600 }}>{studentName(member)}</TableCell>
                        <TableCell align="center" sx={{ py: 1.2, fontFamily: 'monospace' }}>{member.studentCode || '—'}</TableCell>
                        <TableCell align="center" sx={{ py: 1.2 }}>{member.isTeamLeader || member.isLeader ? 'Trưởng nhóm' : 'Thành viên'}</TableCell>
                        <TableCell align="center" sx={{ py: 1.2 }}>{statusLabel(member.status || member.memberStatus)}</TableCell>
                      </TableRow>
                    ))}
                    {!teamMembers.length && <TableRow><TableCell colSpan={4}>Nhóm chưa có danh sách thành viên.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
              {isLecturer && !projectRegistered && (
                <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  {eligibleLeaders.length ? (
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        CHUYỂN TRƯỞNG NHÓM
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 0, flex: 1 }}>
                          <InputLabel id="new-team-leader-label">Thành viên mới</InputLabel>
                          <Select
                            labelId="new-team-leader-label"
                            label="Thành viên mới"
                            value={selectedLeaderId}
                            onChange={(event) => setSelectedLeaderId(event.target.value)}
                          >
                            {eligibleLeaders.map((member) => (
                              <MenuItem key={member.studentProfileId} value={member.studentProfileId}>
                                {studentName(member)} · {member.studentCode || '—'}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          size="small"
                          variant="contained"
                          aria-label="Chuyển trưởng nhóm"
                          title="Chuyển trưởng nhóm"
                          startIcon={transferring ? <CircularProgress size={16} color="inherit" /> : <TransferIcon />}
                          disabled={!selectedLeaderId || transferring}
                          onClick={handleTransferLeader}
                          sx={{
                            minWidth: { xs: 44, sm: 184 },
                            px: { xs: 1, sm: 1.5 },
                            py: 1,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            fontSize: 11,
                            letterSpacing: 0.2,
                            '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } },
                          }}
                        >
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            Chuyển trưởng nhóm
                          </Box>
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Không có thành viên Accepted đủ điều kiện để nhận quyền trưởng nhóm.
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSelectedTeam(null); setTeamError(''); setTransferError(null) }} disabled={transferring}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
