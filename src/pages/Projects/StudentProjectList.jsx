import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowForward as ArrowForwardIcon, Search as SearchIcon } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { academicService } from '../../services/academicService'
import { getVietnamDateInputValue } from '../../utils/dateFormatting'
import { projectService } from '../../services/projectService'
import { teamService } from '../../services/teamService'
import ProjectStatus from './ProjectStatus'
import { getProjectListAction, getSemesterWeight, isTeamLeader, normalizeProjectSearch } from './projectHelpers'

const ALL_SEMESTERS = 'ALL'
const STUDENT_PROJECT_PATH = '/class-setup/student/project'
const listColumns = 'minmax(0, 1fr) 140px 156px'
const rowSpacing = { px: { xs: 1.5, sm: 2.25 }, columnGap: { xs: 1, sm: 2 } }

/** Kỳ đang diễn ra (hôm nay nằm trong khoảng ngày của kỳ) trong số các kỳ sinh viên có nhóm; kỳ bắt đầu muộn nhất nếu trùng. */
function findCurrentSemesterCode(semesterList, teamSemesterCodes) {
  const today = getVietnamDateInputValue()
  const current = semesterList
    .filter((semester) => teamSemesterCodes.has(semester.semesterCode))
    .filter((semester) => String(semester.startDate).slice(0, 10) <= today && today <= String(semester.endDate).slice(0, 10))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
  return current[0]?.semesterCode || null
}

function compareSemesters(first, second) {
  return getSemesterWeight(second) - getSemesterWeight(first) || second.localeCompare(first, 'vi', { numeric: true })
}

function getClassSemesterCode(classItem) {
  return (
    classItem?.semesterCode ||
    classItem?.semester?.semesterCode ||
    classItem?.semester?.code ||
    ''
  )
}

function buildInactiveSemesterSets(semesterList = []) {
  const inactiveIds = new Set()
  const inactiveCodes = new Set()
  semesterList.forEach((semester) => {
    if (semester && semester.isActive === false) {
      if (semester.semesterId) inactiveIds.add(String(semester.semesterId))
      if (semester.semesterCode) inactiveCodes.add(String(semester.semesterCode).trim().toUpperCase())
    }
  })
  return { inactiveIds, inactiveCodes }
}

function isClassInInactiveSemester(classItem, { inactiveIds, inactiveCodes }) {
  if (!classItem) return false
  if (classItem.semester?.isActive === false || classItem.semesterIsActive === false) return true
  const semId = classItem.semesterId ?? classItem.semester?.semesterId
  if (semId && inactiveIds.has(String(semId))) return true
  const semCode = getClassSemesterCode(classItem).trim().toUpperCase()
  if (semCode && inactiveCodes.has(semCode)) return true
  return false
}

/**
 * Tải thông tin nhóm cho các lớp đang hoạt động của sinh viên:
 * - Bỏ qua lớp trùng classId và lớp đã biết thuộc học kỳ không còn hoạt động (tránh gọi dư API).
 * - 404 (chưa thuộc nhóm) và 409 (học kỳ không còn hoạt động) không tính là lỗi tải dữ liệu.
 * - Chỉ đánh dấu incomplete khi gặp lỗi thực sự (mạng, 401/403, 500, 400 hoặc 409 khác).
 */
async function loadStudentTeams(rawClasses, inactiveSemesterSets) {
  const uniqueClasses = []
  const seenClassIds = new Set()
  for (const classItem of rawClasses) {
    const id = classItem?.classId
    if (!id || seenClassIds.has(String(id))) continue
    seenClassIds.add(String(id))
    uniqueClasses.push(classItem)
  }

  const inactiveClassIds = new Set()
  const activeClasses = []
  for (const classItem of uniqueClasses) {
    if (isClassInInactiveSemester(classItem, inactiveSemesterSets)) {
      inactiveClassIds.add(String(classItem.classId))
    } else {
      activeClasses.push(classItem)
    }
  }

  const results = await Promise.allSettled(activeClasses.map(async (classItem) => {
    const result = await teamService.getMyTeamWithStatus(classItem.classId)
    if (result.status === 'inactive_semester') {
      inactiveClassIds.add(String(classItem.classId))
      return null
    }
    if (result.status !== 'ok' || !result.team?.teamId) return null

    const team = result.team
    return {
      ...team,
      classId: team.classId || classItem.classId,
      classCode: team.classCode || classItem.classCode,
      courseName: classItem.courseName,
      semesterCode: team.semesterCode || getClassSemesterCode(classItem) || 'Chưa phân kỳ',
      isSemesterInactive: false,
    }
  }))

  const failedMessages = [
    ...new Set(
      results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.message)
        .filter(Boolean)
    ),
  ]

  return {
    teams: results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : [])),
    incomplete: results.some((result) => result.status === 'rejected'),
    teamErrorMessage: failedMessages[0] || '',
    inactiveClassIds,
    uniqueClasses,
  }
}

