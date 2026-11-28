import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { borrowService } from '../../services/borrowService'
import { inventoryService } from '../../services/inventoryService'
import { projectService } from '../../services/projectService'
import { teamService } from '../../services/teamService'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta, getShownPurpose, isSupplementaryPurpose } from '../Borrowing/borrowHelpers'
import FinalSubmissionPanel from './FinalSubmissionPanel'
import ProjectStatus from './ProjectStatus'
import { isTeamLeader } from './projectHelpers'
import { labCode, labName } from '../../utils/labLabel'
import BorrowPreviewList from '../../components/borrowing/BorrowPreviewList'

const emptyForm = () => ({ title: '', description: '', components: [], selfSuppliedItems: [] })
const suggestionCacheKey = (projectId) => `smartlabkit:project-suggestions:${projectId}`
const MAX_PROJECT_COMPONENT_QUANTITY = 1000

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

function isValidComponentQuantity(quantity) {
  const value = Number(quantity)
  return Number.isInteger(value) && value >= 1 && value <= MAX_PROJECT_COMPONENT_QUANTITY
}

function getFormError(form) {
  if (!form.title.trim() || !form.description.trim()) {
    return 'Vui lòng nhập tên và mô tả project.'
  }
  if (form.components.some((item) => !item.componentId || !isValidComponentQuantity(item.quantity))) {
    return `Vui lòng chọn linh kiện và nhập số lượng nguyên từ 1 đến ${MAX_PROJECT_COMPONENT_QUANTITY}.`
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

const quantityButtonSx = {
  width: 28,
  height: 28,
  color: '#1d4ed8',
  '&[aria-disabled="true"]': { color: 'action.disabled', cursor: 'default', bgcolor: 'transparent' },
}

function ComponentQuantityStepper({ name, quantity, onChange, disabled, children }) {
  const value = Math.trunc(Number(quantity)) || 0
  const atMinimum = value <= 1
  const atMaximum = value >= MAX_PROJECT_COMPONENT_QUANTITY

  // Dùng aria-disabled ở hai giới hạn để dòng đang nhập không mất tiêu điểm khi bấm tới giới hạn.
  return (
    <Box role="group" aria-label={`Số lượng ${name}`} sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <IconButton
        type="button"
        size="small"
        aria-label={`Giảm số lượng ${name}`}
        aria-disabled={atMinimum || undefined}
        disabled={disabled}
        onClick={() => {
          if (!atMinimum) onChange(Math.min(MAX_PROJECT_COMPONENT_QUANTITY, value - 1))
        }}
        sx={quantityButtonSx}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      {children ?? (
        <Typography component="span" aria-live="polite" sx={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
          {quantity}
        </Typography>
      )}
      <IconButton
        type="button"
        size="small"
        aria-label={`Tăng số lượng ${name}`}
        aria-disabled={atMaximum || undefined}
        disabled={disabled}
        onClick={() => {
          if (!atMaximum) onChange(Math.max(1, value + 1))
        }}
        sx={quantityButtonSx}
      >
        <AddIcon fontSize="small" />
      </IconButton>
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
        <Typography variant="caption" sx={{ color: '#92400e', fontSize: 11, lineHeight: 1.3 }}>
          Tồn kho hiện có: {suggestion.available}
        </Typography>
      )}
    </Box>
  )
}

export default function ProjectManagement() {
  const { teamId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [team, setTeam] = useState(null)
  const [showBorrowHistory, setShowBorrowHistory] = useState(false)
  const [project, setProject] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(null)
  const [componentTypes, setComponentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestSeconds, setSuggestSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState([])
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [borrowPreview, setBorrowPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [inlineDraft, setInlineDraft] = useState(null)
  const [borrowDeadline, setBorrowDeadline] = useState(null)
  const [loadingDeadline, setLoadingDeadline] = useState(false)
  const [deadlineError, setDeadlineError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [componentError, setComponentError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
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

  const nextRowKey = (prefix) => {
    rowKeySequence.current += 1
    return `${prefix}-${rowKeySequence.current}`
  }

  const isLeader = useMemo(() => isTeamLeader(team, user), [team, user])

  const canEdit = isLeader && (!project || ['Draft', 'Rejected'].includes(project.status))
  const projectActionsPending = saving || submitting
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
    setBorrowPreview(null)
    setPreviewError('')
    setSubmitDialogOpen(true)
    if (requiresBorrow) {
      setLoadingPreview(true)
      projectService
        .previewBorrow(project.projectId, toProjectPayload(form).components)
        .then((data) => setBorrowPreview(data))
        .catch((error) => setPreviewError(error.message || 'Không thể xem trước đơn mượn.'))
        .finally(() => setLoadingPreview(false))
    }
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
      const teamData = await teamService.getTeamById(teamId)
      if (!teamData?.classId) {
        throw new Error('Không tìm thấy lớp của nhóm để tải project.')
      }
      setTeam(teamData)

      const [projectsResult, componentsResult] = await Promise.allSettled([
        projectService.getProjectsByClass(teamData.classId),
        inventoryService
          .getComponents({ classId: teamData.classId, isActive: true, page: 1, size: 1000 })
          .then((items) => items.filter((item) => item.isActive !== false)),
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
    setSuggestSeconds(0)
    const startedAt = Date.now()
    const ticker = window.setInterval(() => setSuggestSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    try {
      const result = await projectService.suggestComponents(form.description.trim(), team?.classId)
      setSuggestions(result)
      setSelectedSuggestions([])
      writeSuggestionCache(result, [])
    } catch (error) {
      showToast(error.message || 'Không thể lấy gợi ý linh kiện.', 'error')
    } finally {
      window.clearInterval(ticker)
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
    const isComponent = draft.type === 'component'
    const name = isComponent
      ? componentTypes.find((component) => component.componentId === draft.componentId)?.componentName
      : draft.itemName.trim()
    if (!name) {
      cancelInlineDraft()
      return
    }
    const quantity = Number(draft.quantity)
    const validQuantity = isComponent ? isValidComponentQuantity(quantity) : Number.isInteger(quantity) && quantity >= 1
    if (!validQuantity) {
      showToast(isComponent
        ? `Vui lòng nhập số lượng nguyên từ 1 đến ${MAX_PROJECT_COMPONENT_QUANTITY}.`
        : 'Vui lòng nhập số lượng nguyên lớn hơn 0.', 'warning')
      window.requestAnimationFrame(() => inlineQuantityInputRef.current?.focus())
      return
    }
    if (isComponent) {
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
    // Chỉ chốt dòng từ ô nhập để Enter trên nút số lượng vẫn kích hoạt nút.
    if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return
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
      const submittedProject = await projectService.submitProject(updatedProject.projectId)
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
      showToast('Đã rút lại đơn mượn thêm đang chờ giảng viên duyệt.')
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
  const inlineQuantityInput = inlineDraft && (
    <TextField
      inputRef={inlineQuantityInputRef}
      type="number"
      size="small"
      variant="standard"
      value={inlineDraft.quantity}
      onChange={(event) => updateInlineDraft({ quantity: event.target.value })}
      slotProps={{
        input: { disableUnderline: true },
        htmlInput: {
          min: 1,
          max: inlineDraft.type === 'component' ? MAX_PROJECT_COMPONENT_QUANTITY : undefined,
          step: 1,
          'aria-label': 'Số lượng',
        },
      }}
      sx={{
        width: 38,
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
  )
  const inlineDraftView = inlineDraft ? (
    <Box
      ref={inlineDraftRootRef}
      onBlurCapture={handleInlineBlur}
      onKeyDown={handleInlineKeyDown}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        maxWidth: '100%',
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
            minWidth: 0,
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
              slotProps={{
                ...params.slotProps,
                input: { ...params.slotProps.input, disableUnderline: true },
                htmlInput: { ...params.slotProps.htmlInput, 'aria-label': 'Tìm linh kiện từ kho' },
              }}
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
      {inlineDraft.type === 'component' ? (
        <ComponentQuantityStepper
          name={inlineDraft.componentId ? inlineDraft.searchText : 'linh kiện'}
          quantity={inlineDraft.quantity}
          onChange={(quantity) => updateInlineDraft({ quantity })}
          disabled={projectActionsPending}
        >
          {inlineQuantityInput}
        </ComponentQuantityStepper>
      ) : (
        <>
          <Typography component="span" sx={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>
            ×
          </Typography>
          {inlineQuantityInput}
        </>
      )}
      <Tooltip title="Thêm vào danh sách (Enter)">
        <IconButton
          size="small"
          aria-label="Thêm vào danh sách"
          onClick={() => commitInlineDraft()}
          sx={{ p: 0.25, color: '#16a34a' }}
        >
          <CheckIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Bỏ dòng này (Esc)">
        <IconButton
          size="small"
          aria-label="Bỏ dòng này"
          onClick={() => cancelInlineDraft()}
          sx={{ p: 0.25, color: '#94a3b8' }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
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
          onClick={() => navigate(state?.fromProjectList ? '/class-setup/student/project' : '/class-setup/student/groups')}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {state?.fromProjectList ? 'Quay lại danh sách' : 'Quay lại nhóm'}
        </Button>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800, color: '#131b2e' }}>
            Thiết lập dự án
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {team ? `${team.teamName} · Lớp ${team.classCode}` : 'Tạo, cập nhật và gửi duyệt project của nhóm.'}
          </Typography>
        </Box>

        {loading ? (
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
                        {form.components.map((item) => {
                          if (inlineDraft?.mode === 'edit' && inlineDraft.type === 'component' && inlineDraft.clientKey === item.clientKey) {
                            return <Fragment key={item.clientKey}>{inlineDraftView}</Fragment>
                          }

                          const name = getComponentName(item.componentId) || 'Linh kiện'
                          if (!canEdit) {
                            return (
                              <Tooltip key={item.clientKey} title={item.note || ''}>
                                <Chip
                                  label={<QuantityLabel name={name} quantity={item.quantity} />}
                                  sx={{ ...selectedChipStyles, width: 'fit-content', cursor: 'default' }}
                                />
                              </Tooltip>
                            )
                          }

                          return (
                            <Box
                              key={item.clientKey}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 0.5, maxWidth: '100%',
                                minHeight: 36, pl: 1.1, pr: 0.5, borderRadius: 2, bgcolor: '#f1f5f9',
                              }}
                            >
                              <Tooltip title={item.note || name}>
                                <Box sx={{ display: 'flex', minWidth: 0 }}>
                                  <ButtonBase
                                    type="button"
                                    aria-label={`Chỉnh sửa ${name}`}
                                    onClick={() => startInlineEdit('component', item)}
                                    disabled={projectActionsPending}
                                    sx={{ minWidth: 0, borderRadius: 1, '&.Mui-focusVisible': { outline: '2px solid #2563eb' } }}
                                  >
                                    <Typography component="span" variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                      {name}
                                    </Typography>
                                  </ButtonBase>
                                </Box>
                              </Tooltip>
                              <ComponentQuantityStepper
                                name={name}
                                quantity={item.quantity}
                                onChange={(quantity) => updateComponent(item.clientKey, 'quantity', quantity)}
                                disabled={projectActionsPending}
                              />
                              <IconButton
                                type="button"
                                size="small"
                                aria-label={`Xóa ${name}`}
                                onClick={() => removeComponent(item.clientKey)}
                                disabled={projectActionsPending}
                                sx={{ flexShrink: 0, color: '#64748b', '&:hover': { color: '#ef4444' } }}
                              >
                                <CloseIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Box>
                          )
                        })}
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
                        {!canEdit && form.selfSuppliedItems.length === 0 && (
                          <Typography variant="body2" color="text.secondary">Không có</Typography>
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
                              {suggesting
                                ? `AI đang phân tích mô tả và tồn kho của lab (thường 2–6 giây)… ${suggestSeconds}s`
                                : 'Tối đa 10 lượt mỗi giờ.'}
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
              const allBorrows = Array.isArray(project.borrowRequests) ? project.borrowRequests : []
              // Chỉ hiện đơn hiện tại; đơn bị từ chối hoặc đã hủy nằm trong phần lịch sử
              const historyBorrows = allBorrows.filter((br) => ['Rejected', 'Cancelled'].includes(br.status))
              const currentBorrows = allBorrows.filter((br) => !['Rejected', 'Cancelled'].includes(br.status))
              const projectBorrows = showBorrowHistory ? allBorrows : currentBorrows
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
                        Đơn mượn của đề tài ({currentBorrows.length})
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
                      {historyBorrows.length > 0 ? 'Không có đơn đang xử lý.' : 'Đề tài chưa có đơn mượn linh kiện kho nào.'}
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
                                {isSupplementaryPurpose(br.purpose) && (
                                  <Chip label="Mượn thêm" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 }} />
                                )}
                                <Chip label={meta.label} size="small" sx={meta.sx} />
                                {labCode(br, '') && (
                                  <Typography variant="caption" title={labName(br)} sx={{ color: '#64748b' }}>
                                    · {labCode(br)}
                                  </Typography>
                                )}
                              </Stack>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.4 }}>
                                Hạn trả: <strong>{br.dueDate ? formatVietnamDate(br.dueDate) : '—'}</strong>
                                {getShownPurpose(br.purpose) ? ` · ${getShownPurpose(br.purpose)}` : ''}
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
                  {historyBorrows.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => setShowBorrowHistory((value) => !value)}
                      sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                    >
                      {showBorrowHistory
                        ? 'Ẩn lịch sử đơn'
                        : `Xem lịch sử: ${historyBorrows.length} đơn bị từ chối hoặc đã hủy`}
                    </Button>
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
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Thời gian còn lại</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: borrowDeadline.daysLeft < 0 ? '#b91c1c' : '#1d4ed8' }}>
                      {borrowDeadline.daysLeft} ngày
                    </Typography>
                  </Box>
                </Box>
                <BorrowPreviewList preview={borrowPreview} loading={loadingPreview} error={previewError} />
                <Typography variant="body2" color="text.secondary">
                  Giảng viên duyệt xong, lab của môn chuẩn bị linh kiện và hẹn ngày đến nhận.
                </Typography>
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
              (requiresBorrow && (loadingPreview || Boolean(borrowPreview?.problem))) ||
              (requiresBorrow && (
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
