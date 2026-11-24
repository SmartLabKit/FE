import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowForward as ArrowForwardIcon,
  FilterAltOff as FilterAltOffIcon,
  Groups as GroupsIcon,
  InfoOutlined as InfoOutlinedIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon,
  RocketLaunch as ProjectIcon,
  School as SchoolIcon,
  Search as SearchIcon,
  Star as StarIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
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
const ALL_STATUSES = 'ALL'
const NO_PROJECT_STATUS = 'NO_PROJECT'
const STUDENT_PROJECT_PATH = '/class-setup/student/project'
const STUDENT_GROUPS_PATH = '/class-setup/student/groups'

const STATUS_FILTER_OPTIONS = [
  { value: ALL_STATUSES, label: 'Tất cả trạng thái' },
  { value: NO_PROJECT_STATUS, label: 'Chưa có dự án' },
  { value: 'Draft', label: 'Bản nháp' },
  { value: 'Submitted', label: 'Chờ GV duyệt' },
  { value: 'Approved', label: 'Đã duyệt' },
  { value: 'Rejected', label: 'Bị từ chối' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

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

function StudentProjectCard({ team, project, isLeader, action, hasProjectData }) {
  const projectTitle = project?.title?.trim()
  const title = projectTitle || team.teamName || 'Nhóm dự án'
  const statusLabel = hasProjectData ? 'Chưa có dự án' : 'Chưa tải được'
  const isActionable = action?.variant === 'contained'

  return (
    <Paper
      component="li"
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: isActionable ? '1px solid #bfdbfe' : '1px solid #e4e6ef',
        bgcolor: '#ffffff',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          borderColor: '#93c5fd',
          bgcolor: '#fafbff',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Cột thông tin chính: Badge học kỳ/lớp/vai trò, tên dự án, tên nhóm & môn học */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            {team.semesterCode && (
              <Chip
                label={`Kỳ ${team.semesterCode}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: '#eff6ff',
                  color: '#1d4ed8',
                }}
              />
            )}

            {team.classCode && (
              <Chip
                label={`Lớp: ${team.classCode}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: '#eaedff',
                  color: '#0058be',
                }}
              />
            )}

            {!team.fromProjectFallback && (
              isLeader ? (
                <Chip
                  icon={<StarIcon sx={{ fontSize: '12px !important' }} />}
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
              ) : (
                <Chip
                  label="Thành viên"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                  }}
                />
              )
            )}

            {team.isSemesterInactive ? (
              <Chip
                icon={<LockIcon sx={{ fontSize: '12px !important' }} />}
                label="Học kỳ đã ngưng hoạt động"
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
            ) : (
              !project && team.isReadyForProject && (
                <Chip
                  label="Đủ điều kiện lập dự án"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: '#ecfdf5',
                    color: '#047857',
                  }}
                />
              )
            )}
          </Box>

          <Typography
            component="h2"
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              color: '#131b2e',
              fontSize: { xs: 15.5, sm: 16.5 },
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
            }}
          >
            {projectTitle || 'Chưa thiết lập đề tài dự án'}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 2.25,
              rowGap: 0.75,
              mt: 0.75,
            }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
              <GroupsIcon sx={{ fontSize: 16, color: '#64748b', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: '#475569', fontSize: 13 }}>
                Nhóm:{' '}
                <Box component="strong" sx={{ color: '#131b2e', fontWeight: 700 }}>
                  {team.teamName || 'Nhóm dự án'}
                </Box>
              </Typography>
            </Box>

            {team.courseName && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
                <SchoolIcon sx={{ fontSize: 16, color: '#64748b', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: '#475569', fontSize: 13, overflowWrap: 'anywhere' }}>
                  {team.courseName}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Cột trạng thái & nút thao tác */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'space-between', md: 'flex-end' },
            flexWrap: 'wrap',
            gap: 1.5,
            flexShrink: 0,
            pt: { xs: 1.5, md: 0 },
            borderTop: { xs: '1px solid #f1f5f9', md: 'none' },
          }}
        >
          <Box>
            {project ? <ProjectStatus status={project.status} size="small" /> : <ProjectStatus label={statusLabel} size="small" />}
          </Box>

          <Box sx={{ minWidth: { md: 144 }, display: 'flex', justifyContent: 'flex-end' }}>
            {action?.label ? (
              <Button
                component={RouterLink}
                to={STUDENT_PROJECT_PATH + '/' + team.teamId}
                state={{ fromProjectList: true }}
                variant={action.variant}
                size="small"
                disableElevation
                aria-label={action.label + ' ' + title}
                endIcon={<ArrowForwardIcon sx={{ fontSize: '16px !important' }} />}
                sx={
                  action.variant === 'contained'
                    ? {
                        bgcolor: '#0058be',
                        color: '#ffffff',
                        borderRadius: 1.5,
                        px: 2,
                        py: 0.75,
                        fontWeight: 700,
                        fontSize: 12.5,
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: '#0049a3' },
                      }
                    : {
                        borderColor: '#bfdbfe',
                        color: '#0058be',
                        bgcolor: '#f8fbff',
                        borderRadius: 1.5,
                        px: 2,
                        py: 0.75,
                        fontWeight: 700,
                        fontSize: 12.5,
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        '&:hover': { bgcolor: '#eff6ff', borderColor: '#0058be' },
                      }
                }
              >
                {action.label}
              </Button>
            ) : action?.message ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                }}
              >
                {team.isSemesterInactive ? (
                  <LockIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                ) : (
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                )}
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: 12 }}>
                  {action.message}
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}