/**
 * Bổ sung các dự án đã có từ GET /api/projects nếu nhóm của dự án đó không nằm trong danh sách lớp đang hoạt động
 * (ví dụ lớp thuộc học kỳ đã ngưng hoạt động trả 409 hoặc đã được bỏ qua), giúp danh sách dự án vẫn hiển thị đủ.
 */
function mergeProjectsIntoTeams(teams, projectsList, classes, inactiveClassIds, inactiveSemesterSets) {
  const merged = [...teams]
  const existingTeamIds = new Set(teams.map((team) => String(team.teamId)))
  const classById = new Map(classes.map((item) => [String(item.classId), item]))
  const classByCode = new Map(
    classes
      .filter((item) => item.classCode)
      .map((item) => [String(item.classCode).trim().toUpperCase(), item])
  )

  for (const project of projectsList) {
    if (!project?.teamId || !project?.projectId) continue
    const teamKey = String(project.teamId)
    if (existingTeamIds.has(teamKey)) continue
    existingTeamIds.add(teamKey)

    const matchedClass =
      (project.classId && classById.get(String(project.classId))) ||
      (project.classCode && classByCode.get(String(project.classCode).trim().toUpperCase())) ||
      null
    const semesterCode = project.semesterCode || getClassSemesterCode(matchedClass) || 'Chưa phân kỳ'
    const isSemesterInactive = Boolean(
      (matchedClass?.classId && inactiveClassIds.has(String(matchedClass.classId))) ||
      isClassInInactiveSemester(matchedClass, inactiveSemesterSets) ||
      (semesterCode !== 'Chưa phân kỳ' &&
        inactiveSemesterSets.inactiveCodes.has(String(semesterCode).trim().toUpperCase()))
    )

    merged.push({
      teamId: project.teamId,
      teamName: project.teamName || 'Nhóm dự án',
      classId: project.classId || matchedClass?.classId || null,
      classCode: project.classCode || matchedClass?.classCode || '',
      courseName: project.courseName || matchedClass?.courseName || '',
      semesterCode,
      isSemesterInactive,
      isReadyForProject: false,
      fromProjectFallback: true,
    })
  }

  return merged
}

function StudentProjectRow({ team, project, isLeader, action, hasProjectData }) {
  const projectTitle = project?.title?.trim()
  const title = projectTitle || team.teamName || 'Nhóm dự án'
  const context = [team.courseName, team.classCode, team.semesterCode].filter(Boolean).join(' · ')
  const role = team.fromProjectFallback
    ? (team.isSemesterInactive ? 'Học kỳ không còn hoạt động' : '')
    : (isLeader ? 'Trưởng nhóm' : 'Thành viên')
  const teamAndRole = [
    projectTitle && team.teamName ? team.teamName : '',
    role,
  ].filter(Boolean).join(' · ')
  const statusLabel = hasProjectData ? 'Chưa có dự án' : 'Chưa tải được'

  return (
    <Box
      component="li"
      sx={{
        ...rowSpacing,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: listColumns },
        rowGap: 1,
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        py: 1.75,
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' }, overflowWrap: 'anywhere' }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{context}</Typography>
        {teamAndRole && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{teamAndRole}</Typography>
        )}
      </Box>

      <Box>
        {project ? <ProjectStatus status={project.status} size="small" /> : <ProjectStatus label={statusLabel} size="small" />}
      </Box>

      <Box sx={{ justifySelf: 'end', textAlign: 'right', minWidth: 0 }}>
        {action?.label ? (
          <Button
            component={RouterLink}
            to={STUDENT_PROJECT_PATH + '/' + team.teamId}
            state={{ fromProjectList: true }}
            variant={action.variant}
            size="small"
            disableElevation
            aria-label={action.label + ' ' + title}
            endIcon={<ArrowForwardIcon />}
            sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            {action.label}
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">{action?.message}</Typography>
        )}
      </Box>
    </Box>
  )
}

