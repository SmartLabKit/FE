import { useCallback, useEffect, useMemo, useState } from 'react'
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

async function loadStudentTeams() {
  const response = await academicService.getMyClasses()
  const classes = Array.isArray(response) ? response : response?.items || []
  const results = await Promise.allSettled(classes.map(async (classItem) => {
    const team = await teamService.getMyTeam(classItem.classId)
    if (!team?.teamId) return null
    return {
      ...team,
      classCode: team.classCode || classItem.classCode,
      courseName: classItem.courseName,
      semesterCode: team.semesterCode || classItem.semesterCode ||
        classItem.semester?.semesterCode || classItem.semester?.code || 'Chưa phân kỳ',
    }
  }))
  return {
    teams: results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []),
    incomplete: results.some((result) => result.status === 'rejected'),
  }
}

function StudentProjectRow({ team, project, isLeader, action, hasProjectData }) {
  const projectTitle = project?.title?.trim()
  const title = projectTitle || team.teamName || 'Nhóm dự án'
  const context = [team.courseName, team.classCode, team.semesterCode].filter(Boolean).join(' · ')
  const role = isLeader ? 'Trưởng nhóm' : 'Thành viên'
  const teamAndRole = projectTitle && team.teamName ? team.teamName + ' · ' + role : role
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{teamAndRole}</Typography>
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

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    // Tách lỗi tải dự án khỏi lỗi tải nhóm để nhóm vẫn hiện khi chưa biết trạng thái dự án.
    const [teamsResult, projectsResult, semestersResult] = await Promise.allSettled([
      loadStudentTeams(),
      projectService.getMyProjects(),
      academicService.getSemesters(),
    ])
    if (teamsResult.status === 'rejected') {
      setLoadError(teamsResult.reason?.message || 'Không thể tải danh sách nhóm của bạn.')
    } else {
      const projectsByTeam = projectsResult.status === 'fulfilled'
        ? new Map(projectsResult.value.filter((project) => project?.teamId && project.projectId).map((project) => [project.teamId, project]))
        : null
      const semesterList = semestersResult.status === 'fulfilled' && Array.isArray(semestersResult.value) ? semestersResult.value : []
      const teamSemesterCodes = new Set(teamsResult.value.teams.map((team) => team.semesterCode))
      setOverview({
        ...teamsResult.value,
        projectsByTeam,
        currentSemesterCode: findCurrentSemesterCode(semesterList, teamSemesterCodes),
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadOverview, 0)
    return () => window.clearTimeout(timer)
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
                Một số lớp chưa tải được thông tin nhóm.
              </Alert>
            )}
            {overview.teams.length > 0 && !overview.projectsByTeam && (
              <Alert severity="warning" action={<Button onClick={loadOverview}>Thử lại</Button>}>
                Không thể tải trạng thái dự án.
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
