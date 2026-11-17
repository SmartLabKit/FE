import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
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
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
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
const suggestionCacheKey = (projectId) => `smartlabkit:project-suggestions:${projectId}`

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

function mergeCachedSuggestionsIntoForm(form, selectedSuggestions = []) {
  const mergedForm = { ...form, components: [...form.components], selfSuppliedItems: [...form.selfSuppliedItems] }
  selectedSuggestions.forEach((selection, index) => {
    if (selection.type === 'component' && selection.componentId) {
      const existing = mergedForm.components.find((item) => item.componentId === selection.componentId)
      if (existing) {
        existing.quantity = Math.max(Number(existing.quantity) || 1, Number(selection.quantity) || 1)
        if (!existing.note && selection.note) existing.note = selection.note
      } else {
        mergedForm.components.push({
          componentId: selection.componentId,
          quantity: Number(selection.quantity) || 1,
          note: selection.note || '',
          clientKey: `cached-suggestion-${selection.componentId}`,
        })
      }
    } else if (selection.type === 'self' && selection.itemName) {
      const alreadyAdded = mergedForm.selfSuppliedItems.some(
        (item) => item.itemName.trim().toLocaleLowerCase() === selection.itemName.trim().toLocaleLowerCase()
      )
      if (!alreadyAdded) {
        mergedForm.selfSuppliedItems.push({
          itemName: selection.itemName,
          quantity: Number(selection.quantity) || 1,
          note: selection.note || '',
          clientKey: `cached-suggestion-self-${index}`,
        })
      }
    }
  })
  return mergedForm
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

function QuantityLabel({ name, quantity }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography
        component="span"
        variant="body2"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}
      >
        {name}
      </Typography>
      <Box
        component="span"
        sx={{
          flexShrink: 0,
          minWidth: 24,
          px: 0.75,
          py: 0.15,
          borderRadius: 999,
          bgcolor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        {quantity}
      </Box>
    </Box>
  )
}

const selectedChipStyles = {
  height: 'auto',
  minHeight: 36,
  maxWidth: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 2,
  bgcolor: '#fff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  cursor: 'pointer',
  '& .MuiChip-label': { display: 'block', px: 1.1, py: 0.55, minWidth: 0 },
  '& .MuiChip-deleteIcon': { color: '#64748b', mr: 0.5, '&:hover': { color: '#dc2626' } },
  '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.14)' },
  '&:active': { bgcolor: '#dbeafe' },
}

