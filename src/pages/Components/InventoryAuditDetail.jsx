import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowBack as BackIcon,
  DeleteOutlined as DeleteIcon,
  Done as DoneIcon,
  Restore as RestoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { TRANSACTION_TYPES, auditStatusOf, formatDateTime, rowsOf } from './inventoryLabels'
import { normalizeSearchText } from './componentHelpers'
import { clearLeaveGuard, setLeaveGuard } from '../../utils/leaveGuard'
import { useEntityChanged } from '../../hooks/useEntityChanged'

const headCellSx = { fontWeight: 700, color: '#334155' }

function SectionCard({ title, subtitle, children }) {
  return (
    <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none', mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f6' }}>
        <Typography sx={{ fontWeight: 800, color: '#182238' }}>{title}</Typography>
        {subtitle && <Typography sx={{ color: '#697386', fontSize: 12 }}>{subtitle}</Typography>}
      </Box>
      {children}
    </Card>
  )
}

function diffColor(difference) {
  if (difference === null || difference === 0) return '#64748b'
  if (difference < 0) return '#c62828'
  return '#2e7d32'
}

function formatDiff(difference) {
  if (difference === null) return '—'
  if (difference > 0) return `+${difference}`
  return String(difference)
}

/**
 * Phiên kiểm kê 1 tủ.
 * Nhân viên lab tự đếm: vật tư nhập số thực tế; thiết bị chọn những cái có trong tủ (cái không chọn là thiếu).
 * Quản lý kho duyệt thì tồn kho mới đổi (vật tư theo số đếm, thiết bị thiếu sang Thất lạc).
 */