export default function StudentProjectList() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedSemester, setSelectedSemester] = useState(null)
  const requestSeqRef = useRef(0)

  const loadOverview = useCallback(async () => {
    const requestId = ++requestSeqRef.current
    setLoading(true)
    setLoadError('')

    // Tải song song danh sách lớp, dự án và học kỳ trước để lọc bỏ lớp thuộc học kỳ đã ngưng hoạt động
    // trước khi gọi GET /api/classes/{classId}/team, tránh spam request và tránh 409 không cần thiết.
    const [classesResult, projectsResult, semestersResult] = await Promise.allSettled([
      academicService.getMyClasses(),
      projectService.getMyProjects(),
      academicService.getSemesters(),
    ])
    if (requestId !== requestSeqRef.current) return

    const semesterList =
      semestersResult.status === 'fulfilled' && Array.isArray(semestersResult.value)
        ? semestersResult.value
        : []
    const inactiveSemesterSets = buildInactiveSemesterSets(semesterList)

    const projectsList =
      projectsResult.status === 'fulfilled' && Array.isArray(projectsResult.value)
        ? projectsResult.value
        : []
    const projectsByTeam = projectsResult.status === 'fulfilled'
      ? new Map(
          projectsList
            .filter((project) => project?.teamId && project.projectId)
            .map((project) => [project.teamId, project])
        )
      : null
    const projectsError =
      projectsResult.status === 'rejected'
        ? (projectsResult.reason?.message || 'Không thể tải trạng thái dự án.')
        : ''

    if (classesResult.status === 'rejected') {
      const classErrMsg = classesResult.reason?.message || 'Không thể tải danh sách nhóm của bạn.'
      // Nếu vẫn tải được danh sách dự án từ getMyProjects(), vẫn hiển thị dự án kèm cảnh báo.
      if (projectsList.length > 0) {
        const fallbackTeams = mergeProjectsIntoTeams([], projectsList, [], new Set(), inactiveSemesterSets)
        const teamSemesterCodes = new Set(fallbackTeams.map((team) => team.semesterCode))
        setOverview({
          teams: fallbackTeams,
          incomplete: true,
          teamErrorMessage: classErrMsg,
          projectsByTeam,
          projectsError,
          currentSemesterCode: findCurrentSemesterCode(semesterList, teamSemesterCodes),
        })
      } else {
        setLoadError(classErrMsg)
      }
      setLoading(false)
      return
    }

    const rawClasses = Array.isArray(classesResult.value)
      ? classesResult.value
      : classesResult.value?.items || []
    const teamsData = await loadStudentTeams(rawClasses, inactiveSemesterSets)
    if (requestId !== requestSeqRef.current) return

    const mergedTeams = mergeProjectsIntoTeams(
      teamsData.teams,
      projectsList,
      teamsData.uniqueClasses,
      teamsData.inactiveClassIds,
      inactiveSemesterSets
    )
    const teamSemesterCodes = new Set(mergedTeams.map((team) => team.semesterCode))
    setOverview({
      teams: mergedTeams,
      incomplete: teamsData.incomplete,
      teamErrorMessage: teamsData.teamErrorMessage,
      projectsByTeam,
      projectsError,
      currentSemesterCode: findCurrentSemesterCode(semesterList, teamSemesterCodes),
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadOverview, 0)
    return () => {
      window.clearTimeout(timer)
      requestSeqRef.current += 1
    }
  }, [loadOverview])

  const semesters = useMemo(() => (
    [...new Set(overview?.teams.map((team) => team.semesterCode))].sort(compareSemesters)
  ), [overview])
  const wantedSemester = selectedSemester ?? overview?.currentSemesterCode ?? ALL_SEMESTERS
  const activeSemester = semesters.includes(wantedSemester) ? wantedSemester : ALL_SEMESTERS

  const rows = useMemo(() => {
    if (!overview) return []
    const keyword = normalizeProjectSearch(search)
    return overview.teams.flatMap((team) => {
      if (activeSemester !== ALL_SEMESTERS && team.semesterCode !== activeSemester) return []
      const project = overview.projectsByTeam?.get(team.teamId)
      const searchText = [project?.title, team.teamName, team.courseName, team.classCode, team.semesterCode].join(' ')
      if (!normalizeProjectSearch(searchText).includes(keyword)) return []

      const isLeader = isTeamLeader(team, user)
      const action = overview.projectsByTeam ? getProjectListAction(team, project, isLeader) : null
      return [{ team, project, isLeader, action }]
    }).sort((first, second) => {
      // Đưa các dự án sinh viên có thể tạo hoặc tiếp tục chỉnh sửa lên trước.
      const actionOrder = Number(second.action?.variant === 'contained') - Number(first.action?.variant === 'contained')
      return actionOrder || compareSemesters(first.team.semesterCode, second.team.semesterCode) ||
        (first.project?.title || first.team.teamName || '').localeCompare(
          second.project?.title || second.team.teamName || '', 'vi'
        )
    })
  }, [activeSemester, overview, search, user])

  const handleSemesterChange = (event) => {
    setSelectedSemester(event.target.value)
  }

  return (
    <PortalLayout headerTitle="Dự án của tôi">
      <Container maxWidth="lg" disableGutters sx={{ pb: 5 }}>
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800, mb: 2.5 }}>
          Dự án của tôi
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress aria-label="Đang tải dự án" />
          </Box>
        ) : loadError ? (
          <Alert severity="error" action={<Button onClick={loadOverview}>Thử lại</Button>}>{loadError}</Alert>
        ) : overview && (
          <Stack spacing={2}>
            {overview.incomplete && (
              <Alert severity="warning" action={<Button onClick={loadOverview}>Thử lại</Button>}>
                {overview.teamErrorMessage
                  ? `Một số lớp chưa tải được thông tin nhóm: ${overview.teamErrorMessage}`
                  : 'Một số lớp chưa tải được thông tin nhóm.'}
              </Alert>
            )}
            {overview.teams.length > 0 && !overview.projectsByTeam && (
              <Alert severity="warning" action={<Button onClick={loadOverview}>Thử lại</Button>}>
                {overview.projectsError || 'Không thể tải trạng thái dự án.'}
              </Alert>
            )}

            {overview.teams.length === 0 ? (
              !overview.incomplete && (
                <Alert
                  severity="info"
                  action={<Button component={RouterLink} to="/class-setup/student/groups">Xem nhóm</Button>}
                >
                  Bạn chưa tham gia nhóm nào trong các lớp hiện tại.
                </Alert>
              )
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 184px' }, gap: 1.5, pt: 0.5 }}>
                  <TextField
                    label="Tìm kiếm"
                    type="search"
                    placeholder="Tên dự án, nhóm, môn hoặc mã lớp"
                    size="small"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: {
                        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                      },
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                  />
                  <TextField
                    select
                    label="Học kỳ"
                    size="small"
                    value={activeSemester}
                    onChange={handleSemesterChange}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                  >
                    <MenuItem value={ALL_SEMESTERS}>Tất cả học kỳ</MenuItem>
                    {semesters.map((semester) => <MenuItem key={semester} value={semester}>{semester}</MenuItem>)}
                  </TextField>
                </Box>

                <Typography variant="caption" color="text.secondary" aria-live="polite">{rows.length} nhóm</Typography>

                {rows.length ? (
                  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        ...rowSpacing,
                        display: { xs: 'none', sm: 'grid' },
                        gridTemplateColumns: listColumns,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        borderBottom: 1,
                        borderColor: 'divider',
                        py: 1.1,
                        typography: 'body2',
                        fontWeight: 700,
                      }}
                    >
                      <Box>Dự án và nhóm</Box>
                      <Box>Trạng thái</Box>
                      <Box sx={{ textAlign: 'right' }}>Thao tác</Box>
                    </Box>
                    <Box component="ul" aria-label="Dự án và nhóm của bạn" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                      {rows.map((row) => (
                        <StudentProjectRow key={row.team.teamId} {...row} hasProjectData={Boolean(overview.projectsByTeam)} />
                      ))}
                    </Box>
                  </Paper>
                ) : <Alert severity="info">Không tìm thấy dự án hoặc nhóm phù hợp.</Alert>}
              </>
            )}
          </Stack>
        )}
      </Container>
    </PortalLayout>
  )
}