function EmptyProjectsState({ title, description, showResetFilter = false, onResetFilter }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3.5, sm: 5 },
        borderRadius: 2,
        border: '1px dashed #c2c6d6',
        bgcolor: '#ffffff',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          bgcolor: '#eff6ff',
          color: '#0058be',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.75,
        }}
      >
        <ProjectIcon sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 17, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13.5, maxWidth: 480, mx: 'auto', mb: 2.5 }}>
        {description}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
        {showResetFilter && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterAltOffIcon sx={{ fontSize: 16 }} />}
            onClick={onResetFilter}
            sx={{
              borderColor: '#cbd5e1',
              color: '#334155',
              borderRadius: 1.5,
              px: 2,
              py: 0.85,
              fontWeight: 700,
              fontSize: 12.5,
              textTransform: 'none',
              '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
            }}
          >
            Xóa bộ lọc
          </Button>
        )}
        <Button
          component={RouterLink}
          to={STUDENT_GROUPS_PATH}
          variant="contained"
          size="small"
          disableElevation
          startIcon={<GroupsIcon sx={{ fontSize: 17 }} />}
          sx={{
            bgcolor: '#0058be',
            color: '#ffffff',
            borderRadius: 1.5,
            px: 2.25,
            py: 0.85,
            fontWeight: 700,
            fontSize: 12.5,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#0049a3' },
          }}
        >
          Đi tới Nhóm &amp; Lời mời
        </Button>
      </Box>
    </Paper>
  )
}