export default function InventoryAuditDetail() {
  const { auditId } = useParams()
  const navigate = useNavigate()
  const { user, hasRole, hasPermission } = useAuth()
  const [audit, setAudit] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [counts, setCounts] = useState({})
  const [missingPicks, setMissingPicks] = useState({})
  const [scannedIds, setScannedIds] = useState({})
  const [searchInput, setSearchInput] = useState('')
  const [checkedOrder, setCheckedOrder] = useState([])
  const [searchKey, setSearchKey] = useState(0)
  const [scanMessage, setScanMessage] = useState('')
  const searchRef = useRef(null)
  const rowInputs = useRef({})
  const [note, setNote] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState(null)
  const [reviewText, setReviewText] = useState('')
  const [lostItems, setLostItems] = useState([])
  const [restoringId, setRestoringId] = useState('')

  const applyAudit = useCallback(async (data) => {
    setAudit(data)
    const draft = data?.draft
    const draftCounts = {}
    const draftOrder = []
    const draftMissing = {}
    if (draft) {
      const kindOf = new Map()
      ;(data.consumables || []).forEach((line) => kindOf.set(line.componentId, 'c'))
      ;(data.items || []).forEach((item) => kindOf.set(item.componentId, 'd'))
      ;(draft.lines || []).forEach((line) => {
        const kind = kindOf.get(line.componentId)
        if (!kind) return
        draftCounts[line.componentId] = line.countedQuantity === null || line.countedQuantity === undefined ? '' : String(line.countedQuantity)
        draftOrder.push(`${kind}:${line.componentId}`)
      })
      ;(draft.missingItemIds || []).forEach((itemId) => {
        draftMissing[itemId] = true
      })
    }
    setCounts(draftCounts)
    setMissingPicks(draftMissing)
    setScannedIds({})
    setCheckedOrder(draftOrder)
    setDraftSavedAt(draft?.savedAt || null)
    setDirty(false)
    setNote(data.note || '')
    if (data?.cabinetId) {
      const lost = await inventoryService
        .getComponentItems({ cabinetId: data.cabinetId, status: 'Lost', page: 1, size: 100 })
        .catch(() => [])
      setLostItems(rowsOf(lost))
    }
  }, [])

  useEffect(() => {
    let active = true
    inventoryService
      .getInventoryAudit(auditId)
      .then((data) => {
        if (active) applyAudit(data)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải phiên kiểm kê.'))
      })
    return () => {
      active = false
    }
  }, [auditId, applyAudit])

  const currentStatus = useRef(null)
  useEffect(() => {
    currentStatus.current = audit?.status || null
  }, [audit?.status])

  const reloadWhenStatusChanges = useCallback(() => {
    inventoryService
      .getInventoryAudit(auditId)
      .then((data) => {
        if (data?.status !== currentStatus.current) applyAudit(data)
      })
      .catch(() => {})
  }, [auditId, applyAudit])
  useEntityChanged(reloadWhenStatusChanges)

  const canCount = Boolean(hasRole?.('LabStaff'))
  const inProgress = audit?.status === 'InProgress' && canCount
  const countingByStaff = audit?.status === 'InProgress' && !canCount
  const submitted = audit?.status === 'Submitted'
  const canReview = hasPermission?.('INVENTORY_AUDIT_APPROVE')
  const canRestore = hasPermission?.('COMPONENT_MANAGE')
  const isOwnCount = Boolean(audit?.auditorId && user?.userId && audit.auditorId === user.userId && !hasRole?.('Admin'))
  const consumables = useMemo(() => audit?.consumables || [], [audit])
  const items = useMemo(() => audit?.items || [], [audit])
  const status = auditStatusOf(audit?.status)

  const searchOptions = useMemo(() => {
    const consumableOptions = consumables.map((line) => ({
      key: `c:${line.componentId}`,
      kind: 'consumable',
      componentId: line.componentId,
      name: line.componentName,
      system: Number(line.systemQuantity),
      units: [],
      searchText: normalizeSearchText(`${line.componentName} ${line.componentCode || ''}`),
    }))
    const groups = new Map()
    items.forEach((item) => {
      if (!groups.has(item.componentId)) {
        groups.set(item.componentId, {
          key: `d:${item.componentId}`,
          kind: 'device',
          componentId: item.componentId,
          name: item.componentName,
          units: [],
          searchText: normalizeSearchText(item.componentName),
        })
      }
      const group = groups.get(item.componentId)
      group.units.push(item)
      group.searchText += ` ${normalizeSearchText(`${item.itemCode || ''} ${item.serialNumber || ''}`)}`
    })
    const deviceOptions = [...groups.values()].map((group) => ({ ...group, system: group.units.length }))
    return [...consumableOptions, ...deviceOptions]
  }, [consumables, items])

  const unitByCode = useMemo(() => {
    const map = new Map()
    items.forEach((item) => {
      if (item.itemCode) map.set(normalizeSearchText(item.itemCode), item)
    })
    return map
  }, [items])

  const countedOf = (option) => {
    const value = counts[option.componentId]
    if (value === undefined || value === '') return null
    return Number(value)
  }

  const differenceOf = (option) => {
    const counted = countedOf(option)
    if (counted === null) return null
    return counted - option.system
  }

  const missingNeeded = (option) => {
    const counted = countedOf(option)
    if (option.kind !== 'device' || counted === null) return 0
    return option.system - counted
  }

  const missingPicked = (option) => option.units.filter((unit) => missingPicks[unit.itemId]).length

  const isChecked = (option) => countedOf(option) !== null
  const needsPicking = (option) => isChecked(option) && missingPicked(option) !== missingNeeded(option)

  const optionsByKey = new Map(searchOptions.map((option) => [option.key, option]))
  const addedOptions = checkedOrder.map((key) => optionsByKey.get(key)).filter(Boolean)
  const uncheckedOptions = searchOptions.filter((option) => !isChecked(option))
  const diffOptions = addedOptions.filter((option) => isChecked(option) && differenceOf(option) !== 0)
  const pickingOptions = addedOptions.filter(needsPicking)
  const checkedCount = searchOptions.length - uncheckedOptions.length
  const totalCount = searchOptions.length

  const uncountedConsumables = uncheckedOptions.filter((option) => option.kind === 'consumable')
  const missingIds = []
  searchOptions.forEach((option) => {
    if (option.kind !== 'device') return
    option.units.forEach((unit) => {
      if (!isChecked(option) || missingPicks[unit.itemId]) missingIds.push(unit.itemId)
    })
  })

  const markChecked = (key) => {
    setCheckedOrder((current) => [key, ...current.filter((existing) => existing !== key)])
  }

  const setUnitFlags = (setter, units, flagOf) => {
    setter((current) => {
      const next = { ...current }
      units.forEach((unit) => {
        if (flagOf(unit)) next[unit.itemId] = true
        else delete next[unit.itemId]
      })
      return next
    })
  }

  const unmark = (option) => {
    setDirty(true)
    setCounts((current) => {
      const next = { ...current }
      delete next[option.componentId]
      return next
    })
    setUnitFlags(setMissingPicks, option.units, () => false)
    setUnitFlags(setScannedIds, option.units, () => false)
    setCheckedOrder((current) => current.filter((key) => key !== option.key))
  }

  const focusSearch = () => {
    setSearchKey((key) => key + 1)
    setSearchInput('')
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  const focusRow = (key) => {
    window.setTimeout(() => rowInputs.current[key]?.focus(), 0)
  }

  const pickOption = (option) => {
    if (!option) return
    if (counts[option.componentId] === undefined) {
      setDirty(true)
      setCounts((current) => ({ ...current, [option.componentId]: '' }))
    }
    markChecked(option.key)
    setSearchKey((key) => key + 1)
    setSearchInput('')
    setScanMessage('')
    focusRow(option.key)
  }

  const changeCount = (option, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return
    if (option.kind === 'device' && value !== '' && Number(value) > option.system) return
    setDirty(true)
    setCounts((current) => ({ ...current, [option.componentId]: value }))
    if (option.kind === 'device') {
      // Đủ số tồn: không cần chọn. Thiếu: bắt đầu chưa chọn cái nào, người kiểm chọn đúng số cái có trong tủ
      setUnitFlags(setScannedIds, option.units, () => false)
      const short = value !== '' && Number(value) < option.system
      setUnitFlags(setMissingPicks, option.units, () => short)
    }
    if (!checkedOrder.includes(option.key)) markChecked(option.key)
  }

  const scanUnit = (unit) => {
    const option = optionsByKey.get(`d:${unit.componentId}`)
    if (!option) return
    if (scannedIds[unit.itemId]) {
      setScanMessage(`Mã này đã quét rồi (${option.name}).`)
      focusSearch()
      return
    }
    const nextScanned = { ...scannedIds, [unit.itemId]: true }
    setScannedIds(nextScanned)
    const started = isChecked(option)
    const nextMissing = { ...missingPicks }
    option.units.forEach((groupUnit) => {
      if (!started) nextMissing[groupUnit.itemId] = true
    })
    delete nextMissing[unit.itemId]
    const foundCount = option.units.filter((groupUnit) => !nextMissing[groupUnit.itemId]).length
    setMissingPicks(nextMissing)
    setDirty(true)
    setCounts((current) => ({ ...current, [option.componentId]: String(foundCount) }))
    markChecked(option.key)
    setScanMessage(`Có trong tủ: ${option.name} (${foundCount}/${option.system})`)
    focusSearch()
  }

  // Chọn / bỏ chọn thiết bị có trong tủ khi số thực tế ít hơn tồn kho
  const setFound = (unitsToChange, found) => {
    setDirty(true)
    setUnitFlags(setMissingPicks, unitsToChange, () => !found)
  }

  // Dòng nhắc dưới danh sách thiết bị khi số thực tế ít hơn tồn kho
  const pickingHint = (option) => {
    const chosen = option.system - missingPicked(option)
    const counted = countedOf(option)
    if (chosen > counted) return `Đã chọn ${chosen}, nhiều hơn thực tế ${counted}: bỏ chọn ${chosen - counted} cái không tìm thấy.`
    if (chosen < counted) return `Đã chọn ${chosen}/${counted} cái.`
    return `${missingNeeded(option)} cái chưa chọn sẽ được báo thiếu.`
  }

  const shownOptions = addedOptions

  const handleRestoreLostItem = async (item) => {
    setRestoringId(item.itemId)
    setError('')
    try {
      await inventoryService.moveComponentItems({
        componentId: item.componentId,
        fromCabinetId: item.cabinetId || audit?.cabinetId,
        fromStatus: 'Lost',
        itemIds: [item.itemId],
        toStatus: 'Available',
        reason: 'Tìm thấy lại thiết bị và khôi phục về kho',
      })
      setNotice(`Đã khôi phục ${item.componentName} về kho.`)
      await applyAudit(await inventoryService.getInventoryAudit(auditId))
    } catch (restoreErr) {
      setError(extractErrorMessage(restoreErr, `Không thể khôi phục ${item.componentName}.`))
    } finally {
      setRestoringId('')
    }
  }

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveDraft = async () => {
    setSavingDraft(true)
    setError('')
    try {
      const lines = checkedOrder
        .map((key) => optionsByKey.get(key))
        .filter(Boolean)
        .map((option) => {
          const value = counts[option.componentId]
          let countedQuantity = null
          if (value !== undefined && value !== '') countedQuantity = Number(value)
          return { componentId: option.componentId, countedQuantity }
        })
      const saved = await inventoryService.saveInventoryAuditDraft(auditId, {
        lines,
        missingItemIds: Object.keys(missingPicks),
        note: note.trim() || null,
      })
      setDraftSavedAt(saved?.savedAt || new Date().toISOString())
      setDirty(false)
      setScanMessage('Đã lưu tạm.')
      return true
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu tạm.'))
      return false
    } finally {
      setSavingDraft(false)
    }
  }

  const hasUnsaved = dirty && inProgress

  useEffect(() => {
    if (!hasUnsaved) return undefined
    const guard = (path) => {
      setLeaveTarget(path)
      return true
    }
    setLeaveGuard(guard)
    return () => clearLeaveGuard(guard)
  }, [hasUnsaved])

  const leaveTo = (path) => {
    if (hasUnsaved) {
      setLeaveTarget(path)
      return
    }
    navigate(path)
  }

  const leaveWithoutSaving = () => {
    const path = leaveTarget
    setLeaveTarget(null)
    setDirty(false)
    navigate(path)
  }

  const saveAndLeave = async () => {
    const path = leaveTarget
    const ok = await saveDraft()
    if (!ok) {
      setLeaveTarget(null)
      return
    }
    setLeaveTarget(null)
    navigate(path)
  }

  const complete = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.completeInventoryAudit(auditId, {
        consumables: consumables.map((line) => {
          const value = counts[line.componentId]
          let countedQuantity = 0
          if (value !== undefined && value !== '') countedQuantity = Number(value)
          return { componentId: line.componentId, countedQuantity }
        }),
        missingItemIds: missingIds,
        note: note.trim() || null,
      })
      await applyAudit(await inventoryService.getInventoryAudit(auditId))
      setNotice('Đã gửi kết quả, chờ quản lý kho duyệt.')
      setConfirm(null)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể gửi kết quả kiểm kê.'))
      setConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  const submitReview = async () => {
    const kind = review
    setSaving(true)
    setError('')
    try {
      let updated
      if (kind === 'approve') {
        updated = await inventoryService.approveInventoryAudit(auditId, reviewText)
      } else {
        updated = await inventoryService.recountInventoryAudit(auditId, reviewText)
      }
      setReview(null)
      setReviewText('')
      await applyAudit(updated)
      if (kind === 'approve') {
        setNotice('Đã duyệt, tồn kho đã được cập nhật theo số đếm.')
      } else {
        setNotice('Đã trả về cho nhân viên lab đếm lại.')
      }
    } catch (reviewError) {
      setError(extractErrorMessage(reviewError, kind === 'approve' ? 'Không thể duyệt kết quả kiểm kê.' : 'Không thể trả về đếm lại.'))
      setReview(null)
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.cancelInventoryAudit(auditId)
      navigate('/class-setup/admin/inventory-audits')
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiên kiểm kê.'))
      setConfirm(null)
      setSaving(false)
    }
  }

  return (
    <PortalLayout headerTitle="Phiên kiểm kê" headerSubtitle="Đếm thực tế trong tủ và đối chiếu với số trên hệ thống">
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => leaveTo('/class-setup/admin/inventory-audits')}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Danh sách kiểm kê
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        {!audit && !error && (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}

        {audit && (
          <>
            {!inProgress && (
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{audit.cabinetName || audit.cabinetCode}</Typography>
                  <Typography color="text.secondary" fontSize={13.5}>
                    Người kiểm: {audit.auditorName} · Mở lúc {formatDateTime(audit.auditDate)}
                  </Typography>
                </Box>
                <Chip label={status.label} color={status.color} sx={{ fontWeight: 700 }} />
              </CardContent>
            </Card>
            )}

            {inProgress && (
              <>
                {audit.reviewNote && (
                  <Alert severity="warning" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    Quản lý kho trả về đếm lại{audit.reviewedByName ? ` (${audit.reviewedByName})` : ''}: {audit.reviewNote}
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ borderColor: '#d8dced', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2, pt: 2, pb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#182238' }}>
                        Kiểm kho · {audit.cabinetName || audit.cabinetCode}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                        {audit.auditorName} · {formatDateTime(audit.auditDate)}
                      </Typography>
                    </Box>
                    <Autocomplete
                      key={searchKey}
                      size="small"
                      options={searchOptions}
                      autoHighlight
                      value={null}
                      onChange={(_event, option) => pickOption(option)}
                      inputValue={searchInput}
                      onInputChange={(_event, value, reason) => {
                        if (reason !== 'reset') setSearchInput(value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        const unit = unitByCode.get(normalizeSearchText(searchInput))
                        if (unit) {
                          event.defaultMuiPrevented = true
                          event.preventDefault()
                          scanUnit(unit)
                        }
                      }}
                      getOptionLabel={(option) => option.name}
                      getOptionKey={(option) => option.key}
                      filterOptions={(options, state) => {
                        const query = normalizeSearchText(state.inputValue)
                        const matched = options.filter((option) => option.searchText.includes(query))
                        const unchecked = matched.filter((option) => !isChecked(option))
                        const checked = matched.filter((option) => isChecked(option))
                        return [...unchecked, ...checked]
                      }}
                      noOptionsText="Không có món này trong tủ"
                      renderOption={(props, option) => {
                        const { key, ...rest } = props
                        return (
                          <Box component="li" key={key} {...rest} sx={{ display: 'flex !important', justifyContent: 'space-between', gap: 2 }}>
                            <Typography sx={{ fontSize: 14 }}>{option.name}</Typography>
                            <Typography sx={{ fontSize: 12, color: isChecked(option) ? '#2e7d32' : '#64748b', whiteSpace: 'nowrap' }}>
                              {isChecked(option) ? 'đã kiểm' : `Tồn ${option.system}`}
                            </Typography>
                          </Box>
                        )
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          inputRef={searchRef}
                          autoFocus
                          placeholder="Tìm linh kiện hoặc quét mã thiết bị"
                          slotProps={{
                            ...params.slotProps,
                            input: {
                              ...params.slotProps?.input,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      )}
                      sx={{ flex: 1, minWidth: 240, maxWidth: 480 }}
                    />
                    <Typography sx={{ ml: 'auto', fontWeight: 700, fontSize: 13.5, color: '#334155' }}>
                      Đã kiểm {checkedCount}/{totalCount}
                    </Typography>
                  </Box>
                  {scanMessage && (
                    <Typography sx={{ fontSize: 13, color: '#2e7d32', px: 2 }}>{scanMessage}</Typography>
                  )}


                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 40 }} />
                          <TableCell sx={{ ...headCellSx, width: 50 }}>STT</TableCell>
                          <TableCell sx={headCellSx}>Tên linh kiện</TableCell>
                          <TableCell align="right" sx={{ ...headCellSx, width: 100 }}>Tồn kho</TableCell>
                          <TableCell align="right" sx={{ ...headCellSx, width: 120 }}>Thực tế</TableCell>
                          <TableCell align="right" sx={{ ...headCellSx, width: 100 }}>SL lệch</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shownOptions.map((option, index) => {
                          const difference = differenceOf(option)
                          const needed = missingNeeded(option)
                          const added = checkedOrder.includes(option.key)
                          return (
                            <Fragment key={option.key}>
                              <TableRow hover>
                                <TableCell sx={{ px: 1 }}>
                                  {added && (
                                    <IconButton size="small" onClick={() => unmark(option)} title="Bỏ dòng này">
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </TableCell>
                                <TableCell sx={{ color: '#64748b' }}>{index + 1}</TableCell>
                                <TableCell>
                                  <Typography sx={{ fontSize: 14 }}>{option.name}</Typography>
                                </TableCell>
                                <TableCell align="right">{option.system}</TableCell>
                                <TableCell align="right">
                                  <TextField
                                    variant="standard"
                                    value={counts[option.componentId] ?? ''}
                                    onChange={(event) => changeCount(option, event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') focusSearch()
                                    }}
                                    inputRef={(element) => { rowInputs.current[option.key] = element }}
                                    slotProps={{ htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } } }}
                                    sx={{ width: 70 }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(difference) }}>
                                  {formatDiff(difference)}
                                </TableCell>
                              </TableRow>
                              {option.kind === 'device' && added && needed > 0 && (
                                <TableRow>
                                  <TableCell />
                                  <TableCell colSpan={5} sx={{ bgcolor: '#f8fafc', py: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                                      <Typography sx={{ fontSize: 12.5, color: '#334155' }}>
                                        Thiếu {needed} cái. Chọn những cái có trong tủ:
                                      </Typography>
                                      <Button size="small" onClick={() => setFound(option.units, true)} sx={{ textTransform: 'none', py: 0 }}>
                                        Chọn tất cả
                                      </Button>
                                      <Button size="small" color="inherit" onClick={() => setFound(option.units, false)} sx={{ textTransform: 'none', py: 0 }}>
                                        Bỏ chọn hết
                                      </Button>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
                                      {option.units.map((unit) => {
                                        const found = !missingPicks[unit.itemId]
                                        return (
                                        <FormControlLabel
                                          key={unit.itemId}
                                          control={
                                            <Checkbox
                                              size="small"
                                              color="success"
                                              checked={found}
                                              onChange={(event) => setFound([unit], event.target.checked)}
                                            />
                                          }
                                          label={
                                            <Typography sx={{ fontSize: 13 }}>
                                              {unit.itemCode}
                                              {unit.serialNumber ? ` · S/N ${unit.serialNumber}` : ''}
                                            </Typography>
                                          }
                                        />
                                        )
                                      })}
                                    </Box>
                                    <Typography sx={{ fontSize: 12, color: '#b45309', mt: 0.5 }}>
                                      {pickingHint(option)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        })}
                        {shownOptions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                              {totalCount === 0 ? 'Tủ đang trống.' : 'Chọn linh kiện hoặc quét mã ở ô phía trên để bắt đầu đếm.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', px: 2, py: 1.5, borderTop: '1px solid #eef0f6' }}>
                    <TextField
                      size="small"
                      placeholder="Ghi chú (không bắt buộc)"
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value)
                        setDirty(true)
                      }}
                      sx={{ flex: 1, minWidth: 200 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {dirty && 'Có thay đổi chưa lưu'}
                      {!dirty && draftSavedAt && `Đã lưu lúc ${formatDateTime(draftSavedAt)}`}
                    </Typography>
                    <Button color="error" onClick={() => setConfirm('cancel')} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      Hủy phiên
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={saveDraft}
                      disabled={saving || savingDraft || !dirty}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      {savingDraft ? 'Đang lưu...' : 'Lưu tạm'}
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<DoneIcon />}
                      onClick={() => setConfirm('complete')}
                      disabled={saving || checkedCount === 0 || pickingOptions.length > 0}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                    >
                      Gửi kết quả
                    </Button>
                  </Box>
                </Paper>
              </>
            )}

            {countingByStaff && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nhân viên lab đang kiểm tủ này. Khi họ gửi kết quả, bạn sẽ duyệt ở đây.
              </Alert>
            )}

            {submitted && (
              <SectionCard
                title="Kết quả đếm chờ duyệt"
                subtitle={`Gửi bởi ${audit.auditorName || 'nhân viên lab'}${audit.submittedAt ? ` lúc ${formatDateTime(audit.submittedAt)}` : ''}. Tồn kho chưa thay đổi cho tới khi được duyệt.`}
              >
                <Box sx={{ p: 2 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          <TableCell sx={headCellSx}>Vật tư</TableCell>
                          <TableCell align="right" sx={headCellSx}>Hệ thống</TableCell>
                          <TableCell align="right" sx={headCellSx}>Đếm được</TableCell>
                          <TableCell align="right" sx={headCellSx}>Lệch</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.submittedCounts || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>Tủ không có vật tư tiêu hao.</TableCell>
                          </TableRow>
                        )}
                        {(audit.submittedCounts || []).map((line) => (
                          <TableRow key={line.componentId}>
                            <TableCell sx={{ fontWeight: 600 }}>{line.componentName}</TableCell>
                            <TableCell align="right">{line.systemQuantity}</TableCell>
                            <TableCell align="right">{line.countedQuantity}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(line.difference) }}>
                              {formatDiff(line.difference)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 2, mb: 1 }}>
                    Thiết bị báo thiếu ({(audit.missingItems || []).length})
                  </Typography>
                  {(audit.missingItems || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Không có thiết bị nào bị báo thiếu.</Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {audit.missingItems.map((item) => (
                        <Typography key={item.itemId} variant="body2">
                          <strong>{item.componentName}</strong>
                          {item.serialNumber ? ` · S/N ${item.serialNumber}` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  {audit.note && (
                    <Alert severity="info" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>Ghi chú: {audit.note}</Alert>
                  )}

                  {canReview && (
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap', mt: 2 }}>
                      {isOwnCount && (
                        <Typography variant="body2" sx={{ color: '#b45309', mr: 'auto', alignSelf: 'center' }}>
                          Bạn là người đã đếm tủ này, cần một người khác duyệt.
                        </Typography>
                      )}
                      <Button
                        variant="outlined"
                        disabled={saving || isOwnCount}
                        onClick={() => { setReviewText(''); setReview('recount') }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Trả về đếm lại
                      </Button>
                      <Button
                        variant="contained"
                        disabled={saving || isOwnCount}
                        onClick={() => { setReviewText(''); setReview('approve') }}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                      >
                        Duyệt kết quả
                      </Button>
                    </Box>
                  )}
                  {!canReview && <Alert severity="info" sx={{ mt: 2 }}>Đang chờ quản lý kho duyệt.</Alert>}
                </Box>
              </SectionCard>
            )}

            {audit.status !== 'InProgress' && !submitted && (
              <>
                {audit.reviewNote && (
                  <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    Ghi chú duyệt{audit.reviewedByName ? ` của ${audit.reviewedByName}` : ''}: {audit.reviewNote}
                  </Alert>
                )}
                {(audit.reservationShortages || []).length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Lab đang thiếu hàng cho các đơn đã duyệt:{' '}
                    {audit.reservationShortages
                      .map((line) => `${line.componentName} (còn ${line.inStock}, cần ${line.reserved}: ${(line.requestCodes || []).join(', ')})`)
                      .join('; ')}
                  </Alert>
                )}
                {audit.note && (
                  <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>Ghi chú: {audit.note}</Alert>
                )}
                <SectionCard title={`Chênh lệch đã ghi sổ kho (${(audit.differences || []).length})`}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Loại', 'Linh kiện', 'Serial', 'Thay đổi', 'Lý do'].map((head) => (
                            <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.differences || []).map((line) => (
                          <TableRow key={line.transactionId}>
                            <TableCell>{line.type === 'Retire' ? 'Thất lạc' : TRANSACTION_TYPES[line.type] || line.type}</TableCell>
                            <TableCell>{line.componentName}</TableCell>
                            <TableCell>{line.serialNumber || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: diffColor(line.quantityChange) }}>
                              {formatDiff(line.quantityChange)}
                            </TableCell>
                            <TableCell>{line.reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {(audit.differences || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              Không có chênh lệch, số đếm khớp hệ thống.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              </>
            )}

            {/* Chỉ quản lý kho (khôi phục được) mới cần xem thiết bị đã thất lạc từ trước; nhân viên lab đang đếm thì không */}
            {canRestore && lostItems.length > 0 && (
              <SectionCard
                title={`Thiết bị thất lạc của tủ này (${lostItems.length})`}
                subtitle={canRestore ? 'Tìm thấy lại thì bấm Khôi phục để đưa về kho.' : 'Tìm thấy lại thì báo quản lý kho khôi phục.'}
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fffbeb' }}>
                        {['Linh kiện', 'Serial', ''].map((head) => (
                          <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lostItems.map((item) => (
                        <TableRow key={item.itemId} hover>
                          <TableCell>{item.componentName}</TableCell>
                          <TableCell>{item.serialNumber || '—'}</TableCell>
                          <TableCell align="right">
                            {canRestore && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<RestoreIcon />}
                                disabled={restoringId === item.itemId}
                                onClick={() => handleRestoreLostItem(item)}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                {restoringId === item.itemId ? 'Đang khôi phục...' : 'Khôi phục'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SectionCard>
            )}
          </>
        )}
      </Box>

      <Dialog open={Boolean(leaveTarget)} onClose={() => !savingDraft && setLeaveTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Bạn chưa lưu tạm</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Thoát bây giờ sẽ mất những gì vừa đếm từ lần lưu trước.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setLeaveTarget(null)} disabled={savingDraft}>Ở lại</Button>
          <Button color="error" onClick={leaveWithoutSaving} disabled={savingDraft}>Thoát không lưu</Button>
          <Button variant="contained" onClick={saveAndLeave} disabled={savingDraft} sx={{ bgcolor: '#0058be' }}>
            {savingDraft ? 'Đang lưu...' : 'Lưu tạm rồi thoát'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirm)} onClose={() => !saving && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm === 'cancel' ? 'Hủy phiên kiểm kê?' : 'Gửi kết quả kiểm kê?'}
        </DialogTitle>
        <DialogContent>
          {confirm === 'cancel' ? (
            <Typography variant="body2">Phiên kiểm kê sẽ bị hủy, tồn kho không thay đổi.</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                • <strong>{diffOptions.length}</strong> loại linh kiện lệch so với hệ thống.
              </Typography>
              {uncountedConsumables.length > 0 && (
                <Typography variant="body2" sx={{ color: '#b45309' }}>
                  • <strong>{uncountedConsumables.length}</strong> loại vật tư chưa đếm sẽ tính là <strong>0</strong>.
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: missingIds.length > 0 ? '#b45309' : undefined }}>
                • <strong>{missingIds.length}</strong> thiết bị báo <strong>thiếu</strong> (kể cả loại chưa đếm), chuyển sang Thất lạc khi được duyệt.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tồn kho chỉ thay đổi sau khi quản lý kho duyệt.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={saving}>Đóng</Button>
          <Button
            variant="contained"
            color={confirm === 'cancel' ? 'error' : 'primary'}
            onClick={confirm === 'cancel' ? cancel : complete}
            disabled={saving}
          >
            {saving ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(review)} onClose={() => !saving && setReview(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {review === 'approve' ? 'Duyệt kết quả kiểm kê?' : 'Trả về đếm lại?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {review === 'approve'
              ? 'Vật tư lệch được điều chỉnh theo số đếm, thiết bị báo thiếu chuyển sang Thất lạc, mọi thay đổi ghi vào sổ kho.'
              : 'Nhân viên lab sẽ đếm lại từ đầu. Tồn kho không thay đổi.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={review === 'approve' ? 'Ghi chú (không bắt buộc)' : 'Lý do đếm lại *'}
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReview(null)} disabled={saving}>Đóng</Button>
          <Button
            variant="contained"
            onClick={submitReview}
            disabled={saving || (review === 'recount' && !reviewText.trim())}
          >
            {saving ? 'Đang xử lý...' : review === 'approve' ? 'Duyệt' : 'Trả về đếm lại'}
          </Button>
        </DialogActions>
      </Dialog>
    </PortalLayout>
  )
}
