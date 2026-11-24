import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import { alpha } from '@mui/material/styles'
import { extractErrorMessage } from '../../services/api'
import { borrowService } from '../../services/borrowService'
import { inventoryService } from '../../services/inventoryService'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function getRows(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

function isConsumable(item) {
  return normalize(item.trackingType) === 'consumable'
}

const ITEMS_PAGE_SIZE = 100

function isAvailable(item) {
  return normalize(item.status) === 'available'
}

async function getAvailableItems(line, roomId, cabinetIds, signal) {
  const rows = []
  for (let page = 1, total = 1; rows.length < total; page += 1) {
    const result = await inventoryService.getComponentItems({
      componentId: line.componentId,
      roomId,
      status: 'Available',
      page,
      size: ITEMS_PAGE_SIZE,
    }, { signal })
    const batch = getRows(result)
    if (batch.length === 0) break
    rows.push(...batch)
    total = Number(result?.totalCount) || rows.length
  }
  return [...new Map(rows
    .filter((item) =>
      item.componentId === line.componentId &&
      cabinetIds.includes(item.cabinetId) &&
      isAvailable(item) &&
      item.itemId,
    )
    .map((item) => [item.itemId, item])).values()]
}

function getItemStatusMeta(status) {
  switch (normalize(status)) {
    case 'available':
      return {
        label: 'Sẵn sàng',
        sx: { bgcolor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
      }
    case 'borrowed':
      return {
        label: 'Đang mượn',
        sx: { bgcolor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
      }
    case 'lost':
      return {
        label: 'Thất lạc',
        sx: { bgcolor: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' },
      }
    case 'retired':
      return {
        label: 'Thanh lý',
        sx: { bgcolor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
      }
    default:
      return {
        label: status || '—',
        sx: { bgcolor: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' },
      }
  }
}

function ComponentCodeTag({ code }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: 0.75,
        bgcolor: '#f1f5f9',
        color: '#475569',
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
      }}
    >
      {code || '—'}
    </Box>
  )
}

function getAiDetail(photo) {
  if (!photo?.aiDetail) return {}
  if (typeof photo.aiDetail === 'object') return photo.aiDetail
  try {
    const parsed = JSON.parse(photo.aiDetail)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getAiStatusLabel(aiResult) {
  switch (normalize(aiResult)) {
    case 'match':
      return 'Thẻ sinh viên khớp'
    case 'mismatch':
      return 'Thẻ không khớp'
    case 'unreadable':
      return 'Không đọc được thẻ'
    default:
      return 'Không xác thực được thẻ'
  }
}

export default function IssueBorrowModal({ request, open, submitting, onClose, onIssue }) {
  const [step, setStep] = useState(0)
  const [photo, setPhoto] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [availableByLine, setAvailableByLine] = useState({})
  const [cabinetIds, setCabinetIds] = useState([])
  const [loadedByLine, setLoadedByLine] = useState({})
  const [loadingByLine, setLoadingByLine] = useState({})
  const [selectedByLine, setSelectedByLine] = useState({})
  const [selectedLineId, setSelectedLineId] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const lineLoadsRef = useRef(new Set())
  const lineControllersRef = useRef(new Map())
  const items = useMemo(() => request?.items || [], [request?.items])
  const needsOverride = photo && normalize(photo.aiResult) !== 'match'
  const parsedAiDetail = getAiDetail(photo)
  const expectedStudentCode = parsedAiDetail.expectedStudentCode || request?.studentCode || 'Không xác định'
  const detectedStudentCode = parsedAiDetail.studentCode || 'Không xác định'
  const selectedIds = Object.values(selectedByLine).flat().map((item) => item.itemId)
  const selectedIdSet = new Set(selectedIds)
  const selectableItems = items.filter((line) => !isConsumable(line))
  const itemSelectionValid = selectableItems.every((line) =>
    (selectedByLine[line.borrowItemId] || []).length === Number(line.quantity),
  ) && selectedIds.length === selectedIdSet.size

  useEffect(() => {
    if (!open || !request) return undefined

    let active = true
    const lineControllers = lineControllersRef.current
    const timer = window.setTimeout(async () => {
      setLoadingData(true)
      setError('')
      setAvailableByLine({})
      setCabinetIds([])
      setLoadedByLine({})
      setLoadingByLine({})
      setSelectedByLine({})
      setSelectedLineId(items.find((line) => !isConsumable(line))?.borrowItemId || '')
      setItemSearch('')
      setPhoto(null)
      setPhotoPreviewUrl('')
      setOverrideReason('')
      setStep(0)
      lineLoadsRef.current.clear()
      lineControllersRef.current.forEach((controller) => controller.abort())
      lineControllers.clear()
      try {
        if (!items.some((line) => !isConsumable(line))) {
          setLoadingData(false)
          return
        }
        const roomsCabinets = await inventoryService.getCabinets({
          roomId: request.roomId,
          page: 1,
          size: 100,
        })
        const roomCabinetIds = roomsCabinets
          .filter((cabinet) => cabinet.roomId === request.roomId)
          .map((cabinet) => cabinet.cabinetId)
          .filter(Boolean)
        if (active) {
          setCabinetIds(roomCabinetIds)
          setLoadingData(false)
          const firstLine = items.find((line) => !isConsumable(line))
          if (firstLine && roomCabinetIds.length) {
            const lineId = firstLine.borrowItemId
            const controller = new AbortController()
            lineLoadsRef.current.add(lineId)
            lineControllersRef.current.set(lineId, controller)
            setLoadingByLine({ [lineId]: true })
            try {
              const available = await getAvailableItems(firstLine, request.roomId, roomCabinetIds, controller.signal)
              if (active) {
                setAvailableByLine((current) => ({ ...current, [lineId]: available }))
                setLoadedByLine((current) => ({ ...current, [lineId]: true }))
              }
            } catch (loadError) {
              if (active && !controller.signal.aborted) {
                setError(extractErrorMessage(loadError, `Không thể tải mã con của ${firstLine.componentCode}.`))
              }
            } finally {
              lineLoadsRef.current.delete(lineId)
              lineControllersRef.current.delete(lineId)
              if (active) setLoadingByLine((current) => ({ ...current, [lineId]: false }))
            }
          }
        }
      } catch (loadError) {
        if (active) {
          setError(extractErrorMessage(loadError, 'Không thể tải linh kiện Available tại lab nhận.'))
          setLoadingData(false)
        }
      }
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
      lineControllers.forEach((controller) => controller.abort())
      lineControllers.clear()
    }
  }, [items, open, request])

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const loadLineItems = async (line) => {
    const lineId = line.borrowItemId
    if (loadedByLine[lineId] || lineLoadsRef.current.has(lineId)) return

    lineLoadsRef.current.add(lineId)
    const controller = new AbortController()
    lineControllersRef.current.set(lineId, controller)
    setLoadingByLine((current) => ({ ...current, [lineId]: true }))
    setError('')
    try {
      const available = await getAvailableItems(line, request.roomId, cabinetIds, controller.signal)
      setAvailableByLine((current) => ({ ...current, [lineId]: available }))
      setLoadedByLine((current) => ({ ...current, [lineId]: true }))
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setError(extractErrorMessage(loadError, `Không thể tải mã con của ${line.componentCode}.`))
      }
    } finally {
      lineLoadsRef.current.delete(lineId)
      lineControllersRef.current.delete(lineId)
      setLoadingByLine((current) => ({ ...current, [lineId]: false }))
    }
  }

  const selectLine = (line) => {
    if (isConsumable(line)) return
    setSelectedLineId(line.borrowItemId)
    setItemSearch('')
    setError('')
    loadLineItems(line)
  }

  const advanceToNextIncompleteLine = (line) => {
    const currentIndex = selectableItems.findIndex((item) => item.borrowItemId === line.borrowItemId)
    const orderedLines = [
      ...selectableItems.slice(currentIndex + 1),
      ...selectableItems.slice(0, currentIndex),
    ]
    const nextLine = orderedLines.find((item) =>
      (selectedByLine[item.borrowItemId] || []).length < Number(item.quantity),
    )
    if (nextLine) {
      setSelectedLineId(nextLine.borrowItemId)
      setItemSearch('')
      loadLineItems(nextLine)
    }
  }

  const toggleItem = (line, item) => {
    const selected = selectedByLine[line.borrowItemId] || []
    if (selected.some((entry) => entry.itemId === item.itemId)) {
      setError('')
      setSelectedByLine((current) => ({
        ...current,
        [line.borrowItemId]: (current[line.borrowItemId] || [])
          .filter((entry) => entry.itemId !== item.itemId),
      }))
      return
    }
    if (selectedIdSet.has(item.itemId)) {
      setError('Linh kiện này đã được chọn cho một dòng khác trong đơn.')
      return
    }
    if (selected.length >= Number(line.quantity)) return

    setError('')
    const nextSelection = [...selected, item]
    setSelectedByLine((current) => ({
      ...current,
      [line.borrowItemId]: nextSelection,
    }))
    if (nextSelection.length === Number(line.quantity)) {
      advanceToNextIncompleteLine(line)
    }
  }

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn ảnh định dạng JPG, PNG hoặc ảnh được hỗ trợ.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Ảnh không được vượt quá 5 MB.')
      return
    }

    setUploading(true)
    setError('')
    setPhoto(null)
    setPhotoPreviewUrl('')
    setOverrideReason('')
    try {
      const result = await borrowService.uploadHandoverPhoto(request.borrowRequestId, file, 'Issue')
      if (!result?.photoId || !result?.aiResult) {
        throw new Error('Phản hồi ảnh bàn giao thiếu photoId hoặc kết quả nhận diện.')
      }
      setPhoto(result)
      setPhotoPreviewUrl(URL.createObjectURL(file))
    } catch (uploadError) {
      setError(extractErrorMessage(uploadError, 'Không thể tải ảnh bàn giao.'))
    } finally {
      setUploading(false)
    }
  }

  const submitIssue = async () => {
    if (!photo?.photoId) {
      setError('Cần chụp và tải ảnh bàn giao trước khi tiếp tục.')
      setStep(0)
      return
    }
    if (needsOverride && !overrideReason.trim()) {
      setError('Cần nhập lý do AI không nhận diện khớp thẻ sinh viên.')
      setStep(0)
      return
    }
    if (!itemSelectionValid) {
      setError('Vui lòng chọn đúng số lượng linh kiện Available cho từng dòng.')
      return
    }
    setError('')
    const success = await onIssue({
      photoId: photo.photoId,
      overrideReason: needsOverride ? overrideReason.trim() : null,
      units: selectableItems.map((line) => ({
        borrowItemId: line.borrowItemId,
        itemIds: (selectedByLine[line.borrowItemId] || []).map((item) => item.itemId),
      })),
    })
    if (success) onClose()
  }

  const canContinue = Boolean(
    photo?.photoId &&
    !uploading &&
    (!needsOverride || overrideReason.trim()),
  )
  const loadingItems = Object.values(loadingByLine).some(Boolean)
  const activeLine = selectableItems.find((line) => line.borrowItemId === selectedLineId)
  const activeAvailable = activeLine ? availableByLine[activeLine.borrowItemId] || [] : []
  const activeLoading = activeLine && Boolean(loadingByLine[activeLine.borrowItemId])
  const isHighValue = normalize(activeLine?.trackingType) === 'high_value'
  const activeSelected = activeLine ? selectedByLine[activeLine.borrowItemId] || [] : []
  const activeAvailableToSelect = activeAvailable.filter((item) => !selectedIdSet.has(item.itemId))
  const activeQuantityRemaining = activeLine
    ? Math.max(Number(activeLine.quantity) - activeSelected.length, 0)
    : 0
  const quickSelectDisabled = !activeLine ||
    activeLoading ||
    submitting ||
    activeQuantityRemaining === 0 ||
    activeAvailableToSelect.length === 0
  const searchTerm = normalize(itemSearch)
  const filteredAvailable = activeAvailable.filter((item) =>
    !searchTerm ||
    normalize(item.itemCode).includes(searchTerm) ||
    normalize(item.serialNumber).includes(searchTerm),
  )

  return (
    <Dialog
      open={open}
      onClose={() => { if (!submitting && !uploading) onClose() }}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>{request?.replacementLine ? 'Giao con thay thế' : 'Giao đồ'} · {request?.requestCode}</DialogTitle>
      <DialogContent>
        <Stepper
          activeStep={step}
          sx={{
            py: 1,
            maxWidth: 448,
            mx: 'auto',
            '& .MuiStepLabel-label': { fontSize: 12, fontWeight: 500 },
            '& .MuiStepIcon-root': { fontSize: 20 },
          }}
        >
          <Step><StepLabel>Chụp ảnh xác thực</StepLabel></Step>
          <Step><StepLabel>Chọn linh kiện giao</StepLabel></Step>
        </Stepper>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 ? (
          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{ p: { xs: 1.5, sm: 2 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            >
              <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  spacing={1.5}
                  sx={{ width: '100%', minWidth: 0 }}
                >
                  <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                    <Typography fontWeight={700}>Ảnh bàn giao</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Chụp linh kiện đặt cùng thẻ sinh viên để xác thực · Tối đa 5 MB
                    </Typography>
                  </Box>
                  <Button
                    component="label"
                    variant="outlined"
                    disabled={uploading || submitting}
                    sx={{ flex: '0 0 auto', alignSelf: { xs: 'stretch', sm: 'center' }, maxWidth: '100%' }}
                  >
                    {uploading ? <CircularProgress size={20} /> : photo ? 'Chụp lại' : 'Tải ảnh'}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelected}
                    />
                  </Button>
                </Stack>
                {uploading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Đang tải ảnh lên…</Typography>
                  </Box>
                )}
                {photoPreviewUrl && photo?.photoId && (
                  <Box
                    component="img"
                    src={photoPreviewUrl}
                    alt="Ảnh bàn giao đã tải lên"
                    sx={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 240,
                      objectFit: 'contain',
                      borderRadius: 1,
                      bgcolor: (theme) => alpha(theme.palette.common.black, 0.04),
                    }}
                  />
                )}
              </Stack>
            </Paper>
            {photo && (
              <Alert severity={needsOverride ? 'warning' : 'success'}>
                <Stack spacing={0.5}>
                  <Typography fontWeight={600}>
                    Trạng thái: {getAiStatusLabel(photo.aiResult)}
                  </Typography>
                  {needsOverride && (
                    <>
                      <Typography variant="body2">
                        Mã sinh viên trên đơn (cần tìm): <strong>{expectedStudentCode}</strong>
                      </Typography>
                      <Typography variant="body2">
                        Mã sinh viên AI quét được: <strong>{detectedStudentCode}</strong>
                      </Typography>
                    </>
                  )}
                  {!needsOverride && detectedStudentCode !== 'Không xác định' && (
                    <Typography variant="body2">
                      Mã sinh viên AI quét được: <strong>{detectedStudentCode}</strong>
                    </Typography>
                  )}
                </Stack>
              </Alert>
            )}
            {needsOverride && (
              <TextField
                required
                fullWidth
                multiline
                minRows={2}
                label="Lý do xác nhận thủ công"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value.slice(0, 500))}
                helperText={`${overrideReason.length}/500 ký tự`}
                inputProps={{ maxLength: 500 }}
              />
            )}
          </Stack>
        ) : (
          <Box>
            {loadingData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={1.5} alignItems="flex-start">
                <Grid
                  size={{ xs: 12, md: 5 }}
                  sx={{
                    minWidth: 0,
                    borderRight: { xs: 0, md: '1px solid #e2e8f0' },
                    pr: { xs: 0, md: 2.5 },
                  }}
                >
                  <Typography fontWeight={700} sx={{ mb: 1 }}>
                    Linh kiện trong đơn
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                    {items.map((line) => {
                      const consumable = isConsumable(line)
                      const selectedCount = (selectedByLine[line.borrowItemId] || []).length
                      const complete = consumable || selectedCount === Number(line.quantity)
                      const isActive = line.borrowItemId === selectedLineId
                      return (
                        <ButtonBase
                          key={line.borrowItemId}
                          disabled={consumable}
                          onClick={() => selectLine(line)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 1.25,
                            width: '100%',
                            p: 1.25,
                            border: '1px solid',
                            borderColor: isActive ? 'primary.main' : 'divider',
                            borderRadius: 1,
                            bgcolor: isActive ? '#eff6ff' : '#fff',
                            textAlign: 'left',
                            '&:hover': { bgcolor: consumable ? '#fff' : '#f8fafc' },
                            '&.Mui-disabled': { color: 'inherit', opacity: 1, cursor: 'default' },
                          }}
                        >
                          {complete ? (
                            <CheckCircleRoundedIcon sx={{ color: 'primary.main', flex: '0 0 auto' }} />
                          ) : (
                            <RadioButtonUncheckedRoundedIcon sx={{ color: '#64748b', flex: '0 0 auto' }} />
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={600} noWrap>
                              {line.componentName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                              <ComponentCodeTag code={line.componentCode} />
                              <Typography
                                variant="body2"
                                color={consumable || complete ? 'success.main' : 'text.secondary'}
                                noWrap
                              >
                                {consumable
                                  ? `${line.quantity} ${line.unit || 'cái'} · tự động trừ kho`
                                  : `Đã chọn ${selectedCount}/${line.quantity}`}
                              </Typography>
                            </Box>
                          </Box>
                        </ButtonBase>
                      )
                    })}
                  </Stack>
                </Grid>

                <Grid
                  size={{ xs: 12, md: 7 }}
                  sx={{
                    minWidth: 0,
                    alignSelf: 'flex-start',
                    pl: { xs: 0, md: 2.5 },
                  }}
                >
                  <Box sx={{ height: 'fit-content', alignSelf: 'flex-start' }}>
                    {!activeLine ? (
                      <Typography color="text.secondary">
                        Các vật tư tiêu hao sẽ tự động trừ kho khi xác nhận bàn giao.
                      </Typography>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2,
                            flexWrap: 'wrap',
                            mb: 1,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={700}>Mã con khả dụng</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {activeLine.componentName}
                              </Typography>
                              <ComponentCodeTag code={activeLine.componentCode} />
                            </Box>
                          </Box>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{ ml: 'auto', flex: '0 0 auto' }}
                          >
                            {activeAvailable.length > 6 && (
                              <TextField
                                size="small"
                                value={itemSearch}
                                onChange={(event) => setItemSearch(event.target.value)}
                                placeholder="Lọc mã con..."
                                inputProps={{ 'aria-label': 'Lọc mã con khả dụng' }}
                                sx={{ width: 170, flex: '0 0 auto' }}
                              />
                            )}
                            <Button
                              variant="contained"
                              disabled={quickSelectDisabled}
                              onClick={() => {
                                const additions = activeAvailableToSelect.slice(0, activeQuantityRemaining)
                                const nextSelection = [...activeSelected, ...additions]
                                setError('')
                                setSelectedByLine((current) => ({
                                  ...current,
                                  [activeLine.borrowItemId]: nextSelection,
                                }))
                                if (nextSelection.length === Number(activeLine.quantity)) {
                                  advanceToNextIncompleteLine(activeLine)
                                }
                              }}
                            >
                              Chọn nhanh
                            </Button>
                          </Stack>
                        </Box>
                        {activeLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : (
                          <TableContainer sx={{ maxHeight: 340, overflowY: 'auto' }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell padding="checkbox" />
                                  <TableCell>Mã con</TableCell>
                                  {isHighValue && <TableCell>Serial number</TableCell>}
                                  <TableCell>Trạng thái</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {filteredAvailable.map((inventoryItem) => {
                                  const selected = selectedByLine[activeLine.borrowItemId] || []
                                  const checked = selected.some((item) => item.itemId === inventoryItem.itemId)
                                  const assignedElsewhere = selectedIdSet.has(inventoryItem.itemId) && !checked
                                  const maxReached = selected.length >= Number(activeLine.quantity)
                                  const statusMeta = getItemStatusMeta(inventoryItem.status)
                                  return (
                                    <TableRow
                                      key={inventoryItem.itemId}
                                      hover
                                      sx={{ '&:last-child td, &:last-child th': { borderBottom: 0 } }}
                                    >
                                      <TableCell padding="checkbox">
                                        <Checkbox
                                          checked={checked}
                                          onChange={() => toggleItem(activeLine, inventoryItem)}
                                          disabled={assignedElsewhere || (!checked && maxReached)}
                                        />
                                      </TableCell>
                                      <TableCell>{inventoryItem.itemCode || '—'}</TableCell>
                                      {isHighValue && (
                                        <TableCell>{inventoryItem.serialNumber || '—'}</TableCell>
                                      )}
                                      <TableCell>
                                        <Box
                                          component="span"
                                          sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.25,
                                            border: '1px solid',
                                            borderRadius: '9999px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            ...statusMeta.sx,
                                          }}
                                        >
                                          {statusMeta.label}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                                {!filteredAvailable.length && (
                                  <TableRow>
                                    <TableCell colSpan={isHighValue ? 4 : 3} align="center">
                                      {activeAvailable.length
                                        ? 'Không tìm thấy mã con phù hợp.'
                                        : 'Không có linh kiện sẵn sàng tại lab này.'}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </>
                    )}
                  </Box>
                </Grid>
              </Grid>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting || uploading}>Hủy</Button>
        {step === 1 && (
          <Button onClick={() => { setError(''); setStep(0) }} disabled={submitting || uploading}>
            Quay lại
          </Button>
        )}
        {step === 0 ? (
          <Button
            variant="contained"
            disabled={!canContinue || submitting}
            onClick={() => { setError(''); setStep(1) }}
          >
            Tiếp tục
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!itemSelectionValid || loadingData || loadingItems || submitting}
            onClick={submitIssue}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận bàn giao'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