export default function StudentProjectList() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES)
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

  const semesterTeams = useMemo(() => {
    if (!overview) return []
    return overview.teams.filter(
      (team) => activeSemester === ALL_SEMESTERS || team.semesterCode === activeSemester
    )
  }, [activeSemester, overview])

  const summaryCounts = useMemo(() => {
    let withProject = 0
    let withoutProject = 0
    let actionable = 0
    for (const team of semesterTeams) {
      const project = overview?.projectsByTeam?.get(team.teamId)
      if (project) withProject += 1
      else if (overview?.projectsByTeam) withoutProject += 1
      const isLeader = isTeamLeader(team, user)
      const action = overview?.projectsByTeam ? getProjectListAction(team, project, isLeader) : null
      if (action?.variant === 'contained') actionable += 1
    }
    return {
      total: semesterTeams.length,
      withProject,
      withoutProject,
      actionable,
    }
  }, [overview, semesterTeams, user])

  const rows = useMemo(() => {
    if (!overview) return []
    const keyword = normalizeProjectSearch(search)
    return overview.teams.flatMap((team) => {
      if (activeSemester !== ALL_SEMESTERS && team.semesterCode !== activeSemester) return []
      const project = overview.projectsByTeam?.get(team.teamId)
      if (statusFilter !== ALL_STATUSES) {
        if (statusFilter === NO_PROJECT_STATUS) {
          if (project || !overview.projectsByTeam) return []
        } else if (project?.status !== statusFilter) {
          return []
        }
      }
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
  }, [activeSemester, overview, search, statusFilter, user])

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== ALL_STATUSES

  const handleSemesterChange = (event) => {
    setSelectedSemester(event.target.value)
  }

  const handleResetFilters = () => {
    setSearch('')
    setStatusFilter(ALL_STATUSES)
  }

  return (
    <PortalLayout
      headerTitle="Dự án của tôi"
      headerSubtitle="Theo dõi tiến độ phê duyệt, thiết lập và quản lý dự án theo nhóm"
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto', boxSizing: 'border-box', pb: 5 }}
      >
        {/* Header section đồng bộ với Nhóm & Lời mời */}
        <Box
          sx={{
            mb: 2.5,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700, fontSize: 11 }}>
              Không gian sinh viên &gt; Dự án của tôi
            </Typography>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.5, mb: 0.25 }}>
              Dự án của tôi
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13 }}>
              Quản lý đề tài, theo dõi trạng thái phê duyệt và truy cập nhanh dự án theo từng nhóm học phần.
            </Typography>
          </Box>

          <Button
            component={RouterLink}
            to={STUDENT_GROUPS_PATH}
            variant="outlined"
            size="small"
            startIcon={<GroupsIcon sx={{ fontSize: 17 }} />}
            sx={{
              borderColor: '#bfdbfe',
              color: '#0058be',
              bgcolor: '#f8fbff',
              borderRadius: 1.5,
              px: 2,
              py: 0.85,
              fontWeight: 700,
              fontSize: 12.5,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#eff6ff', borderColor: '#0058be' },
            }}
          >
            Nhóm &amp; Lời mời
          </Button>
        </Box>

        {loading ? (
          <Paper
            elevation={0}
            sx={{
              py: 8,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
            }}
          >
            <CircularProgress size={36} aria-label="Đang tải dự án" sx={{ color: '#0058be' }} />
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>
              Đang tải danh sách nhóm và dự án của bạn...
            </Typography>
          </Paper>
        ) : loadError ? (
          <Alert
            severity="error"
            sx={{ borderRadius: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={loadOverview}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Thử lại
              </Button>
            }
          >
            {loadError}
          </Alert>
        ) : overview && (
          <Stack spacing={2.5}>
            {overview.incomplete && (
              <Alert
                severity="warning"
                sx={{ borderRadius: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                    onClick={loadOverview}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Thử lại
                  </Button>
                }
              >
                {overview.teamErrorMessage
                  ? `Một số lớp chưa tải được thông tin nhóm: ${overview.teamErrorMessage}`
                  : 'Một số lớp chưa tải được thông tin nhóm.'}
              </Alert>
            )}
            {overview.teams.length > 0 && !overview.projectsByTeam && (
              <Alert
                severity="warning"
                sx={{ borderRadius: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                    onClick={loadOverview}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Thử lại
                  </Button>
                }
              >
                {overview.projectsError || 'Không thể tải trạng thái dự án.'}
              </Alert>
            )}

            {overview.teams.length === 0 ? (
              !overview.incomplete && (
                <EmptyProjectsState
                  title="Bạn chưa tham gia nhóm nào"
                  description="Hãy tạo nhóm mới hoặc chấp nhận lời mời tham gia nhóm trong lớp học của bạn để bắt đầu thiết lập dự án."
                />
              )
            ) : (
              <>
                {/* Thanh bộ lọc đồng bộ phong cách Nhóm & Lời mời */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '1px solid #e4e6ef',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'minmax(0, 1.6fr) minmax(190px, 0.75fr) minmax(200px, 0.85fr)',
                      },
                      gap: 2,
                      alignItems: 'end',
                    }}
                  >
                    <Box sx={{ gridColumn: { xs: 'auto', sm: '1 / -1', md: 'auto' } }}>
                      <Typography
                        variant="caption"
                        component="label"
                        htmlFor="student-project-search"
                        sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10.5, mb: 0.6 }}
                      >
                        TÌM KIẾM
                      </Typography>
                      <TextField
                        id="student-project-search"
                        fullWidth
                        type="search"
                        placeholder="Tên dự án, tên nhóm, môn học hoặc mã lớp..."
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: 18, color: '#64748b' }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            height: 40,
                            fontSize: 13,
                            bgcolor: '#fafbff',
                          },
                        }}
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        component="label"
                        htmlFor="student-project-semester"
                        sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10.5, mb: 0.6 }}
                      >
                        HỌC KỲ
                      </Typography>
                      <Select
                        id="student-project-semester"
                        fullWidth
                        size="small"
                        value={activeSemester}
                        onChange={handleSemesterChange}
                        sx={{ borderRadius: 1.5, height: 40, fontSize: 13, bgcolor: '#fafbff' }}
                      >
                        <MenuItem value={ALL_SEMESTERS} sx={{ fontSize: 13 }}>
                          Tất cả học kỳ
                        </MenuItem>
                        {semesters.map((semester) => (
                          <MenuItem key={semester} value={semester} sx={{ fontSize: 13 }}>
                            {semester === 'Chưa phân kỳ' ? semester : `Kỳ ${semester}`}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        component="label"
                        htmlFor="student-project-status"
                        sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10.5, mb: 0.6 }}
                      >
                        TRẠNG THÁI
                      </Typography>
                      <Select
                        id="student-project-status"
                        fullWidth
                        size="small"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        sx={{ borderRadius: 1.5, height: 40, fontSize: 13, bgcolor: '#fafbff' }}
                      >
                        {STATUS_FILTER_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value} sx={{ fontSize: 13 }}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Box>

                  {/* Dải tóm tắt số lượng & nút đặt lại bộ lọc */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1.25,
                      mt: 2,
                      pt: 1.75,
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }} aria-live="polite">
                      <Typography variant="body2" sx={{ color: '#475569', fontSize: 12.5, fontWeight: 600 }}>
                        Hiển thị <Box component="strong" sx={{ color: '#131b2e' }}>{rows.length}</Box> / {summaryCounts.total} nhóm
                      </Typography>
                      {overview.projectsByTeam && (
                        <>
                          
                          {summaryCounts.withoutProject > 0 && (
                            <Chip
                              label={`${summaryCounts.withoutProject} chưa tạo dự án`}
                              size="small"
                              sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          )}
                          {summaryCounts.actionable > 0 && (
                            <Chip
                              label={`${summaryCounts.actionable} cần thao tác`}
                              size="small"
                              sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                            />
                          )}
                        </>
                      )}
                    </Box>

                    {hasActiveFilters && (
                      <Button
                        size="small"
                        startIcon={<FilterAltOffIcon sx={{ fontSize: 15 }} />}
                        onClick={handleResetFilters}
                        sx={{
                          color: '#0058be',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 12,
                          px: 1.25,
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: '#eff6ff' },
                        }}
                      >
                        Đặt lại bộ lọc
                      </Button>
                    )}
                  </Box>
                </Paper>

                {/* Danh sách thẻ dự án hoặc empty state */}
                {rows.length > 0 ? (
                  <Stack
                    component="ul"
                    spacing={1.5}
                    aria-label="Dự án và nhóm của bạn"
                    sx={{ listStyle: 'none', m: 0, p: 0 }}
                  >
                    {rows.map((row) => (
                      <StudentProjectCard
                        key={row.team.teamId}
                        {...row}
                        hasProjectData={Boolean(overview.projectsByTeam)}
                      />
                    ))}
                  </Stack>
                ) : (
                  <EmptyProjectsState
                    title={
                      hasActiveFilters
                        ? 'Không tìm thấy dự án hoặc nhóm phù hợp'
                        : 'Chưa có nhóm hoặc dự án trong học kỳ này'
                    }
                    description={
                      hasActiveFilters
                        ? 'Thử thay đổi từ khóa tìm kiếm, chọn trạng thái khác hoặc đặt lại bộ lọc để xem toàn bộ danh sách.'
                        : 'Bạn chưa có nhóm hay dự án nào ở học kỳ đang chọn. Truy cập Nhóm & Lời mời để tạo nhóm hoặc kiểm tra lời mời.'
                    }
                    showResetFilter={hasActiveFilters}
                    onResetFilter={handleResetFilters}
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </Container>
    </PortalLayout>
  )
}
