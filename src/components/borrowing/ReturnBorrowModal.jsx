import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { alpha } from '@mui/material/styles'
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
  const [photo, setPhoto] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [cabinets, setCabinets] = useState([])
  const [cabinetId, setCabinetId] = useState('')
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
  const trackedSelectionsValid = lines
    .filter((item) => !isConsumable(item))
    .every((item) => ['Good', 'Damaged', 'Lost'].includes(conditions[item.borrowItemId] || 'Good'))
  const canSubmit = Boolean(
    photo?.photoId &&
    trackedSelectionsValid &&
    lines.length > 0 &&
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
      setPhoto(null)
      setPhotoPreviewUrl('')
      setCabinetId('')
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
    setPhoto(null)
    setPhotoPreviewUrl('')
    try {
      const result = await borrowService.uploadHandoverPhoto(request.borrowRequestId, file, 'Return')
      if (!result?.photoId) throw new Error('Phản hồi ảnh trả đồ không có photoId.')
      setPhoto(result)
      setPhotoPreviewUrl(URL.createObjectURL(file))
    } catch (uploadError) {
      setError(extractErrorMessage(uploadError, 'Không thể tải ảnh đồ trả.'))
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const submitReturn = async () => {
    if (!photo?.photoId) {
      setError('Cần chụp ảnh đồ trả trước khi xác nhận.')
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
      return {
        borrowItemId: item.borrowItemId,
        condition: conditions[item.borrowItemId] || 'Good',
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
      scroll="paper"
      PaperProps={{ sx: { maxHeight: 'calc(100% - 32px)' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>Nhận trả đồ · {request?.requestCode}</DialogTitle>
      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <Stack spacing={2} sx={{ py: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1.5}
                sx={{ width: '100%', minWidth: 0 }}
              >
                <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography fontWeight={700}>Ảnh linh kiện trả</Typography>
                    {photo?.photoId && (
                      <CheckCircleIcon color="success" sx={{ fontSize: 18 }} aria-label="Ảnh đã tải lên" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Chụp linh kiện nhận trả để lưu hồ sơ · Tối đa 5 MB
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
                  alt="Ảnh linh kiện trả đã tải lên"
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

          <Box>
            {loadingData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
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
                            Các thiết bị được ghi nhận trong đợt trả này. Điều chỉnh tình trạng nếu cần.
                          </Typography>
                        </Box>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Thiết bị</TableCell>
                                <TableCell>Mã cá thể</TableCell>
                                <TableCell>Tình trạng</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {lines.filter((item) => !isConsumable(item)).map((item) => (
                                <TableRow key={item.borrowItemId}>
                                  <TableCell>
                                    {item.componentName}
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {item.componentCode}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{item.itemCode || item.serialNumber || '—'}</TableCell>
                                  <TableCell>
                                    <Select
                                      size="small"
                                      value={conditions[item.borrowItemId] || 'Good'}
                                      onChange={(event) => setConditions((current) => ({
                                        ...current,
                                        [item.borrowItemId]: event.target.value,
                                      }))}
                                      sx={{ minWidth: 150 }}
                                    >
                                      <MenuItem value="Good">Bình thường</MenuItem>
                                      <MenuItem value="Damaged">Hỏng hóc</MenuItem>
                                      <MenuItem value="Lost">Bị mất</MenuItem>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Stack>
                    </Paper>
                )}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting || uploading}>Đóng</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={submitReturn}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
