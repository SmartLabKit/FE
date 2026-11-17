import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Delete as DeleteIcon,
  Groups as GroupsIcon,
  Save as SaveIcon,
  School as SchoolIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
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
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { academicService } from '../../services/academicService'
import { inventoryService } from '../../services/inventoryService'
import { projectService } from '../../services/projectService'
import { teamService } from '../../services/teamService'
import FinalSubmissionPanel from './FinalSubmissionPanel'

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

const emptyForm = () => ({ title: '', description: '', components: [], selfSuppliedItems: [] })

function normalizeProjectForm(project) {
  return {
    title: project?.title || '',
    description: project?.description || '',
    components: (project?.components || []).map((component, index) => ({
      componentId: component.componentId || '',
      quantity: component.quantity || 1,
      note: component.note || '',
      clientKey: `existing-component-${index}`,
    })),
    selfSuppliedItems: (project?.selfSuppliedItems || []).map((item, index) => ({
      itemName: item.itemName || '',
      quantity: item.quantity || 1,
      note: item.note || '',
      clientKey: `existing-self-${index}`,
    })),
  }
}

function getFormError(form) {
  if (!form.title.trim() || !form.description.trim()) {
    return 'Vui lòng nhập tên và mô tả project.'
  }
  if (form.components.some((item) => !item.componentId || Number(item.quantity) < 1)) {
    return 'Vui lòng chọn loại linh kiện và số lượng hợp lệ cho tất cả các dòng.'
  }
  if (form.selfSuppliedItems.some((item) => !item.itemName.trim() || Number(item.quantity) < 1)) {
    return 'Vui lòng nhập tên món tự mua và số lượng hợp lệ cho tất cả các dòng.'
  }
  return ''
}

function toProjectPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    components: form.components.map(({ componentId, quantity, note }) => ({
      componentId,
      quantity: Number(quantity),
      note: note.trim(),
    })),
    selfSuppliedItems: form.selfSuppliedItems.map(({ itemName, quantity, note }) => ({
      itemName: itemName.trim(),
      quantity: Number(quantity),
      note: note.trim(),
    })),
  }
}

function formatStatus(status) {
  const labels = {
    Draft: 'Bản nháp',
    Submitted: 'Chờ duyệt',
    Rejected: 'Bị từ chối',
    Approved: 'Đã duyệt',
    Cancelled: 'Đã hủy',
  }
  return labels[status] || status || 'Chưa xác định'
}

function dateInVietnam(value) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const dateParts = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

function localDateValue() {
  return dateInVietnam(new Date())
}

function formatVietnamDate(value) {
  const date = dateInVietnam(value)
  return date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : '—'
}

function ProjectStatus({ status }) {
  const colors = {
    Draft: { bgcolor: '#eff6ff', color: '#1d4ed8' },
    Submitted: { bgcolor: '#fff7ed', color: '#c2410c' },
    Rejected: { bgcolor: '#fef2f2', color: '#b91c1c' },
    Approved: { bgcolor: '#ecfdf5', color: '#047857' },
  }
  return (
    <Chip
      label={formatStatus(status)}
      size="small"
      sx={{ fontWeight: 800, ...(colors[status] || { bgcolor: '#f1f5f9', color: '#475569' }) }}
    />
  )
}

