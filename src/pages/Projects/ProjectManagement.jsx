import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Groups as GroupsIcon,
  Save as SaveIcon,
  School as SchoolIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
import {
  Autocomplete,
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
import { borrowService } from '../../services/borrowService'
import { inventoryService } from '../../services/inventoryService'
import { projectService } from '../../services/projectService'
import { teamService } from '../../services/teamService'
import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta } from '../Borrowing/borrowHelpers'
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

function getProjectFormSnapshot(form) {
  return JSON.stringify(toProjectPayload(form))
}

function getSuggestionNote(suggestion) {
  return suggestion.note || suggestion.reason || suggestion.description || suggestion.purpose || suggestion.role || ''
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

function localDateValue() {
  return getVietnamDateInputValue()
}

function ProjectStatus({ status }) {
  const styles = {
    Draft: { bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', dotColor: '#64748b' },
    Submitted: { bgcolor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', dotColor: '#f59e0b' },
    Rejected: { bgcolor: '#fff1f2', color: '#be123c', borderColor: '#fda4af', dotColor: '#e11d48' },
    Approved: { bgcolor: '#ecfdf5', color: '#047857', borderColor: '#6ee7b7', dotColor: '#10b981' },
    Cancelled: { bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', dotColor: '#64748b' },
  }
  const style = styles[status] || styles.Draft
  return (
    <Chip
      icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.dotColor }} />}
      label={formatStatus(status)}
      sx={{
        height: 32,
        px: 0.5,
        borderRadius: '999px',
        border: `1px solid ${style.borderColor}`,
        bgcolor: style.bgcolor,
        color: style.color,
        fontSize: 13,
        fontWeight: 700,
        '& .MuiChip-label': { px: 1.25 },
        '& .MuiChip-icon': { ml: 1, mr: -0.5 },
      }}
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
          color: '#64748b',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        ×{quantity}
      </Box>
    </Box>
  )
}

const selectedChipStyles = {
  height: 'auto',
  minHeight: 36,
  maxWidth: '100%',
  borderRadius: 2,
  border: 0,
  bgcolor: '#f1f5f9',
  boxShadow: 'none',
  cursor: 'pointer',
  '& .MuiChip-label': { display: 'block', px: 1.1, py: 0.55, minWidth: 0 },
  '& .MuiChip-deleteIcon': {
    color: '#94a3b8',
    mr: 0.5,
    bgcolor: 'transparent',
    '&:hover': { color: '#ef4444', bgcolor: 'transparent' },
  },
  '&:hover': { border: 0, bgcolor: '#e8eef5', boxShadow: 'none' },
  '&:active': { bgcolor: '#e2e8f0' },
}

function SuggestionCard({ suggestion, name, onSelect, disabled = false }) {
  const note = getSuggestionNote(suggestion)
  const quantity = Number(suggestion.quantity) || 1

  return (
    <Box
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onSelect()
        }
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.25,
        width: 'fit-content',
        maxWidth: { xs: '100%', sm: 340 },
        minWidth: 180,
        px: 1.25,
        py: 0.85,
        border: 0,
        borderRadius: 2,
        bgcolor: disabled ? '#fffbeb' : '#e8f5f8',
        color: disabled ? '#92400e' : '#155e75',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        '&:hover': disabled ? undefined : { bgcolor: '#d9edf1' },
        '&:focus-visible': disabled ? undefined : { outline: '2px solid #0e7490', outlineOffset: 2 },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
        {name} ×{quantity}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: disabled ? '#a16207' : '#64748b',
          fontSize: 11,
          lineHeight: 1.35,
          whiteSpace: 'normal',
        }}
      >
        {note || 'AI chưa cung cấp ghi chú.'}
      </Typography>
      {disabled && suggestion.available != null && (
        <Typography variant="caption" sx={{ color: '#92400e', fontSize: 10, lineHeight: 1.3 }}>
          Tồn kho hiện có: {suggestion.available}
        </Typography>
      )}
    </Box>
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
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(null)
  const [componentTypes, setComponentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState([])
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [pickupDate, setPickupDate] = useState(() => localDateValue())
  const [inlineDraft, setInlineDraft] = useState(null)
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
  const inlineDraftRef = useRef(null)
  const inlineDraftFocusedRef = useRef(false)
  const inlineDraftRootRef = useRef(null)
  const inlineNameInputRef = useRef(null)
  const inlineQuantityInputRef = useRef(null)

  useEffect(() => {
    try {
      const staleKeys = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (key?.startsWith('smartlabkit:ai-suggestion-usage:')) staleKeys.push(key)
      }
      staleKeys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Không thể dọn bộ đếm lượt AI cũ:', error)
    }
  }, [])

  useEffect(() => {
    inlineDraftRef.current = inlineDraft
    if (!inlineDraft) return undefined
    if (inlineDraftFocusedRef.current) return undefined
    inlineDraftFocusedRef.current = true
    const frameId = window.requestAnimationFrame(() => inlineNameInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [inlineDraft])

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
  const hasUnsavedChanges = !project ||
    Boolean(inlineDraft) ||
    getProjectFormSnapshot(form) !== savedFormSnapshot

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
    setPickupDate(localDateValue())
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
    setSavedFormSnapshot(null)
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
        setSavedFormSnapshot(getProjectFormSnapshot(projectForm))
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
        setSavedFormSnapshot(null)
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
      const savedForm = normalizeProjectForm(saved)
      setSavedFormSnapshot(getProjectFormSnapshot(savedForm))
      setProject(saved)
      setForm(savedForm)
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
    const note = getSuggestionNote(suggested)
    if (existing) {
      updateComponent(existing.clientKey, 'quantity', quantity)
    } else {
      updateForm('components', [
        ...form.components,
        {
          componentId: suggested.componentId,
          quantity,
          note,
          clientKey: nextRowKey(`suggest-${suggested.componentId}`),
        },
      ])
    }
    const nextSelected = [
      ...selectedSuggestions.filter(
        (selection) => selection.type !== 'component' || selection.componentId !== suggested.componentId
      ),
      { type: 'component', componentId: suggested.componentId, quantity, note: existing?.note || note },
    ]
    setSelectedSuggestions(nextSelected)
    writeSuggestionCache(suggestions, nextSelected)
  }

  const addSuggestedSelfItem = (suggested) => {
    const quantity = Number(suggested.quantity) || 1
    const note = getSuggestionNote(suggested)
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

  const addAllSuggestedComponents = () => {
    if (availableBorrowableSuggestions.length < 2) return

    const nextComponents = [...form.components]
    const nextSelected = [...selectedSuggestions]
    availableBorrowableSuggestions.forEach((suggested) => {
      const quantity = Number(suggested.quantity) || 1
      const suggestedNote = getSuggestionNote(suggested)
      const existingIndex = nextComponents.findIndex((item) => item.componentId === suggested.componentId)
      let totalQuantity = quantity
      let note = suggestedNote
      if (existingIndex >= 0) {
        const existing = nextComponents[existingIndex]
        totalQuantity += Number(existing.quantity) || 0
        note = existing.note || suggestedNote
        nextComponents[existingIndex] = { ...existing, quantity: totalQuantity, note }
      } else {
        nextComponents.push({
          componentId: suggested.componentId,
          quantity,
          note,
          clientKey: nextRowKey(`suggest-${suggested.componentId}`),
        })
      }

      const selectedIndex = nextSelected.findIndex(
        (selection) => selection.type === 'component' && selection.componentId === suggested.componentId
      )
      const selectedValue = { type: 'component', componentId: suggested.componentId, quantity: totalQuantity, note }
      if (selectedIndex >= 0) nextSelected[selectedIndex] = selectedValue
      else nextSelected.push(selectedValue)
    })

    updateForm('components', nextComponents)
    setSelectedSuggestions(nextSelected)
    writeSuggestionCache(suggestions, nextSelected)
  }

  const addAllSuggestedSelfItems = () => {
    if (availableSelfSuppliedSuggestions.length < 2) return

    const nextItems = [...form.selfSuppliedItems]
    const nextSelected = [...selectedSuggestions]
    availableSelfSuppliedSuggestions.forEach((suggested) => {
      const quantity = Number(suggested.quantity) || 1
      const note = getSuggestionNote(suggested)
      const normalizedName = suggested.itemName.trim().toLocaleLowerCase()
      const existingIndex = nextItems.findIndex(
        (item) => item.itemName.trim().toLocaleLowerCase() === normalizedName
      )
      let totalQuantity = quantity
      let selectedNote = note
      if (existingIndex >= 0) {
        const existing = nextItems[existingIndex]
        totalQuantity += Number(existing.quantity) || 0
        selectedNote = existing.note || note
        nextItems[existingIndex] = { ...existing, quantity: totalQuantity, note: selectedNote }
      } else {
        nextItems.push({
          itemName: suggested.itemName,
          quantity,
          note,
          clientKey: nextRowKey('suggest-self'),
        })
      }

      const selectedIndex = nextSelected.findIndex(
        (selection) =>
          selection.type === 'self' &&
          selection.itemName.trim().toLocaleLowerCase() === normalizedName
      )
      const selectedValue = { type: 'self', itemName: suggested.itemName, quantity: totalQuantity, note: selectedNote }
      if (selectedIndex >= 0) nextSelected[selectedIndex] = selectedValue
      else nextSelected.push(selectedValue)
    })

    updateForm('selfSuppliedItems', nextItems)
    setSelectedSuggestions(nextSelected)
    writeSuggestionCache(suggestions, nextSelected)
  }

  const updateInlineDraft = (changes) => {
    const current = inlineDraftRef.current
    if (!current) return
    const next = { ...current, ...changes }
    inlineDraftRef.current = next
    setInlineDraft(next)
  }

  const cancelInlineDraft = () => {
    inlineDraftRef.current = null
    inlineDraftFocusedRef.current = false
    setInlineDraft(null)
  }

  const startInlineCreation = (type) => {
    if (inlineDraftRef.current) return
    const draft = {
      mode: 'create',
      type,
      componentId: '',
      searchText: '',
      itemName: '',
      quantity: 1,
      note: '',
    }
    inlineDraftRef.current = draft
    inlineDraftFocusedRef.current = false
    setInlineDraft(draft)
  }

  const startInlineEdit = (type, item) => {
    if (!canEdit || inlineDraftRef.current) return
    const componentName = type === 'component' ? getComponentName(item.componentId) : ''
    const draft = {
      mode: 'edit',
      type,
      clientKey: item.clientKey,
      componentId: item.componentId || '',
      searchText: componentName,
      itemName: item.itemName || '',
      quantity: item.quantity || 1,
      note: item.note || '',
    }
    inlineDraftRef.current = draft
    inlineDraftFocusedRef.current = false
    setInlineDraft(draft)
  }

  const commitInlineDraft = (draft = inlineDraftRef.current) => {
    if (!draft) return
    const name = draft.type === 'component'
      ? componentTypes.find((component) => component.componentId === draft.componentId)?.componentName
      : draft.itemName.trim()
    if (!name) {
      cancelInlineDraft()
      return
    }
    const quantity = Number(draft.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      showToast('Vui lòng nhập số lượng nguyên lớn hơn 0.', 'warning')
      window.requestAnimationFrame(() => inlineQuantityInputRef.current?.focus())
      return
    }
    if (draft.type === 'component') {
      if (draft.mode === 'edit') {
        const oldItem = form.components.find((item) => item.clientKey === draft.clientKey)
        updateForm('components', form.components.map((item) => (
          item.clientKey === draft.clientKey
            ? { ...item, componentId: draft.componentId, quantity, note: draft.note }
            : item
        )))
        if (oldItem && oldItem.componentId !== draft.componentId) {
          const nextSelected = selectedSuggestions.filter(
            (selection) => selection.type !== 'component' || selection.componentId !== oldItem.componentId
          )
          setSelectedSuggestions(nextSelected)
          writeSuggestionCache(suggestions, nextSelected)
        } else if (oldItem) {
          const nextSelected = selectedSuggestions.map((selection) => (
            selection.type === 'component' && selection.componentId === oldItem.componentId
              ? { ...selection, quantity, note: draft.note }
              : selection
          ))
          setSelectedSuggestions(nextSelected)
          writeSuggestionCache(suggestions, nextSelected)
        }
      } else {
        updateForm('components', [
          ...form.components,
          {
            componentId: draft.componentId,
            quantity,
            note: draft.note || '',
            clientKey: nextRowKey('component'),
          },
        ])
      }
    } else {
      if (draft.mode === 'edit') {
        const oldItem = form.selfSuppliedItems.find((item) => item.clientKey === draft.clientKey)
        updateForm('selfSuppliedItems', form.selfSuppliedItems.map((item) => (
          item.clientKey === draft.clientKey
            ? { ...item, itemName: name, quantity, note: draft.note }
            : item
        )))
        if (oldItem && oldItem.itemName.trim().toLocaleLowerCase() !== name.trim().toLocaleLowerCase()) {
          const nextSelected = selectedSuggestions.filter(
            (selection) =>
              selection.type !== 'self' ||
              selection.itemName.trim().toLocaleLowerCase() !== oldItem.itemName.trim().toLocaleLowerCase()
          )
          setSelectedSuggestions(nextSelected)
          writeSuggestionCache(suggestions, nextSelected)
        } else if (oldItem) {
          const normalizedName = oldItem.itemName.trim().toLocaleLowerCase()
          const nextSelected = selectedSuggestions.map((selection) => (
            selection.type === 'self' && selection.itemName.trim().toLocaleLowerCase() === normalizedName
              ? { ...selection, quantity, note: draft.note }
              : selection
          ))
          setSelectedSuggestions(nextSelected)
          writeSuggestionCache(suggestions, nextSelected)
        }
      } else {
        updateForm('selfSuppliedItems', [
          ...form.selfSuppliedItems,
          {
            itemName: name,
            quantity,
            note: draft.note || '',
            clientKey: nextRowKey('self'),
          },
        ])
      }
    }
    cancelInlineDraft()
  }

  const handleInlineKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelInlineDraft()
      return
    }
    if (event.key !== 'Enter') return
    if (event.defaultPrevented) return
    const current = inlineDraftRef.current
    if (!current) return
    const isComponentCombobox = current.type === 'component' && event.target.getAttribute('role') === 'combobox'
    if (isComponentCombobox && !current.componentId) return
    event.preventDefault()
    commitInlineDraft(current)
  }

  const handleInlineBlur = (event) => {
    if (event.relatedTarget && inlineDraftRootRef.current?.contains(event.relatedTarget)) return
    if (event.relatedTarget) {
      commitInlineDraft()
      return
    }
    window.setTimeout(() => {
      const current = inlineDraftRef.current
      if (!current) return
      if (inlineDraftRootRef.current?.contains(document.activeElement)) return
      commitInlineDraft(current)
    }, 0)
  }

  const addComponent = () => startInlineCreation('component')
  const addSelfSuppliedItem = () => startInlineCreation('self')

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
      const submittedProject = await projectService.submitProject(
        updatedProject.projectId,
        requiresBorrow ? pickupDate : null
      )
      let refreshedProject
      let refreshError
      try {
        refreshedProject = await projectService.getProject(updatedProject.projectId)
      } catch (error) {
        refreshError = error
      }
      const fallbackProject = {
        ...(submittedProject?.projectId ? submittedProject : updatedProject),
        status: 'Submitted',
      }
      setProject(refreshedProject || fallbackProject)
      setSubmitDialogOpen(false)
      showToast(
        refreshError
          ? `Đã gửi project thành công nhưng không thể tải lại trạng thái: ${refreshError.message}`
          : 'Đã gửi project chờ giảng viên duyệt.',
        refreshError ? 'warning' : 'success'
      )
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

  const withdrawSupplementaryBorrow = async () => {
    if (!project?.projectId) return
    setWithdrawing(true)
    try {
      const result = await borrowService.withdrawSupplementaryBorrow(project.projectId)
      setProject(result)
      showToast('Đã rút lại đơn mượn thêm đang chờ duyệt.')
    } catch (error) {
      showToast(error.message || 'Không thể rút lại đơn mượn thêm.', 'error')
    } finally {
      setWithdrawing(false)
    }
  }

  const getComponentName = (componentId) =>
    componentTypes.find((component) => component.componentId === componentId)?.componentName ||
    project?.components?.find((component) => component.componentId === componentId)?.componentName ||
    ''

  const inlineInputText = inlineDraft?.type === 'component' ? inlineDraft.searchText : inlineDraft?.itemName
  const inlineInputWidth = Math.min(220, Math.max(120, (inlineInputText?.length || 0) * 8 + 8))
  const inlineDraftView = inlineDraft ? (
    <Box
      ref={inlineDraftRootRef}
      onBlurCapture={handleInlineBlur}
      onKeyDown={handleInlineKeyDown}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 36,
        height: 36,
        boxSizing: 'border-box',
        px: 1.1,
        border: 0,
        borderRadius: 2,
        bgcolor: '#f1f5f9',
        boxShadow: 'none',
        '&:focus-within': { boxShadow: '0 0 0 1px #cbd5e1' },
      }}
    >
      {inlineDraft.type === 'component' ? (
        <Autocomplete
          options={componentTypes}
          value={componentTypes.find((component) => component.componentId === inlineDraft.componentId) || null}
          inputValue={inlineDraft.searchText}
          onChange={(_, component) => {
            updateInlineDraft({
              componentId: component?.componentId || '',
              searchText: component?.componentName || '',
            })
          }}
          onInputChange={(_, searchText, reason) => {
            updateInlineDraft({
              searchText,
              ...(reason === 'input' || reason === 'clear' ? { componentId: '' } : {}),
            })
          }}
          getOptionLabel={(component) => component?.componentName || ''}
          isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
          openOnFocus
          autoHighlight
          disablePortal
          disableClearable
          forcePopupIcon={false}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                minWidth: { xs: 220, sm: 240 },
                maxWidth: 'calc(100vw - 32px)',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
              },
            },
            listbox: {
              sx: {
                py: 0.5,
                '& .MuiAutocomplete-option': { minHeight: 36, fontSize: '0.875rem', py: 0.75 },
              },
            },
          }}
          sx={{
            width: inlineInputWidth,
            '& .MuiInput-root:before, & .MuiInput-root:after': { display: 'none' },
            '& .MuiInputBase-root': { p: 0, fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' },
            '& .MuiInputBase-input': { p: '0 !important', lineHeight: 1.43 },
            '& input::placeholder': { color: '#94a3b8', opacity: 1, fontWeight: 400 },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={inlineNameInputRef}
              variant="standard"
              size="small"
              placeholder="Tìm linh kiện..."
              InputProps={{ ...params.InputProps, disableUnderline: true }}
              inputProps={{ ...params.inputProps, 'aria-label': 'Tìm linh kiện từ kho' }}
            />
          )}
        />
      ) : (
        <TextField
          inputRef={inlineNameInputRef}
          value={inlineDraft.itemName}
          onChange={(event) => updateInlineDraft({ itemName: event.target.value })}
          variant="standard"
          size="small"
          placeholder="Tên món tự mua"
          InputProps={{ disableUnderline: true }}
          inputProps={{ 'aria-label': 'Tên món tự mua' }}
          sx={{
            width: inlineInputWidth,
            '& .MuiInput-root:before, & .MuiInput-root:after': { display: 'none' },
            '& .MuiInputBase-root': { p: 0, fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' },
            '& .MuiInputBase-input': { p: '0 !important', lineHeight: 1.43 },
            '& input::placeholder': { color: '#94a3b8', opacity: 1, fontWeight: 400 },
          }}
        />
      )}
      <Typography component="span" sx={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>
        ×
      </Typography>
      <TextField
        inputRef={inlineQuantityInputRef}
        type="number"
        size="small"
        variant="standard"
        value={inlineDraft.quantity}
        onChange={(event) => updateInlineDraft({ quantity: event.target.value })}
        InputProps={{ disableUnderline: true }}
        inputProps={{ min: 1, step: 1, 'aria-label': 'Số lượng' }}
        sx={{
          width: 34,
          '& .MuiInput-root:before, & .MuiInput-root:after': { display: 'none' },
          '& .MuiInputBase-root': { p: 0, fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' },
          '& .MuiInputBase-input': {
            p: '0 !important',
            textAlign: 'center',
            lineHeight: 1.43,
            appearance: 'textfield',
            MozAppearance: 'textfield',
            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none', margin: 0 },
          },
        }}
      />
    </Box>
  ) : null

  const selectedComponentIds = new Set(form.components.map((item) => item.componentId))
  const selectedSelfItemNames = new Set(
    form.selfSuppliedItems.map((item) => item.itemName.trim().toLocaleLowerCase())
  )
  const availableBorrowableSuggestions = (suggestions?.borrowable || []).filter(
    (item) => !selectedComponentIds.has(item.componentId)
  )
  const unavailableBorrowableSuggestions = (suggestions?.notEnoughStock || []).filter(
    (item) => !selectedComponentIds.has(item.componentId)
  )
  const warehouseSuggestions = [
    ...availableBorrowableSuggestions,
    ...unavailableBorrowableSuggestions,
  ]
  const availableSelfSuppliedSuggestions = (suggestions?.selfSupplied || []).filter(
    (item) => !selectedSelfItemNames.has(item.itemName.trim().toLocaleLowerCase())
  )
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
                          {teamChoice.teamName}
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
                    {project ? 'Thông tin dự án' : 'Tạo project'}
                  </Typography>
                </Box>
                {project && <ProjectStatus status={project.status} />}
              </Box>

              <Stack spacing={2}>
                {canEdit ? (
                  <>
                    <TextField
                      label="Tên project"
                      value={form.title}
                      onChange={(event) => updateForm('title', event.target.value)}
                      disabled={saving}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Mô tả"
                      value={form.description}
                      onChange={(event) => updateForm('description', event.target.value)}
                      disabled={saving}
                      fullWidth
                      required
                      multiline
                      minRows={4}
                    />
                  </>
                ) : (
                  <>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '120px minmax(0, 1fr)' },
                        columnGap: 2,
                        rowGap: 1.5,
                        alignItems: 'start',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b' }}>
                        Tên project
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a' }}>
                        {form.title || '—'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b' }}>
                        Mô tả
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-line' }}
                      >
                        {form.description || '—'}
                      </Typography>
                    </Box>
                  </>
                )}

                {project && (
                  <>
                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Linh kiện mượn kho</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        {form.components.map((item) => (
                          inlineDraft?.mode === 'edit' &&
                          inlineDraft.type === 'component' &&
                          inlineDraft.clientKey === item.clientKey
                            ? <Fragment key={item.clientKey}>{inlineDraftView}</Fragment>
                            : (
                              <Tooltip
                                key={item.clientKey}
                                title={item.note || ''}
                              >
                                <Chip
                                  label={<QuantityLabel name={getComponentName(item.componentId) || 'Linh kiện'} quantity={item.quantity} />}
                                  deleteIcon={<CloseIcon sx={{ fontSize: '17px !important' }} />}
                                  onDoubleClick={canEdit ? () => startInlineEdit('component', item) : undefined}
                                  onDelete={canEdit ? () => removeComponent(item.clientKey) : undefined}
                                  sx={{ ...selectedChipStyles, width: 'fit-content', cursor: canEdit ? 'pointer' : 'default' }}
                                />
                              </Tooltip>
                            )
                        ))}
                        {form.components.length === 0 && (
                          <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', py: 0.25 }}>
                            Chưa thêm linh kiện mượn kho.
                          </Alert>
                        )}
                        {canEdit && inlineDraft?.mode === 'create' && inlineDraft.type === 'component' && inlineDraftView}
                        {canEdit && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={addComponent}
                            disabled={Boolean(inlineDraft)}
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
                            Thêm
                          </Button>
                        )}
                      </Box>
                    </Box>

                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Món tự mua</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        {form.selfSuppliedItems.map((item) => (
                          inlineDraft?.mode === 'edit' &&
                          inlineDraft.type === 'self' &&
                          inlineDraft.clientKey === item.clientKey
                            ? <Fragment key={item.clientKey}>{inlineDraftView}</Fragment>
                            : (
                              <Tooltip key={item.clientKey} title={item.note || ''}>
                                <Chip
                                  label={<QuantityLabel name={item.itemName || 'Món tự mua'} quantity={item.quantity} />}
                                  deleteIcon={<CloseIcon sx={{ fontSize: '17px !important' }} />}
                                  onDoubleClick={canEdit ? () => startInlineEdit('self', item) : undefined}
                                  onDelete={canEdit ? () => removeSelfSuppliedItem(item.clientKey) : undefined}
                                  sx={{ ...selectedChipStyles, width: 'fit-content', cursor: canEdit ? 'pointer' : 'default' }}
                                />
                              </Tooltip>
                            )
                        ))}
                        {form.selfSuppliedItems.length === 0 && (
                          <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', py: 0.25 }}>
                            Chưa thêm món tự mua.
                          </Alert>
                        )}
                        {canEdit && inlineDraft?.mode === 'create' && inlineDraft.type === 'self' && inlineDraftView}
                        {canEdit && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={addSelfSuppliedItem}
                            disabled={Boolean(inlineDraft)}
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
                            Thêm
                          </Button>
                        )}
                      </Box>
                    </Box>

                    {canEdit && (
                      <>
                        <Divider />
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                            <Button
                              variant="outlined"
                              startIcon={suggesting ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                              disabled={suggesting}
                              onClick={requestSuggestions}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {suggesting ? 'Đang lấy gợi ý...' : 'AI Gợi ý Linh kiện'}
                            </Button>
                            <Typography variant="caption" color="text.secondary">
                              Tối đa 10 lượt mỗi giờ.
                            </Typography>
                          </Box>
                          {suggestions && (warehouseSuggestions.length > 0 || availableSelfSuppliedSuggestions.length > 0) && (
                            <Stack spacing={1.5} sx={{ mt: 2 }}>
                              {suggestions.hint && (
                                <Alert severity="info" sx={{ display: 'inline-flex', width: 'fit-content', maxWidth: '100%' }}>
                                  {suggestions.hint}
                                </Alert>
                              )}
                              <Stack spacing={1}>
                                {warehouseSuggestions.length > 0 && (
                                  <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                        Gợi ý Linh kiện mượn kho
                                      </Typography>
                                      {availableBorrowableSuggestions.length >= 2 && (
                                        <Button
                                          size="small"
                                          onClick={addAllSuggestedComponents}
                                          sx={{
                                            minWidth: 0,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            color: '#2563eb',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            textTransform: 'none',
                                            '&:hover': { color: '#1d4ed8', bgcolor: '#eff6ff' },
                                          }}
                                        >
                                          + Chọn tất cả
                                        </Button>
                                      )}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {availableBorrowableSuggestions.map((suggestion) => (
                                        <SuggestionCard
                                          key={`borrow-${suggestion.componentId}`}
                                          suggestion={suggestion}
                                          name={suggestion.componentName}
                                          onSelect={() => addSuggestedComponent(suggestion)}
                                        />
                                      ))}
                                      {unavailableBorrowableSuggestions.map((suggestion) => (
                                        <SuggestionCard
                                          key={`stock-${suggestion.componentId}`}
                                          suggestion={suggestion}
                                          name={suggestion.componentName}
                                          disabled
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                                {availableSelfSuppliedSuggestions.length > 0 && (
                                  <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                        Gợi ý Món tự mua
                                      </Typography>
                                      {availableSelfSuppliedSuggestions.length >= 2 && (
                                        <Button
                                          size="small"
                                          onClick={addAllSuggestedSelfItems}
                                          sx={{
                                            minWidth: 0,
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            color: '#2563eb',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            textTransform: 'none',
                                            '&:hover': { color: '#1d4ed8', bgcolor: '#eff6ff' },
                                          }}
                                        >
                                          + Chọn tất cả
                                        </Button>
                                      )}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {availableSelfSuppliedSuggestions.map((suggestion, index) => (
                                        <SuggestionCard
                                          key={`self-${suggestion.itemName}-${index}`}
                                          suggestion={suggestion}
                                          name={suggestion.itemName}
                                          onSelect={() => addSuggestedSelfItem(suggestion)}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                              </Stack>
                            </Stack>
                          )}
                        </Box>
                      </>
                    )}
                  </>
                )}
              </Stack>

              {(canEdit || (isLeader && project?.status === 'Submitted')) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                  {canEdit && (
                    <>
                      <Button
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                        disabled={saving || !hasUnsavedChanges}
                        onClick={saveProject}
                        sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
                      >
                        {saving ? 'Đang lưu...' : project ? 'Lưu project' : 'Lưu'}
                      </Button>
                      {project && ['Draft', 'Rejected'].includes(project.status) && (
                        <Button
                          variant="outlined"
                          startIcon={<SendIcon />}
                          onClick={openSubmitDialog}
                          disabled={saving || submitting || loadingDeadline}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Gửi duyệt
                        </Button>
                      )}
                    </>
                  )}
                  {isLeader && project?.status === 'Submitted' && (
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
                </Box>
              )}
            </Paper>

            {project?.status === 'Approved' && (() => {
              const projectBorrows = Array.isArray(project.borrowRequests) ? project.borrowRequests : []
              const pendingSupplementary = projectBorrows.find((br) => br.status === 'Pending')
              const isFinalLocked = ['Pending', 'Accepted'].includes(project.finalStatus)
              return (
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: 2.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 1.5,
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        Đơn mượn của đề tài ({projectBorrows.length})
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Theo dõi các đơn mượn kho và gửi yêu cầu mượn thêm linh kiện phát sinh khi cần
                      </Typography>
                    </Box>

                    {isLeader && !isFinalLocked && !pendingSupplementary && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => navigate(`/borrow/supplementary/create?projectId=${project.projectId}`)}
                        sx={{
                          bgcolor: '#0058be',
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: 1.5,
                          boxShadow: 'none',
                          '&:hover': { bgcolor: '#0049a3' },
                        }}
                      >
                        Mượn thêm linh kiện
                      </Button>
                    )}
                  </Box>

                  {pendingSupplementary && (
                    <Alert
                      severity="warning"
                      sx={{ mb: 2, borderRadius: 1.5 }}
                      action={
                        isLeader ? (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            startIcon={withdrawing ? <CircularProgress size={14} /> : <UndoIcon fontSize="small" />}
                            disabled={withdrawing}
                            onClick={withdrawSupplementaryBorrow}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            {withdrawing ? 'Đang rút...' : 'Rút lại đơn mượn thêm'}
                          </Button>
                        ) : null
                      }
                    >
                      Đang có đơn mượn thêm <strong>{pendingSupplementary.requestCode}</strong> chờ giảng viên duyệt.
                    </Alert>
                  )}

                  {projectBorrows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Đề tài chưa có đơn mượn linh kiện kho nào.
                    </Typography>
                  ) : (
                    <Stack spacing={1.25}>
                      {projectBorrows.map((br) => {
                        const meta = getBorrowRequestStatusMeta(br.status)
                        return (
                          <Paper
                            key={br.borrowRequestId}
                            variant="outlined"
                            sx={{
                              p: 1.75,
                              borderRadius: 1.75,
                              borderColor: br.status === 'Pending' ? '#fcd34d' : '#e2e8f0',
                              bgcolor: br.status === 'Pending' ? '#fffbeb' : '#fafbff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 1.5,
                            }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be' }}>
                                  #{br.requestCode || '—'}
                                </Typography>
                                <Chip label={meta.label} size="small" sx={meta.sx} />
                                {br.roomName && (
                                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                                    · {br.roomName}
                                  </Typography>
                                )}
                              </Stack>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.4 }}>
                                Hạn trả: <strong>{br.dueDate ? formatVietnamDate(br.dueDate) : '—'}</strong>
                                {br.purpose ? ` · ${br.purpose}` : ''}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                              onClick={() => navigate(`/borrow/requests/${br.borrowRequestId}`)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
                            >
                              Chi tiết
                            </Button>
                          </Paper>
                        )
                      })}
                    </Stack>
                  )}
                </Paper>
              )
            })()}

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
            <Alert severity="warning">
              Bạn có chắc chắn muốn gửi đề tài này cho giảng viên duyệt không?
            </Alert>
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
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
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
                    <Typography variant="caption" color="text.secondary" display="block">Ngày nhận đồ</Typography>
                    <TextField
                      type="date"
                      size="small"
                      value={pickupDate}
                      onChange={(event) => setPickupDate(event.target.value)}
                      slotProps={{
                        htmlInput: {
                          min: localDateValue(),
                          max: borrowDeadline.dueDate ? getVietnamDateInputValue(borrowDeadline.dueDate) : undefined,
                        },
                      }}
                      sx={{ mt: 0.5, '& input': { py: 0.5, fontSize: 13, fontWeight: 700 } }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Hạn trả thiết bị</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {formatVietnamDate(borrowDeadline.dueDate)}
                    </Typography>
                  </Box>
                  <Box>
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
                !pickupDate ||
                pickupDate < localDateValue() ||
                (borrowDeadline?.dueDate && pickupDate > getVietnamDateInputValue(borrowDeadline.dueDate)) ||
                Boolean(deadlineError) ||
                !borrowDeadline ||
                !borrowDeadline.canBorrow ||
                !borrowDeadline.dueDate
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