const suggestedChipStyles = {
  height: 'auto',
  minHeight: 36,
  maxWidth: '100%',
  border: '1px solid #bfdbfe',
  borderRadius: 2,
  bgcolor: '#f8fbff',
  color: '#1e40af',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.07)',
  cursor: 'pointer',
  '& .MuiChip-label': { display: 'block', px: 1.1, py: 0.55, minWidth: 0 },
  '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.16)' },
  '&:active': { bgcolor: '#dbeafe' },
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
  const [selectedSuggestions, setSelectedSuggestions] = useState([])
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [editingChip, setEditingChip] = useState(null)
  const [addItemDialogType, setAddItemDialogType] = useState(null)
  const [newItemDraft, setNewItemDraft] = useState({ componentId: '', itemName: '', quantity: 1, note: '' })
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

  const writeSuggestionCache = (nextSuggestions, nextSelected = selectedSuggestions) => {
    if (!project?.projectId || !nextSuggestions) return
    try {
      localStorage.setItem(
        suggestionCacheKey(project.projectId),
        JSON.stringify({ suggestions: nextSuggestions, selected: nextSelected })
      )
    } catch (error) {
      showToast(error.message || 'Không thể lưu bộ nhớ tạm kết quả gợi ý.', 'warning')
    }
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
        const projectForm = normalizeProjectForm(detail)
        setProject(detail)
        try {
          const cachedValue = localStorage.getItem(suggestionCacheKey(detail.projectId))
          if (cachedValue) {
            const cached = JSON.parse(cachedValue)
            const cachedSuggestions = cached?.suggestions
            const cachedSelections = Array.isArray(cached?.selected) ? cached.selected : []
            if (cachedSuggestions && typeof cachedSuggestions === 'object') {
              setSuggestions(cachedSuggestions)
              setSelectedSuggestions(cachedSelections)
              setForm(mergeCachedSuggestionsIntoForm(projectForm, cachedSelections))
            } else {
              setSuggestions(null)
              setSelectedSuggestions([])
              setForm(projectForm)
            }
          } else {
            setSuggestions(null)
            setSelectedSuggestions([])
            setForm(projectForm)
          }
        } catch (error) {
          setSuggestions(null)
          setSelectedSuggestions([])
          setForm(projectForm)
          setToast({
            open: true,
            message: error.message || 'Không thể khôi phục kết quả gợi ý đã lưu.',
            severity: 'warning',
          })
        }
      } else {
        setProject(null)
        setForm(emptyForm())
        setSuggestions(null)
        setSelectedSuggestions([])
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

  const updateComponent = (clientKey, key, value) => {
    const updatedItem = form.components.find((item) => item.clientKey === clientKey)
    updateForm(
      'components',
      form.components.map((item) => item.clientKey === clientKey ? { ...item, [key]: value } : item)
    )
    if (updatedItem) {
      const nextSelected = selectedSuggestions.map((selection) =>
        selection.type === 'component' && selection.componentId === updatedItem.componentId
          ? { ...selection, [key]: value }
          : selection
      )
      if (nextSelected.some((selection, index) => selection !== selectedSuggestions[index])) {
        setSelectedSuggestions(nextSelected)
        writeSuggestionCache(suggestions, nextSelected)
      }
    }
  }

  const removeComponent = (clientKey) => {
    const removedItem = form.components.find((item) => item.clientKey === clientKey)
    updateForm('components', form.components.filter((item) => item.clientKey !== clientKey))
    if (removedItem) {
      const nextSelected = selectedSuggestions.filter(
        (selection) => selection.type !== 'component' || selection.componentId !== removedItem.componentId
      )
      setSelectedSuggestions(nextSelected)
      writeSuggestionCache(suggestions, nextSelected)
    }
  }

  const updateSelfSuppliedItem = (clientKey, key, value) => {
    const updatedItem = form.selfSuppliedItems.find((item) => item.clientKey === clientKey)
    updateForm(
      'selfSuppliedItems',
      form.selfSuppliedItems.map((item) => item.clientKey === clientKey ? { ...item, [key]: value } : item)
    )
    if (updatedItem) {
      const itemName = updatedItem.itemName.trim().toLocaleLowerCase()
      const nextSelected = selectedSuggestions.map((selection) =>
        selection.type === 'self' && selection.itemName.trim().toLocaleLowerCase() === itemName
          ? { ...selection, [key]: value }
          : selection
      )
      if (nextSelected.some((selection, index) => selection !== selectedSuggestions[index])) {
        setSelectedSuggestions(nextSelected)
        writeSuggestionCache(suggestions, nextSelected)
      }
    }
  }

  const removeSelfSuppliedItem = (clientKey) => {
    const removedItem = form.selfSuppliedItems.find((item) => item.clientKey === clientKey)
    updateForm('selfSuppliedItems', form.selfSuppliedItems.filter((item) => item.clientKey !== clientKey))
    if (removedItem) {
      const nextSelected = selectedSuggestions.filter(
        (selection) =>
          selection.type !== 'self' ||
          selection.itemName.trim().toLocaleLowerCase() !== removedItem.itemName.trim().toLocaleLowerCase()
      )
      setSelectedSuggestions(nextSelected)
      writeSuggestionCache(suggestions, nextSelected)
    }
  }

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
      const result = await projectService.suggestComponents(form.description.trim())
      setSuggestions(result)
      setSelectedSuggestions([])
      writeSuggestionCache(result, [])
    } catch (error) {
      showToast(error.message || 'Không thể lấy gợi ý linh kiện.', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestedComponent = (suggested) => {
    const existing = form.components.find((item) => item.componentId === suggested.componentId)
    const quantity = existing
      ? Number(existing.quantity) + Number(suggested.quantity || 1)
      : Number(suggested.quantity) || 1
    if (existing) {
      updateComponent(existing.clientKey, 'quantity', quantity)
    } else {
      updateForm('components', [
        ...form.components,
        {
          componentId: suggested.componentId,
          quantity,
          note: suggested.reason || '',
          clientKey: nextRowKey(`suggest-${suggested.componentId}`),
        },
      ])
    }
    const nextSelected = [
      ...selectedSuggestions.filter(
        (selection) => selection.type !== 'component' || selection.componentId !== suggested.componentId
      ),
      { type: 'component', componentId: suggested.componentId, quantity, note: existing?.note || suggested.reason || '' },
    ]
    setSelectedSuggestions(nextSelected)
    writeSuggestionCache(suggestions, nextSelected)
  }

  const addSuggestedSelfItem = (suggested) => {
    const quantity = Number(suggested.quantity) || 1
    const note = suggested.reason || ''
    updateForm('selfSuppliedItems', [
      ...form.selfSuppliedItems,
      {
        itemName: suggested.itemName,
        quantity,
        note,
        clientKey: nextRowKey('suggest-self'),
      },
    ])
    const nextSelected = [
      ...selectedSuggestions.filter(
        (selection) =>
          selection.type !== 'self' ||
          selection.itemName.trim().toLocaleLowerCase() !== suggested.itemName.trim().toLocaleLowerCase()
      ),
      { type: 'self', itemName: suggested.itemName, quantity, note },
    ]
    setSelectedSuggestions(nextSelected)
    writeSuggestionCache(suggestions, nextSelected)
  }

  const addComponent = () => {
    setNewItemDraft({ componentId: '', itemName: '', quantity: 1, note: '' })
    setAddItemDialogType('component')
  }

  const addSelfSuppliedItem = () => {
    setNewItemDraft({ componentId: '', itemName: '', quantity: 1, note: '' })
    setAddItemDialogType('self')
  }

  const confirmAddItem = () => {
    const quantity = Number(newItemDraft.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      showToast('Vui lòng nhập số lượng nguyên lớn hơn 0.', 'warning')
      return
    }
    if (addItemDialogType === 'component') {
      if (!newItemDraft.componentId) {
        showToast('Vui lòng chọn loại linh kiện.', 'warning')
        return
      }
      updateForm('components', [
        ...form.components,
        {
          componentId: newItemDraft.componentId,
          quantity,
          note: newItemDraft.note.trim(),
          clientKey: nextRowKey('component'),
        },
      ])
    } else if (addItemDialogType === 'self') {
      if (!newItemDraft.itemName.trim()) {
        showToast('Vui lòng nhập tên món tự mua.', 'warning')
        return
      }
      updateForm('selfSuppliedItems', [
        ...form.selfSuppliedItems,
        {
          itemName: newItemDraft.itemName.trim(),
          quantity,
          note: newItemDraft.note.trim(),
          clientKey: nextRowKey('self'),
        },
      ])
    }
    setAddItemDialogType(null)
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

  const selectedComponentIds = new Set(form.components.map((item) => item.componentId))
  const selectedSelfItemNames = new Set(
    form.selfSuppliedItems.map((item) => item.itemName.trim().toLocaleLowerCase())
  )
  const availableBorrowableSuggestions = (suggestions?.borrowable || []).filter(
    (item) => !selectedComponentIds.has(item.componentId)
  )
  const availableSelfSuppliedSuggestions = (suggestions?.selfSupplied || []).filter(
    (item) => !selectedSelfItemNames.has(item.itemName.trim().toLocaleLowerCase())
  )
  const editingItem = editingChip?.type === 'component'
    ? form.components.find((item) => item.clientKey === editingChip.clientKey)
    : editingChip?.type === 'self'
      ? form.selfSuppliedItems.find((item) => item.clientKey === editingChip.clientKey)
      : null

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
                      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25, mb: 1.25 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Linh kiện mượn kho</Typography>
                        <Typography variant="caption" color="text.secondary">
                          · Chọn loại linh kiện và số lượng; không chọn serial.
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          · Double-click vào linh kiện để chỉnh sửa hoặc thêm ghi chú.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        {form.components.map((item) => (
                          <Tooltip
                            key={item.clientKey}
                            title={item.note || 'Double-click để chỉnh sửa số lượng hoặc ghi chú.'}
                          >
                            <Chip
                              label={<QuantityLabel name={getComponentName(item.componentId) || 'Linh kiện'} quantity={item.quantity} />}
                              onClick={canEdit ? () => setEditingChip({ type: 'component', clientKey: item.clientKey }) : undefined}
                              onDoubleClick={canEdit ? () => setEditingChip({ type: 'component', clientKey: item.clientKey }) : undefined}
                              onDelete={canEdit ? () => removeComponent(item.clientKey) : undefined}
                              disabled={!canEdit}
                              sx={{ ...selectedChipStyles, width: 'fit-content', cursor: canEdit ? 'pointer' : 'default' }}
                            />
                          </Tooltip>
                        ))}
                        {form.components.length === 0 && (
                          <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', py: 0.25 }}>
                            Chưa thêm linh kiện mượn kho.
                          </Alert>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={addComponent}
                          disabled={!canEdit}
                          sx={{
                            minHeight: 36,
                            px: 1.25,
                            borderStyle: 'dashed',
                            borderColor: '#93c5fd',
                            color: '#1d4ed8',
                            bgcolor: '#fff',
                            textTransform: 'none',
                            fontWeight: 700,
                            '&:hover': { borderStyle: 'dashed', borderColor: '#2563eb', bgcolor: '#eff6ff' },
                          }}
                        >
                          Thêm loại
                        </Button>
                      </Box>
                    </Box>

                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25, mb: 1.25 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Món tự mua</Typography>
                        <Typography variant="caption" color="text.secondary">
                          · Vật tư nhóm tự chuẩn bị, không mượn từ kho.
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          · Double-click vào món để chỉnh sửa hoặc thêm ghi chú.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        {form.selfSuppliedItems.map((item) => (
                          <Tooltip
                            key={item.clientKey}
                            title={item.note || 'Double-click để chỉnh sửa số lượng hoặc ghi chú.'}
                          >
                            <Chip
                              label={<QuantityLabel name={item.itemName || 'Món tự mua'} quantity={item.quantity} />}
                              onClick={canEdit ? () => setEditingChip({ type: 'self', clientKey: item.clientKey }) : undefined}
                              onDoubleClick={canEdit ? () => setEditingChip({ type: 'self', clientKey: item.clientKey }) : undefined}
                              onDelete={canEdit ? () => removeSelfSuppliedItem(item.clientKey) : undefined}
                              disabled={!canEdit}
                              sx={{ ...selectedChipStyles, width: 'fit-content', cursor: canEdit ? 'pointer' : 'default' }}
                            />
                          </Tooltip>
                        ))}
                        {form.selfSuppliedItems.length === 0 && (
                          <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', py: 0.25 }}>
                            Chưa thêm món tự mua.
                          </Alert>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={addSelfSuppliedItem}
                          disabled={!canEdit}
                          sx={{
                            minHeight: 36,
                            px: 1.25,
                            borderStyle: 'dashed',
                            borderColor: '#93c5fd',
                            color: '#1d4ed8',
                            bgcolor: '#fff',
                            textTransform: 'none',
                            fontWeight: 700,
                            '&:hover': { borderStyle: 'dashed', borderColor: '#2563eb', bgcolor: '#eff6ff' },
                          }}
                        >
                          Thêm món
                        </Button>
                      </Box>
                    </Box>

                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                        <Button
                          variant="outlined"
                          startIcon={suggesting ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                          disabled={!canEdit || suggesting}
                          onClick={requestSuggestions}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          {suggesting ? 'Đang lấy gợi ý...' : 'AI gợi ý linh kiện'}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          Gợi ý được lưu tạm trên thiết bị; hãy thêm hoặc bỏ mục rồi bấm Lưu. Tối đa 10 lượt mỗi giờ.
                        </Typography>
                      </Box>
                      {suggestions && (
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Kết quả gợi ý</Typography>
                          {suggestions.hint && (
                            <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', maxWidth: '100%' }}>
                              {suggestions.hint}
                            </Alert>
                          )}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {availableBorrowableSuggestions.map((suggestion) => (
                              <Tooltip key={`borrow-${suggestion.componentId}`} title={suggestion.reason || 'Nhấn để thêm vào danh sách mượn kho.'}>
                                <Chip
                                  label={<QuantityLabel name={suggestion.componentName} quantity={Number(suggestion.quantity) || 1} />}
                                  clickable={canEdit}
                                  disabled={!canEdit}
                                  onClick={() => addSuggestedComponent(suggestion)}
                                  sx={{
                                    ...suggestedChipStyles,
                                    width: 'fit-content',
                                    borderColor: '#86efac',
                                    bgcolor: '#f0fdf4',
                                    color: '#166534',
                                    '&:hover': { borderColor: '#16a34a', bgcolor: '#ecfdf5', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.15)' },
                                    '&:active': { bgcolor: '#dcfce7' },
                                  }}
                                />
                              </Tooltip>
                            ))}
                            {(suggestions.notEnoughStock || []).map((suggestion) => (
                              <Tooltip
                                key={`stock-${suggestion.componentId}`}
                                title={`Cần ${suggestion.quantity}, hiện có ${suggestion.available}.${suggestion.reason ? ` ${suggestion.reason}` : ''}`}
                              >
                                <Chip
                                  label={<QuantityLabel name={suggestion.componentName} quantity={Number(suggestion.quantity) || 1} />}
                                  disabled
                                  sx={{
                                    ...suggestedChipStyles,
                                    width: 'fit-content',
                                    borderColor: '#fcd34d',
                                    bgcolor: '#fffbeb',
                                    color: '#92400e',
                                    cursor: 'not-allowed',
                                  }}
                                />
                              </Tooltip>
                            ))}
                            {availableSelfSuppliedSuggestions.map((suggestion, index) => (
                              <Tooltip key={`self-${suggestion.itemName}-${index}`} title={suggestion.reason || 'Nhấn để thêm vào danh sách tự mua.'}>
                                <Chip
                                  label={<QuantityLabel name={suggestion.itemName} quantity={Number(suggestion.quantity) || 1} />}
                                  clickable={canEdit}
                                  disabled={!canEdit}
                                  onClick={() => addSuggestedSelfItem(suggestion)}
                                  sx={{
                                    ...suggestedChipStyles,
                                    width: 'fit-content',
                                    borderColor: '#93c5fd',
                                    bgcolor: '#eff6ff',
                                    color: '#1e40af',
                                  }}
                                />
                              </Tooltip>
                            ))}
                          </Box>
                          {!availableBorrowableSuggestions.length &&
                            !(suggestions.notEnoughStock || []).length &&
                            !availableSelfSuppliedSuggestions.length && (
                              <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content' }}>
                                {(suggestions.borrowable?.length || suggestions.selfSupplied?.length)
                                  ? 'Đã thêm tất cả gợi ý vào danh sách.'
                                  : 'AI chưa có gợi ý phù hợp cho mô tả hiện tại.'}
                              </Alert>
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

      <Dialog
        open={Boolean(addItemDialogType)}
        onClose={() => setAddItemDialogType(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {addItemDialogType === 'component' ? 'Thêm linh kiện mượn kho' : 'Thêm món tự mua'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {addItemDialogType === 'component' ? (
              <TextField
                select
                label="Loại linh kiện"
                value={newItemDraft.componentId}
                onChange={(event) => setNewItemDraft((current) => ({ ...current, componentId: event.target.value }))}
                disabled={!canEdit || saving}
                required
                fullWidth
              >
                <MenuItem value="">Chọn linh kiện</MenuItem>
                {componentTypes.map((component) => (
                  <MenuItem key={component.componentId} value={component.componentId}>
                    {component.componentName} ({component.componentCode})
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Tên món"
                value={newItemDraft.itemName}
                onChange={(event) => setNewItemDraft((current) => ({ ...current, itemName: event.target.value }))}
                disabled={!canEdit || saving}
                required
                fullWidth
                autoFocus
              />
            )}
            <TextField
              label="Số lượng"
              type="number"
              inputProps={{ min: 1, step: 1 }}
              value={newItemDraft.quantity}
              onChange={(event) => setNewItemDraft((current) => ({ ...current, quantity: event.target.value }))}
              disabled={!canEdit || saving}
              required
              fullWidth
            />
            <TextField
              label="Ghi chú"
              value={newItemDraft.note}
              onChange={(event) => setNewItemDraft((current) => ({ ...current, note: event.target.value }))}
              disabled={!canEdit || saving}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddItemDialogType(null)} disabled={saving}>Hủy</Button>
          <Button variant="contained" onClick={confirmAddItem} disabled={!canEdit || saving}>
            Thêm vào danh sách
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingChip(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Chỉnh sửa {editingChip?.type === 'component' ? 'linh kiện mượn kho' : 'món tự mua'}
        </DialogTitle>
        {editingItem && (
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {editingChip.type === 'component'
                  ? getComponentName(editingItem.componentId)
                  : editingItem.itemName}
              </Typography>
              <TextField
                label="Số lượng"
                type="number"
                inputProps={{ min: 1 }}
                value={editingItem.quantity}
                onChange={(event) => {
                  if (editingChip.type === 'component') {
                    updateComponent(editingItem.clientKey, 'quantity', event.target.value)
                  } else {
                    updateSelfSuppliedItem(editingItem.clientKey, 'quantity', event.target.value)
                  }
                }}
                disabled={!canEdit || saving}
                fullWidth
                autoFocus
              />
              <TextField
                label="Ghi chú"
                value={editingItem.note}
                onChange={(event) => {
                  if (editingChip.type === 'component') {
                    updateComponent(editingItem.clientKey, 'note', event.target.value)
                  } else {
                    updateSelfSuppliedItem(editingItem.clientKey, 'note', event.target.value)
                  }
                }}
                disabled={!canEdit || saving}
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingChip(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

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