export default function ProjectManagement() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [team, setTeam] = useState(null)
  const [teamChoices, setTeamChoices] = useState([])
  const [project, setProject] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [componentTypes, setComponentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [borrowDate, setBorrowDate] = useState(localDateValue())
  const [borrowDeadline, setBorrowDeadline] = useState(null)
  const [loadingDeadline, setLoadingDeadline] = useState(false)
  const [deadlineError, setDeadlineError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [componentError, setComponentError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [selectedSemester, setSelectedSemester] = useState(() => {
    return localStorage.getItem('student_selected_semester') || 'ALL'
  })
  const [teamSearchQuery, setTeamSearchQuery] = useState('')
  const rowKeySequence = useRef(0)

  const updateSemester = (sem) => {
    setSelectedSemester(sem)
    try {
      localStorage.setItem('student_selected_semester', sem)
    } catch (err) {
      console.warn('Lỗi lưu selected semester:', err)
    }
  }

  const handleSemesterChange = (event) => {
    updateSemester(event.target.value)
  }

  // Danh sách các học kỳ có nhóm, sắp xếp từ mới nhất đến cũ nhất
  const semestersList = useMemo(() => {
    const semMap = new Map()
    teamChoices.forEach((teamChoice) => {
      const code = teamChoice.semesterCode || 'Chưa phân kỳ'
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
  }, [teamChoices])

  // Lọc danh sách nhóm theo học kỳ và từ khóa tìm kiếm
  const filteredTeamChoices = useMemo(() => {
    return teamChoices.filter((teamChoice) => {
      // Lọc học kỳ
      if (selectedSemester !== 'ALL') {
        const sem = teamChoice.semesterCode || 'Chưa phân kỳ'
        if (sem !== selectedSemester) return false
      }

      // Lọc từ khóa tìm kiếm
      if (teamSearchQuery.trim()) {
        const q = teamSearchQuery.toLowerCase().trim()
        const matchName = teamChoice.teamName?.toLowerCase().includes(q)
        const matchClass = teamChoice.classCode?.toLowerCase().includes(q)
        const matchCourse = teamChoice.courseName?.toLowerCase().includes(q)
        const matchSem = teamChoice.semesterCode?.toLowerCase().includes(q)
        if (!matchName && !matchClass && !matchCourse && !matchSem) return false
      }

      return true
    })
  }, [teamChoices, selectedSemester, teamSearchQuery])

  const nextRowKey = (prefix) => {
    rowKeySequence.current += 1
    return `${prefix}-${rowKeySequence.current}`
  }

  const isLeader = useMemo(() => {
    if (!team || !user) return false
    const identity = [
      user.studentProfileId,
      user.profileId,
      user.userId,
      user.id,
      user.studentCode,
    ].filter(Boolean).map(String)
    if (identity.includes(String(team.leaderId))) return true
    return (team.members || []).some(
      (member) =>
        member.isLeader &&
        identity.some(
          (id) => id === String(member.studentProfileId) || id === String(member.studentCode)
        )
    )
  }, [team, user])

  const canEdit = isLeader && (!project || ['Draft', 'Rejected'].includes(project.status))
  const requiresBorrow = form.components.length > 0

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const openSubmitDialog = async () => {
    if (!project?.projectId) return
    setBorrowDeadline(null)
    setDeadlineError('')
    setBorrowDate(localDateValue())
    setSubmitDialogOpen(true)
    if (!requiresBorrow) {
      setLoadingDeadline(false)
      return
    }

    setLoadingDeadline(true)
    try {
      setBorrowDeadline(await projectService.getBorrowDeadline(project.projectId))
    } catch (error) {
      setDeadlineError(error.message || 'Không thể tải hạn trả theo học kỳ.')
    } finally {
      setLoadingDeadline(false)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (!teamId) {
        const classResponse = await academicService.getMyClasses()
        const classes = Array.isArray(classResponse) ? classResponse : classResponse?.items || []
        const teamResults = await Promise.all(
          classes.map(async (classItem) => ({
            classItem,
            team: await teamService.getMyTeam(classItem.classId),
          }))
        )
        const mappedTeams = teamResults
          .filter(({ team: teamInClass }) => teamInClass)
          .map(({ classItem, team: teamInClass }) => ({
            ...teamInClass,
            classCode: teamInClass.classCode || classItem.classCode,
            courseName: classItem.courseName,
            semesterCode:
              teamInClass.semesterCode ||
              classItem.semesterCode ||
              classItem.semester?.semesterCode ||
              classItem.semester?.code ||
              '',
          }))
          .sort((a, b) => {
            const diff = getSemesterWeight(b.semesterCode) - getSemesterWeight(a.semesterCode)
            if (diff !== 0) return diff
            return (a.teamName || '').localeCompare(b.teamName || '')
          })
        setTeamChoices(mappedTeams)
        return
      }

      setTeamChoices([])
      const teamData = await teamService.getTeamById(teamId)
      if (!teamData?.classId) {
        throw new Error('Không tìm thấy lớp của nhóm để tải project.')
      }
      setTeam(teamData)

      const [projectsResult, componentsResult] = await Promise.allSettled([
        projectService.getProjectsByClass(teamData.classId),
        inventoryService.getComponents({ isActive: true, page: 1, size: 100 }),
      ])
      if (projectsResult.status === 'rejected') throw projectsResult.reason
      setComponentTypes(componentsResult.status === 'fulfilled' ? componentsResult.value : [])
      setComponentError(
        componentsResult.status === 'rejected'
          ? 'Không thể tải danh sách linh kiện. Các thông tin project hiện có vẫn được hiển thị.'
          : ''
      )
      const projects = projectsResult.value
      const teamProject = projects.find((item) => item.teamId === teamData.teamId)
      if (teamProject?.projectId) {
        const detail = await projectService.getProject(teamProject.projectId)
        setProject(detail)
        setForm(normalizeProjectForm(detail))
      } else {
        setProject(null)
        setForm(emptyForm())
      }
    } catch (error) {
      setLoadError(error.message || 'Không thể tải dữ liệu project.')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) loadData()
    })
    return () => {
      active = false
    }
  }, [loadData])

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const addComponent = () =>
    updateForm('components', [
      ...form.components,
      { componentId: '', quantity: 1, note: '', clientKey: nextRowKey('component') },
    ])

  const updateComponent = (clientKey, key, value) =>
    updateForm(
      'components',
      form.components.map((item) => item.clientKey === clientKey ? { ...item, [key]: value } : item)
    )

  const removeComponent = (clientKey) =>
    updateForm('components', form.components.filter((item) => item.clientKey !== clientKey))

  const addSelfSuppliedItem = () =>
    updateForm('selfSuppliedItems', [
      ...form.selfSuppliedItems,
      { itemName: '', quantity: 1, note: '', clientKey: nextRowKey('self') },
    ])

  const updateSelfSuppliedItem = (clientKey, key, value) =>
    updateForm(
      'selfSuppliedItems',
      form.selfSuppliedItems.map((item) => item.clientKey === clientKey ? { ...item, [key]: value } : item)
    )

  const removeSelfSuppliedItem = (clientKey) =>
    updateForm('selfSuppliedItems', form.selfSuppliedItems.filter((item) => item.clientKey !== clientKey))

  const saveProject = async () => {
    if (!canEdit) return
    const validationError = getFormError(form)
    if (validationError) {
      showToast(validationError, 'warning')
      return
    }

    const payload = toProjectPayload(form)

    setSaving(true)
    try {
      const saved = project
        ? await projectService.updateProject(project.projectId, payload)
        : await projectService.createProject(team.teamId, payload)
      setProject(saved)
      setForm(normalizeProjectForm(saved))
      setSuggestions(null)
      showToast(project ? 'Đã lưu thay đổi project.' : 'Đã tạo project ở trạng thái bản nháp.')
    } catch (error) {
      showToast(error.message || 'Không thể lưu project.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const requestSuggestions = async () => {
    if (!form.description.trim()) {
      showToast('Nhập mô tả project trước khi yêu cầu AI gợi ý.', 'warning')
      return
    }
    setSuggesting(true)
    try {
      setSuggestions(await projectService.suggestComponents(form.description.trim()))
    } catch (error) {
      showToast(error.message || 'Không thể lấy gợi ý linh kiện.', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestedComponent = (suggested) => {
    const existing = form.components.find((item) => item.componentId === suggested.componentId)
    if (existing) {
      updateComponent(existing.clientKey, 'quantity', Number(existing.quantity) + Number(suggested.quantity || 1))
      return
    }
    updateForm('components', [
      ...form.components,
      {
        componentId: suggested.componentId,
        quantity: Number(suggested.quantity) || 1,
        note: suggested.reason || '',
        clientKey: nextRowKey(`suggest-${suggested.componentId}`),
      },
    ])
  }

  const addSuggestedSelfItem = (suggested) => {
    updateForm('selfSuppliedItems', [
      ...form.selfSuppliedItems,
      {
        itemName: suggested.itemName,
        quantity: Number(suggested.quantity) || 1,
        note: suggested.reason || '',
        clientKey: nextRowKey('suggest-self'),
      },
    ])
  }

  const submitProject = async () => {
    if (!project?.projectId) {
      showToast('Không tìm thấy project để gửi duyệt.', 'error')
      return
    }
    if (requiresBorrow && (!borrowDeadline || deadlineError)) {
      showToast('Chưa tải được hạn trả theo học kỳ. Vui lòng thử lại.', 'warning')
      return
    }
    if (requiresBorrow && !borrowDeadline.canBorrow) {
      showToast('Học kỳ hiện không cho phép mượn linh kiện.', 'warning')
      return
    }
    const deadlineDate = dateInVietnam(borrowDeadline?.dueDate)
    if (requiresBorrow && (!borrowDate || !deadlineDate || borrowDate < localDateValue() || deadlineDate <= borrowDate)) {
      showToast('Ngày mượn phải từ hôm nay trở đi và trước hạn trả của học kỳ.', 'warning')
      return
    }
    const validationError = getFormError(form)
    if (validationError) {
      showToast(validationError, 'warning')
      return
    }
    setSubmitting(true)
    try {
      const updatedProject = await projectService.updateProject(
        project.projectId,
        toProjectPayload(form)
      )
      const result = await projectService.submitProject(updatedProject.projectId, {
        borrowDate: requiresBorrow ? borrowDate : null,
        dueDate: requiresBorrow ? deadlineDate : null,
      })
      setProject(result)
      setSubmitDialogOpen(false)
      showToast('Đã gửi project chờ giảng viên duyệt.')
    } catch (error) {
      showToast(error.message || 'Không thể gửi duyệt project.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const withdrawProject = async () => {
    if (!project?.projectId) return
    setWithdrawing(true)
    try {
      const result = await projectService.withdrawProject(project.projectId)
      setProject(result)
      showToast('Đã rút project về bản nháp.')
    } catch (error) {
      showToast(error.message || 'Không thể rút project.', 'error')
    } finally {
      setWithdrawing(false)
    }
  }

  const getComponentName = (componentId) =>
    componentTypes.find((component) => component.componentId === componentId)?.componentName ||
    project?.components?.find((component) => component.componentId === componentId)?.componentName ||
    ''

  return (
    <PortalLayout headerTitle="Thiết lập dự án" headerSubtitle={team?.teamName || 'Quản lý đồ án nhóm'}>
      <Container maxWidth="xl" disableGutters sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto', boxSizing: 'border-box', pb: 5 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/class-setup/student/groups')}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
        >
          Quay lại nhóm
        </Button>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800, color: '#131b2e' }}>
            Thiết lập dự án
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {team ? `${team.teamName} · Lớp ${team.classCode}` : 'Tạo, cập nhật và gửi duyệt project của nhóm.'}
          </Typography>
        </Box>

        {!teamId && loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : !teamId && loadError ? (
          <Alert severity="error" action={<Button onClick={loadData}>Thử lại</Button>}>{loadError}</Alert>
        ) : !teamId ? (
          <Box>
            {/* Thanh lọc theo học kỳ & Tìm kiếm (Thiết kế đồng bộ với Nhóm & Lời mời) */}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                <SchoolIcon sx={{ color: '#0058be', fontSize: 28 }} />

                {/* Phân loại theo kỳ học */}
                <Box sx={{ minWidth: 200 }}>
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
                      Tất cả các kỳ ({teamChoices.length} nhóm)
                    </MenuItem>
                    {semestersList.map((sem) => (
                      <MenuItem key={sem.code} value={sem.code} sx={{ fontSize: 13 }}>
                        Kỳ {sem.code} ({sem.count} nhóm)
                      </MenuItem>
                    ))}
                  </Select>
                </Box>

                {/* Ô tìm kiếm nhóm / môn */}
                <Box sx={{ flex: 1, minWidth: 240, maxWidth: 420 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, display: 'block', fontSize: 10, mb: 0.5 }}>
                    TÌM KIẾM NHÓM / MÔN HỌC:
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Nhập tên nhóm, môn học, mã lớp..."
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                        </InputAdornment>
                      ),
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
              </Box>

              {/* Nút lọc nhanh dạng Chip */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`Tất cả (${teamChoices.length})`}
                  size="small"
                  onClick={() => updateSemester('ALL')}
                  color={selectedSemester === 'ALL' ? 'primary' : 'default'}
                  variant={selectedSemester === 'ALL' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                />
                {semestersList.map((sem) => (
                  <Chip
                    key={`chip-${sem.code}`}
                    label={`Kỳ ${sem.code} (${sem.count})`}
                    size="small"
                    onClick={() => updateSemester(sem.code)}
                    color={selectedSemester === sem.code ? 'primary' : 'default'}
                    variant={selectedSemester === sem.code ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Paper>

            {/* Tiêu đề & Đếm số lượng */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e' }}>
                Chọn nhóm để thiết lập dự án
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Hiển thị {filteredTeamChoices.length} / {teamChoices.length} nhóm
              </Typography>
            </Box>

            {teamChoices.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Bạn chưa tham gia nhóm nào trong các lớp hiện tại. Hãy tham gia hoặc tạo nhóm trước.
              </Alert>
            ) : filteredTeamChoices.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {teamSearchQuery
                  ? `Không tìm thấy nhóm nào phù hợp với từ khóa "${teamSearchQuery}".`
                  : `Không có nhóm nào thuộc kỳ ${selectedSemester}. Bạn có thể chọn "Tất cả các kỳ" để xem tất cả nhóm.`}
              </Alert>
            ) : (
              <Grid container spacing={2.5}>
                {filteredTeamChoices.map((teamChoice) => (
                  <Grid item xs={12} md={6} key={teamChoice.teamId}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        border: '1px solid #e4e6ef',
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#0058be',
                          boxShadow: '0 4px 16px rgba(0, 88, 190, 0.08)',
                        },
                      }}
                    >
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1.5,
                                bgcolor: '#eff6ff',
                                color: '#0058be',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <GroupsIcon sx={{ fontSize: 24 }} />
                            </Box>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', lineHeight: 1.3 }}>
                                {teamChoice.teamName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: 12 }}>
                                {teamChoice.classCode}
                              </Typography>
                            </Box>
                          </Box>
                          {teamChoice.semesterCode && (
                            <Chip
                              label={`Kỳ ${teamChoice.semesterCode}`}
                              size="small"
                              sx={{
                                bgcolor: '#eaedff',
                                color: '#0058be',
                                fontWeight: 800,
                                fontSize: 11,
                                borderRadius: 1.5,
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, color: '#475569' }}>
                          <SchoolIcon sx={{ fontSize: 17, color: '#94a3b8' }} />
                          <Typography variant="body2" sx={{ color: '#475569', fontSize: 13, fontWeight: 500 }}>
                            {teamChoice.courseName || 'Môn học đồ án'}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11.5 }}>
                          Mã nhóm: {teamChoice.teamId?.slice(0, 8)}...
                        </Typography>
                        <Button
                          variant="contained"
                          endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                          onClick={() => navigate(`/class-setup/student/project/${teamChoice.teamId}`)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 12.5,
                            borderRadius: 1.5,
                            bgcolor: '#0058be',
                            boxShadow: 'none',
                            px: 2,
                            py: 0.7,
                            '&:hover': { bgcolor: '#0049a3' },
                          }}
                        >
                          Mở dự án
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : loadError ? (
          <Alert severity="error" action={<Button onClick={loadData}>Thử lại</Button>}>{loadError}</Alert>
        ) : (
          <Stack spacing={2.5}>
            {!isLeader && (
              <Alert severity="info">
                Chế độ chỉ xem: chỉ trưởng nhóm mới được tạo, chỉnh sửa, gửi duyệt hoặc rút project.
              </Alert>
            )}

            {project?.status === 'Rejected' && (
              <Alert severity="error">
                <strong>Lý do từ chối:</strong> {project.reviewComment || 'Giảng viên chưa cung cấp lý do.'}
              </Alert>
            )}

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
              {componentError && <Alert severity="warning" sx={{ mb: 2 }}>{componentError}</Alert>}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {project ? 'Thông tin project' : 'Tạo project'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {project ? 'Cập nhật mô tả và danh sách vật tư cho project.' : 'Lưu lần đầu sẽ tạo project ở trạng thái bản nháp.'}
                  </Typography>
                </Box>
                {project && <ProjectStatus status={project.status} />}
              </Box>

              <Stack spacing={2}>
                <TextField
                  label="Tên project"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  disabled={!canEdit || saving}
                  fullWidth
                  required
                />
                <TextField
                  label="Mô tả"
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  disabled={!canEdit || saving}
                  fullWidth
                  required
                  multiline
                  minRows={4}
                />

                {project && (
                  <>
                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Linh kiện mượn kho</Typography>
                          <Typography variant="caption" color="text.secondary">Chọn loại linh kiện và số lượng; không chọn serial.</Typography>
                        </Box>
                        <Button startIcon={<AddIcon />} onClick={addComponent} disabled={!canEdit} sx={{ textTransform: 'none' }}>
                          Thêm loại
                        </Button>
                      </Box>
                      <Stack spacing={1.5}>
                        {form.components.map((item) => (
                          <Box
                            key={item.clientKey}
                            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 90px', sm: 'minmax(180px, 1fr) 110px minmax(140px, 1fr) 40px' }, gap: 1, alignItems: 'center' }}
                          >
                            <TextField
                              select
                              label="Loại linh kiện"
                              value={item.componentId}
                              onChange={(event) => updateComponent(item.clientKey, 'componentId', event.target.value)}
                              disabled={!canEdit}
                              size="small"
                              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                            >
                              {item.componentId && !componentTypes.some((c) => c.componentId === item.componentId) && (
                                <MenuItem value={item.componentId}>{getComponentName(item.componentId) || 'Linh kiện hiện có'}</MenuItem>
                              )}
                              {componentTypes.map((component) => (
                                <MenuItem key={component.componentId} value={component.componentId}>
                                  {component.componentName} ({component.componentCode})
                                </MenuItem>
                              ))}
                            </TextField>
                            <TextField
                              label="Số lượng"
                              type="number"
                              size="small"
                              inputProps={{ min: 1 }}
                              value={item.quantity}
                              onChange={(event) => updateComponent(item.clientKey, 'quantity', event.target.value)}
                              disabled={!canEdit}
                            />
                            <TextField
                              label="Ghi chú"
                              size="small"
                              value={item.note}
                              onChange={(event) => updateComponent(item.clientKey, 'note', event.target.value)}
                              disabled={!canEdit}
                              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                            />
                            <IconButton aria-label="Xóa linh kiện" onClick={() => removeComponent(item.clientKey)} disabled={!canEdit} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        ))}
                        {form.components.length === 0 && <Alert severity="info">Chưa thêm linh kiện mượn kho.</Alert>}
                      </Stack>
                    </Box>

                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Món tự mua</Typography>
                          <Typography variant="caption" color="text.secondary">Các vật tư nhóm tự chuẩn bị, không mượn từ kho.</Typography>
                        </Box>
                        <Button startIcon={<AddIcon />} onClick={addSelfSuppliedItem} disabled={!canEdit} sx={{ textTransform: 'none' }}>
                          Thêm món
                        </Button>
                      </Box>
                      <Stack spacing={1.5}>
                        {form.selfSuppliedItems.map((item) => (
                          <Box
                            key={item.clientKey}
                            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 90px', sm: 'minmax(160px, 1fr) 100px minmax(140px, 1fr) 40px' }, gap: 1, alignItems: 'center' }}
                          >
                            <TextField
                              label="Tên món"
                              size="small"
                              value={item.itemName}
                              onChange={(event) => updateSelfSuppliedItem(item.clientKey, 'itemName', event.target.value)}
                              disabled={!canEdit}
                              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                            />
                            <TextField
                              label="Số lượng"
                              type="number"
                              size="small"
                              inputProps={{ min: 1 }}
                              value={item.quantity}
                              onChange={(event) => updateSelfSuppliedItem(item.clientKey, 'quantity', event.target.value)}
                              disabled={!canEdit}
                            />
                            <TextField
                              label="Ghi chú"
                              size="small"
                              value={item.note}
                              onChange={(event) => updateSelfSuppliedItem(item.clientKey, 'note', event.target.value)}
                              disabled={!canEdit}
                              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                            />
                            <IconButton aria-label="Xóa món tự mua" onClick={() => removeSelfSuppliedItem(item.clientKey)} disabled={!canEdit} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        ))}
                        {form.selfSuppliedItems.length === 0 && <Alert severity="info">Chưa thêm món tự mua.</Alert>}
                      </Stack>
                    </Box>

                    <Divider />
                    <Box>
                      <Button
                        variant="outlined"
                        startIcon={suggesting ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                        disabled={!canEdit || suggesting}
                        onClick={requestSuggestions}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        {suggesting ? 'Đang lấy gợi ý...' : 'AI gợi ý linh kiện'}
                      </Button>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.75 }}>
                        Gợi ý chưa được lưu; hãy thêm hoặc bỏ từng mục rồi bấm Lưu. Tối đa 10 lượt mỗi giờ.
                      </Typography>
                      {suggestions && (
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Kết quả gợi ý</Typography>
                          {suggestions.hint && <Alert severity="info">{suggestions.hint}</Alert>}
                          {(suggestions.borrowable || []).map((suggestion) => (
                            <Alert
                              key={suggestion.componentId}
                              severity="success"
                              action={
                                <Button size="small" onClick={() => addSuggestedComponent(suggestion)} disabled={!canEdit}>
                                  Thêm vào danh sách mượn
                                </Button>
                              }
                            >
                              {suggestion.componentName} · {suggestion.quantity} {suggestion.unit || ''} {suggestion.reason ? `— ${suggestion.reason}` : ''}
                            </Alert>
                          ))}
                          {(suggestions.notEnoughStock || []).map((suggestion) => (
                            <Alert key={suggestion.componentId} severity="warning">
                              {suggestion.componentName}: cần {suggestion.quantity}, hiện có {suggestion.available}. {suggestion.reason || ''}
                            </Alert>
                          ))}
                          {(suggestions.selfSupplied || []).map((suggestion, index) => (
                            <Alert
                              key={`${suggestion.itemName}-${index}`}
                              severity="info"
                              action={
                                <Button size="small" onClick={() => addSuggestedSelfItem(suggestion)} disabled={!canEdit}>
                                  Thêm vào danh sách tự mua
                                </Button>
                              }
                            >
                              {suggestion.itemName} · {suggestion.quantity} {suggestion.reason ? `— ${suggestion.reason}` : ''}
                            </Alert>
                          ))}
                          {!suggestions.borrowable?.length && !suggestions.notEnoughStock?.length && !suggestions.selfSupplied?.length && (
                            <Alert severity="info">AI chưa có gợi ý phù hợp cho mô tả hiện tại.</Alert>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </>
                )}
              </Stack>

              {canEdit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    disabled={saving}
                    onClick={saveProject}
                    sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
                  >
                    {saving ? 'Đang lưu...' : project ? 'Lưu project' : 'Lưu nháp'}
                  </Button>
                </Box>
              )}
            </Paper>

            {project && (
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Gửi duyệt project</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Ngày mượn và ngày trả sẽ được backend kiểm tra theo quy định lớp và tồn kho.
                </Typography>
                {isLeader && ['Draft', 'Rejected'].includes(project.status) && (
                  <Button variant="contained" startIcon={<SendIcon />} onClick={openSubmitDialog} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Gửi duyệt
                  </Button>
                )}
                {isLeader && project.status === 'Submitted' && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={withdrawing ? <CircularProgress size={16} /> : <UndoIcon />}
                    disabled={withdrawing}
                    onClick={withdrawProject}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {withdrawing ? 'Đang rút...' : 'Rút lại'}
                  </Button>
                )}
                {!isLeader && <Typography variant="body2" color="text.secondary">Chỉ trưởng nhóm mới có thể gửi duyệt hoặc rút project.</Typography>}
              </Paper>
            )}

            {project?.status === 'Approved' && (
              <FinalSubmissionPanel
                project={project}
                isLeader={isLeader}
                onProjectUpdated={setProject}
                showToast={showToast}
              />
            )}
          </Stack>
        )}
      </Container>

      <Dialog open={submitDialogOpen} onClose={() => !submitting && !loadingDeadline && setSubmitDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Xác nhận gửi duyệt đề tài</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {loadingDeadline && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {deadlineError && <Alert severity="error">{deadlineError}</Alert>}
            {requiresBorrow && !loadingDeadline && borrowDeadline && (
              <>
                <Box
                  sx={{
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Kỳ học</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {borrowDeadline.semesterCode || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Hạn trả thiết bị</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {formatVietnamDate(borrowDeadline.dueDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <Typography variant="caption" color="text.secondary" display="block">Thời gian còn lại</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: borrowDeadline.daysLeft < 0 ? '#b91c1c' : '#1d4ed8' }}>
                      {borrowDeadline.daysLeft} ngày
                    </Typography>
                  </Box>
                </Box>
                {!borrowDeadline.canBorrow && (
                  <Alert severity="error" sx={{ py: 0 }}>
                    Học kỳ đã kết thúc hoặc hiện không còn trong thời gian cho phép mượn linh kiện.
                  </Alert>
                )}
                <TextField
                  label="Ngày dự kiến nhận đồ"
                  type="date"
                  value={borrowDate}
                  onChange={(event) => setBorrowDate(event.target.value)}
                  inputProps={{ min: localDateValue() }}
                  InputLabelProps={{ shrink: true }}
                  required
                  disabled={!borrowDeadline.canBorrow}
                  fullWidth
                />
              </>
            )}
            {!requiresBorrow && !loadingDeadline && !deadlineError && (
              <Typography variant="body2" color="text.secondary">
                Project chỉ bao gồm linh kiện tự chuẩn bị, hệ thống sẽ gửi đề tài cho Giảng viên duyệt mà không tạo đơn mượn kho.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={submitting || loadingDeadline}>Đóng</Button>
          <Button
            variant="contained"
            onClick={submitProject}
            disabled={
              submitting ||
              loadingDeadline ||
              (requiresBorrow && (
                Boolean(deadlineError) ||
                !borrowDeadline ||
                !borrowDeadline.canBorrow ||
                !borrowDate ||
                borrowDate < localDateValue() ||
                !borrowDeadline.dueDate ||
                dateInVietnam(borrowDeadline.dueDate) <= borrowDate
              ))
            }
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          >
            {submitting ? 'Đang gửi...' : 'Xác nhận gửi'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((current) => ({ ...current, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
