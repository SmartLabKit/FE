import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import { extractErrorMessage } from '../../services/api'
import { borrowService } from '../../services/borrowService'
import { inventoryService } from '../../services/inventoryService'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function isConsumable(item) {
  return String(item.trackingType || '').toLowerCase() === 'consumable'
}

function remainingQuantity(item) {
  return Math.max(0, Number(item.quantity || 0) - Number(item.returnedQuantity || 0))
}

function getOpenReturnLines(items) {
  return (items || []).filter((item) => {
    if (isConsumable(item)) return remainingQuantity(item) > 0
    return !item.returnedAt && String(item.status || '').toLowerCase() !== 'returned'
  })
}

export default function ReturnBorrowModal({ request, open, submitting, onClose, onReturn }) {
  const [step, setStep] = useState(0)
  const [photo, setPhoto] = useState(null)
  const [cabinets, setCabinets] = useState([])
  const [cabinetId, setCabinetId] = useState('')
  const [selectedItems, setSelectedItems] = useState({})
  const [conditions, setConditions] = useState({})
  const [consumableQuantities, setConsumableQuantities] = useState({})
  const [loadingData, setLoadingData] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const requestId = request?.borrowRequestId
  const roomId = request?.roomId
  const lines = useMemo(() => getOpenReturnLines(request?.items), [request?.items])
  const openConsumables = lines.filter(isConsumable)
  const hasReturnedConsumables = openConsumables.some(
    (item) => Number(consumableQuantities[item.borrowItemId] || 0) > 0,
  )
  const trackedLinesToReturn = lines.filter((item) => !isConsumable(item) && selectedItems[item.borrowItemId])
  const trackedSelectionsValid = trackedLinesToReturn.every(
    (item) => ['Good', 'Damaged', 'Lost'].includes(conditions[item.borrowItemId]),
  )
  const canSubmit = Boolean(
    photo?.photoId &&
    trackedLinesToReturn.length + openConsumables.length > 0 &&
    trackedSelectionsValid &&
    (!hasReturnedConsumables || cabinetId) &&
    !loadingData &&
    !uploading &&
    !submitting,
  )

  useEffect(() => {
    if (!open || !requestId || !roomId) return undefined

    let active = true
    const timer = window.setTimeout(async () => {
      setLoadingData(true)
      setStep(0)
      setPhoto(null)
      setCabinetId('')
      setSelectedItems({})
      setConditions({})
      setConsumableQuantities({})
      setError('')
      try {
        const roomCabinets = await inventoryService.getCabinets({
          roomId,
          page: 1,
          size: 100,
        })
        if (active) {
          setCabinets(roomCabinets.filter((cabinet) => cabinet.roomId === roomId))
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách tủ của lab.'))
      } finally {
        if (active) setLoadingData(false)
      }
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, requestId, roomId])

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn ảnh linh kiện mang trả.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Ảnh không được vượt quá 5 MB.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const result = await borrowService.uploadHandoverPhoto(request.borrowRequestId, file, 'Return')
      if (!result?.photoId) throw new Error('Phản hồi ảnh trả đồ không có photoId.')
      setPhoto(result)
    } catch (uploadError) {
      setError(extractErrorMessage(uploadError, 'Không thể tải ảnh đồ trả.'))
    } finally {
      setUploading(false)
    }
  }

  const toggleTrackedItem = (item) => {
    setError('')
    setSelectedItems((current) => {
      const selected = !current[item.borrowItemId]
      if (!selected) {
        setConditions((currentConditions) => {
          const next = { ...currentConditions }
          delete next[item.borrowItemId]
          return next
        })
      } else {
        setConditions((currentConditions) => ({ ...currentConditions, [item.borrowItemId]: 'Good' }))
      }
      return { ...current, [item.borrowItemId]: selected }
    })
  }

  const submitReturn = async () => {
    if (!photo?.photoId) {
      setError('Cần chụp ảnh đồ trả trước khi xác nhận.')
      setStep(0)
      return
    }
    if (!trackedSelectionsValid) {
      setError('Vui lòng chọn tình trạng cho từng thiết bị được trả.')
      return
    }
    if (hasReturnedConsumables && !cabinetId) {
      setError('Vui lòng chọn tủ cất vật tư tiêu hao trả về.')
      return
    }

    const returnLines = lines.map((item) => {
      if (isConsumable(item)) {
        return {
          borrowItemId: item.borrowItemId,
          returnedQuantity: Number(consumableQuantities[item.borrowItemId] || 0),
        }
      }
      if (!selectedItems[item.borrowItemId]) return null
      return {
        borrowItemId: item.borrowItemId,
        condition: conditions[item.borrowItemId],
      }
    }).filter(Boolean)

    if (!returnLines.length) {
      setError('Chọn ít nhất một thiết bị hoặc xác nhận số lượng vật tư trả.')
      return
    }

    const success = await onReturn({
      photoId: photo.photoId,
      cabinetId: hasReturnedConsumables ? cabinetId : null,
      lines: returnLines,
    })
    if (success) onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={() => { if (!submitting && !uploading) onClose() }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Nhận trả đồ · {request?.requestCode}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {step === 0 ? (
            <Stack spacing={2}>
              <Alert severity="info">
                Chụp ảnh linh kiện mang trả để lưu nhận trả. Ảnh tối đa 5 MB.
              </Alert>
              <Button component="label" variant="outlined" disabled={uploading || submitting}>
                {uploading ? <CircularProgress size={20} /> : photo ? 'Chụp lại ảnh trả đồ' : 'Chụp ảnh đồ trả'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelected}
                />
              </Button>
              {photo && (
                <Alert severity="success">
                  Ảnh trả đồ đã tải lên thành công. Có thể tiếp tục phân loại tình trạng.
                </Alert>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {loadingData ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {!lines.length && (
                    <Alert severity="info">Đơn không còn linh kiện nào đang chờ trả.</Alert>
                  )}
                  {openConsumables.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={1.5}>
                        <Typography fontWeight={700}>Vật tư tiêu hao</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Nhập số lượng mang trả. Phần còn lại của dòng được tính là đã sử dụng.
                        </Typography>
                        {openConsumables.map((item) => {
                          const remaining = remainingQuantity(item)
                          const returned = Number(consumableQuantities[item.borrowItemId] || 0)
                          return (
                            <Stack
                              key={item.borrowItemId}
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1.5}
                              alignItems={{ xs: 'stretch', sm: 'center' }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography fontWeight={600}>{item.componentName} ({item.componentCode})</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Còn {remaining - returned} / {remaining} {item.unit || 'cái'} chưa trả
                                </Typography>
                              </Box>
                              <TextField
                                type="number"
                                size="small"
                                label="Số lượng trả"
                                value={consumableQuantities[item.borrowItemId] ?? 0}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isInteger(value) || value < 0 || value > remaining) return
                                  setConsumableQuantities((current) => ({
                                    ...current,
                                    [item.borrowItemId]: value,
                                  }))
                                }}
                                inputProps={{ min: 0, max: remaining, step: 1 }}
                                sx={{ width: { xs: '100%', sm: 150 } }}
                              />
                            </Stack>
                          )
                        })}
                        {hasReturnedConsumables && (
                          <TextField
                            select
                            required
                            fullWidth
                            label="Tủ cất vật tư trả về"
                            value={cabinetId}
                            onChange={(event) => setCabinetId(event.target.value)}
                            disabled={loadingData}
                          >
                            {cabinets.map((cabinet) => (
                              <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>
                                {cabinet.cabinetCode} · {cabinet.cabinetName}
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                        {hasReturnedConsumables && !cabinets.length && !loadingData && (
                          <Alert severity="warning">Lab chưa có tủ để cất vật tư trả về.</Alert>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  {lines.some((item) => !isConsumable(item)) && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Box>
                          <Typography fontWeight={700}>Thiết bị cần kiểm tra</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Chọn từng thiết bị trả trong đợt này, sau đó xác nhận tình trạng.
                          </Typography>
                        </Box>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell>Thiết bị</TableCell>
                                <TableCell>Mã cá thể</TableCell>
                                <TableCell>Tình trạng</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {lines.filter((item) => !isConsumable(item)).map((item) => (
                                <TableRow key={item.borrowItemId}>
                                  <TableCell padding="checkbox">
                                    <Checkbox
                                      checked={Boolean(selectedItems[item.borrowItemId])}
                                      onChange={() => toggleTrackedItem(item)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {item.componentName}
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {item.componentCode}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{item.itemCode || item.serialNumber || '—'}</TableCell>
                                  <TableCell>
                                    <TextField
                                      select
                                      size="small"
                                      value={conditions[item.borrowItemId] || ''}
                                      onChange={(event) => setConditions((current) => ({
                                        ...current,
                                        [item.borrowItemId]: event.target.value,
                                      }))}
                                      disabled={!selectedItems[item.borrowItemId]}
                                      label={selectedItems[item.borrowItemId] ? 'Tình trạng' : 'Chọn thiết bị'}
                                      sx={{ minWidth: 150 }}
                                    >
                                      <MenuItem value="Good">Bình thường</MenuItem>
                                      <MenuItem value="Damaged">Hỏng hóc</MenuItem>
                                      <MenuItem value="Lost">Bị mất</MenuItem>
                                    </TextField>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Stack>
                    </Paper>
                  )}
                </>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting || uploading}>Đóng</Button>
        {step === 1 && (
          <Button onClick={() => { setError(''); setStep(0) }} disabled={submitting || uploading}>
            Quay lại
          </Button>
        )}
        {step === 0 ? (
          <Button
            variant="contained"
            disabled={!photo?.photoId || uploading || loadingData || submitting}
            onClick={() => { setError(''); setStep(1) }}
          >
            Tiếp tục
          </Button>
        ) : (
          <Button variant="contained" disabled={!canSubmit} onClick={submitReturn}>
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận nhận trả'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
