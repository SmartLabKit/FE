import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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

function isAvailable(item) {
  return normalize(item.status) === 'available'
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
  const [overrideReason, setOverrideReason] = useState('')
  const [availableByLine, setAvailableByLine] = useState({})
  const [cabinetIds, setCabinetIds] = useState([])
  const [expandedByLine, setExpandedByLine] = useState({})
  const [loadedByLine, setLoadedByLine] = useState({})
  const [loadingByLine, setLoadingByLine] = useState({})
  const [selectedByLine, setSelectedByLine] = useState({})
  const [barcodeByLine, setBarcodeByLine] = useState({})
  const [loadingData, setLoadingData] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scanningLineId, setScanningLineId] = useState('')
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
  const itemSelectionValid = items.every((line) =>
    isConsumable(line) || (selectedByLine[line.borrowItemId] || []).length === Number(line.quantity),
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
      setExpandedByLine({})
      setLoadedByLine({})
      setLoadingByLine({})
      setSelectedByLine({})
      setBarcodeByLine({})
      setPhoto(null)
      setOverrideReason('')
      setStep(0)
      lineLoadsRef.current.clear()
      lineControllersRef.current.forEach((controller) => controller.abort())
      lineControllers.clear()
      try {
        if (items.every(isConsumable)) {
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

  const loadLineItems = async (line) => {
    const lineId = line.borrowItemId
    if (loadedByLine[lineId] || lineLoadsRef.current.has(lineId)) return

    lineLoadsRef.current.add(lineId)
    const controller = new AbortController()
    lineControllersRef.current.set(lineId, controller)
    setLoadingByLine((current) => ({ ...current, [lineId]: true }))
    setError('')
    try {
      const result = await inventoryService.getComponentItems({
        componentId: line.componentId,
        status: 'Available',
        page: 1,
        size: 100,
      }, { signal: controller.signal })
      const available = [...new Map(getRows(result)
        .filter((item) =>
          item.componentId === line.componentId &&
          cabinetIds.includes(item.cabinetId) &&
          isAvailable(item) &&
          item.itemId,
        )
        .map((item) => [item.itemId, item])).values()]
      setAvailableByLine((current) => ({ ...current, [lineId]: available }))
      setLoadedByLine((current) => ({ ...current, [lineId]: true }))
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setError(extractErrorMessage(loadError, `Không thể tải linh kiện ${line.componentCode}.`))
      }
    } finally {
      lineLoadsRef.current.delete(lineId)
      lineControllersRef.current.delete(lineId)
      setLoadingByLine((current) => ({ ...current, [lineId]: false }))
    }
  }

  const toggleLine = (line) => {
    const willExpand = !expandedByLine[line.borrowItemId]
    setExpandedByLine((current) => ({ ...current, [line.borrowItemId]: willExpand }))
    if (willExpand) loadLineItems(line)
  }

  const addItemToLine = (line, item) => {
    if (selectedIdSet.has(item.itemId)) {
      setError('Linh kiện này đã được chọn cho một dòng khác trong đơn.')
      return
    }
    setError('')
    setSelectedByLine((current) => {
      const selected = current[line.borrowItemId] || []
      if (selected.length >= Number(line.quantity)) return current
      return { ...current, [line.borrowItemId]: [...selected, item] }
    })
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
    addItemToLine(line, item)
  }

  const handleScanItem = async (event, line) => {
    event.preventDefault()
    const code = String(barcodeByLine[line.borrowItemId] || '').trim()
    if (!code) return
    const selected = selectedByLine[line.borrowItemId] || []
    if (selected.length >= Number(line.quantity)) {
      setError(`Dòng ${line.componentCode} đã chọn đủ ${line.quantity} linh kiện.`)
      return
    }

    setScanningLineId(line.borrowItemId)
    setError('')
    try {
      const result = await inventoryService.getComponentItems({
        search: code,
        componentId: line.componentId,
        status: 'Available',
        page: 1,
        size: 50,
      })
      const expectedCode = normalize(line.trackingType) === 'high_value' ? 'serialNumber' : 'itemCode'
      const matches = getRows(result).filter((item) =>
        item.componentId === line.componentId &&
        cabinetIds.includes(item.cabinetId) &&
        isAvailable(item) &&
        normalize(item[expectedCode]) === normalize(code),
      )
      const uniqueMatches = [...new Map(matches.map((item) => [item.itemId, item])).values()]
      if (uniqueMatches.length !== 1) {
        throw new Error(uniqueMatches.length
          ? 'Mã quét khớp với nhiều linh kiện. Vui lòng kiểm tra mã.'
          : `Không tìm thấy mã ${expectedCode === 'itemCode' ? 'itemCode' : 'serialNumber'} đang Available tại lab.`)
      }
      const matchedItem = uniqueMatches[0]
      addItemToLine(line, matchedItem)
      setAvailableByLine((current) => {
        const existing = current[line.borrowItemId] || []
        return existing.some((item) => item.itemId === matchedItem.itemId)
          ? current
          : { ...current, [line.borrowItemId]: [...existing, matchedItem] }
      })
      setLoadedByLine((current) => ({ ...current, [line.borrowItemId]: true }))
      setExpandedByLine((current) => ({ ...current, [line.borrowItemId]: true }))
      setBarcodeByLine((current) => ({ ...current, [line.borrowItemId]: '' }))
    } catch (scanError) {
      setError(extractErrorMessage(scanError, 'Không thể tra cứu mã linh kiện.'))
    } finally {
      setScanningLineId('')
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
    setOverrideReason('')
    try {
      const result = await borrowService.uploadHandoverPhoto(request.borrowRequestId, file, 'Issue')
      if (!result?.photoId || !result?.aiResult) {
        throw new Error('Phản hồi ảnh bàn giao thiếu photoId hoặc kết quả nhận diện.')
      }
      setPhoto(result)
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
      units: items.map((line) => ({
        borrowItemId: line.borrowItemId,
        itemIds: isConsumable(line)
          ? []
          : (selectedByLine[line.borrowItemId] || []).map((item) => item.itemId),
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

  return (
    <Dialog
      open={open}
      onClose={() => { if (!submitting && !uploading && !scanningLineId) onClose() }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Giao đồ · {request?.requestCode}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ py: 2 }}>
          <Step><StepLabel>Chụp ảnh xác thực</StepLabel></Step>
          <Step><StepLabel>Chọn linh kiện giao</StepLabel></Step>
        </Stepper>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 ? (
          <Stack spacing={2}>
            <Alert severity="info">
              Chụp ảnh các linh kiện đặt cùng thẻ sinh viên để xác thực bàn giao. Ảnh tối đa 5 MB.
            </Alert>
            <Button component="label" variant="outlined" disabled={uploading || submitting}>
              {uploading ? <CircularProgress size={20} /> : photo ? 'Chụp lại ảnh bàn giao' : 'Chụp ảnh bàn giao'}
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelected}
              />
            </Button>
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
                label="Lý do xác nhận thủ công / Override Reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value.slice(0, 500))}
                helperText={`${overrideReason.length}/500 ký tự`}
                inputProps={{ maxLength: 500 }}
              />
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {loadingData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
            ) : (
              <>
                {items.map((line) => {
                  if (isConsumable(line)) {
                    return (
                      <Paper key={line.borrowItemId} variant="outlined" sx={{ p: 2 }}>
                        <Typography fontWeight={600}>{line.componentName} ({line.componentCode})</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Giao {line.quantity} {line.unit || 'cái'} · Vật tư tiêu hao, hệ thống tự trừ kho.
                        </Typography>
                      </Paper>
                    )
                  }
                  const available = availableByLine[line.borrowItemId] || []
                  const selected = selectedByLine[line.borrowItemId] || []
                  const selectedForLine = new Set(selected.map((item) => item.itemId))
                  const maxReached = selected.length >= Number(line.quantity)
                  const codeField = normalize(line.trackingType) === 'high_value' ? 'serialNumber' : 'itemCode'
                  const lineLoading = Boolean(loadingByLine[line.borrowItemId])
                  const lineExpanded = Boolean(expandedByLine[line.borrowItemId])
                  return (
                    <Accordion
                      key={line.borrowItemId}
                      expanded={lineExpanded}
                      onChange={() => toggleLine(line)}
                      disableGutters
                      variant="outlined"
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box>
                          <Typography fontWeight={600}>{line.componentName} ({line.componentCode})</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Đã chọn {selected.length}/{line.quantity} · {line.trackingType}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        {lineLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : (
                          <Stack spacing={1.5}>
                        <Box component="form" onSubmit={(event) => handleScanItem(event, line)}>
                          <Grid container spacing={1}>
                            <Grid item xs>
                              <TextField
                                fullWidth
                                size="small"
                                label={normalize(line.trackingType) === 'high_value' ? 'Quét serialNumber' : 'Quét itemCode'}
                                value={barcodeByLine[line.borrowItemId] || ''}
                                onChange={(event) => setBarcodeByLine((current) => ({
                                  ...current,
                                  [line.borrowItemId]: event.target.value,
                                }))}
                                disabled={Boolean(scanningLineId) || maxReached || loadingData}
                              />
                            </Grid>
                            <Grid item>
                              <Button
                                type="submit"
                                variant="outlined"
                                disabled={!barcodeByLine[line.borrowItemId]?.trim() || Boolean(scanningLineId) || maxReached || loadingData}
                              >
                                {scanningLineId === line.borrowItemId ? <CircularProgress size={20} /> : 'Thêm'}
                              </Button>
                            </Grid>
                          </Grid>
                        </Box>
                        <TableContainer sx={{ maxHeight: 220 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell>{codeField === 'itemCode' ? 'Mã con' : 'Serial number'}</TableCell>
                                <TableCell>Trạng thái</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {available.map((inventoryItem) => {
                                const checked = selectedForLine.has(inventoryItem.itemId)
                                const assignedElsewhere = selectedIdSet.has(inventoryItem.itemId) && !checked
                                return (
                                  <TableRow key={inventoryItem.itemId} hover>
                                    <TableCell padding="checkbox">
                                      <Checkbox
                                        checked={checked}
                                        onChange={() => toggleItem(line, inventoryItem)}
                                        disabled={assignedElsewhere || (!checked && maxReached)}
                                      />
                                    </TableCell>
                                    <TableCell>{inventoryItem[codeField] || inventoryItem.itemCode || '—'}</TableCell>
                                    <TableCell>{inventoryItem.status}</TableCell>
                                  </TableRow>
                                )
                              })}
                              {!available.length && (
                                <TableRow>
                                  <TableCell colSpan={3} align="center">
                                    Không có linh kiện Available tại lab này.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                          </Stack>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  )
                })}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting || uploading || Boolean(scanningLineId)}>Hủy</Button>
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
            disabled={!itemSelectionValid || loadingData || loadingItems || submitting || Boolean(scanningLineId)}
            onClick={submitIssue}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận giao đồ'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
