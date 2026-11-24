import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
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
    return String(item.status || '').toLowerCase() === 'issued' && !item.returnedAt
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
  const [damagePhotos, setDamagePhotos] = useState({})
  const [uploadingLineId, setUploadingLineId] = useState('')
  const [error, setError] = useState('')

  const requestId = request?.borrowRequestId
  const roomId = request?.roomId
  const lines = useMemo(() => getOpenReturnLines(request?.items), [request?.items])
  const alreadyReturnedItems = useMemo(() => {
    return (request?.items || []).filter((item) => {
      if (isConsumable(item)) {
        return Number(item.returnedQuantity || 0) >= Number(item.quantity || 0)
      }
      return Boolean(item.returnedAt) || String(item.status || '').toLowerCase() === 'returned'
    })
  }, [request?.items])

  const openConsumables = lines.filter(isConsumable)
  const hasReturnedConsumables = openConsumables.some(
    (item) => Number(consumableQuantities[item.borrowItemId] || 0) > 0,
  )
  const trackedSelectionsValid = lines
    .filter((item) => !isConsumable(item))
    .every((item) => ['Good', 'Damaged', 'Lost', 'NotReturned'].includes(conditions[item.borrowItemId] || 'Good'))

  const returningTrackedCount = lines
    .filter((item) => !isConsumable(item))
    .filter((item) => (conditions[item.borrowItemId] || 'Good') !== 'NotReturned').length
  const returningConsumablesCount = openConsumables
    .filter((item) => Number(consumableQuantities[item.borrowItemId] || 0) > 0).length
  const hasReturningItems = returningTrackedCount > 0 || returningConsumablesCount > 0

  const damagePhotosReady = lines
    .filter((item) => !isConsumable(item) && conditions[item.borrowItemId] === 'Damaged')
    .every((item) => damagePhotos[item.borrowItemId]?.photoId)

  const canSubmit = Boolean(
    photo?.photoId &&
    damagePhotosReady &&
    !uploadingLineId &&
    trackedSelectionsValid &&
    hasReturningItems &&
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
      setDamagePhotos({})
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

  const handleDamagePhotoSelected = async (item, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn ảnh thiết bị bị hỏng.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Ảnh không được vượt quá 5 MB.')
      return
    }

    setUploadingLineId(item.borrowItemId)
    setError('')
    try {
      const result = await borrowService.uploadHandoverPhoto(request.borrowRequestId, file, 'Return')
      if (!result?.photoId) throw new Error('Phản hồi ảnh thiết bị hỏng không có photoId.')
      setDamagePhotos((current) => ({ ...current, [item.borrowItemId]: result }))
    } catch (uploadError) {
      setError(extractErrorMessage(uploadError, 'Không thể tải ảnh thiết bị hỏng.'))
    } finally {
      setUploadingLineId('')
    }
  }

  const submitReturn = async () => {
    if (!photo?.photoId) {
      setError('Cần chụp ảnh đồ trả trước khi xác nhận.')
      return
    }
    if (hasReturnedConsumables && !cabinetId) {
      setError('Vui lòng chọn tủ cất vật tư tiêu hao trả về.')
      return
    }

    const returnLines = lines
      .map((item) => {
        if (isConsumable(item)) {
          const qty = Number(consumableQuantities[item.borrowItemId] || 0)
          if (qty <= 0) return null
          return {
            borrowItemId: item.borrowItemId,
            returnedQuantity: qty,
          }
        }
        const condition = conditions[item.borrowItemId] || 'Good'
        if (condition === 'NotReturned') {
          return null
        }
        return {
          borrowItemId: item.borrowItemId,
          condition,
          damagePhotoId: condition === 'Damaged' ? damagePhotos[item.borrowItemId]?.photoId : null,
        }
      })
      .filter(Boolean)

    if (!returnLines.length) {
      setError('Vui lòng chọn tình trạng nhận trả (khác "Chưa trả") cho ít nhất một thiết bị hoặc xác nhận số lượng vật tư trả.')
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
      onClose={() => { if (!submitting && !uploading && !uploadingLineId) onClose() }}
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

                {alreadyReturnedItems.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography fontWeight={700} sx={{ color: '#334155', fontSize: 14 }}>
                        Thiết bị đã trả ở đợt trước ({alreadyReturnedItems.length} món)
                      </Typography>
                      <Chip size="small" label="Đã hoàn tất trả" color="success" sx={{ fontSize: 11, fontWeight: 700 }} />
                    </Box>
                    <Stack spacing={1}>
                      {alreadyReturnedItems.map((item) => (
                        <Box
                          key={`already-${item.borrowItemId}`}
                          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px dashed #e2e8f0' }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                              {item.componentName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {item.itemCode || item.componentCode || '—'}
                            </Typography>
                          </Box>
                          <Chip size="small" label="Đã trả" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }} />
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {lines.some((item) => !isConsumable(item)) && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Box>
                          <Typography fontWeight={700}>Thiết bị cần kiểm tra</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Các thiết bị được ghi nhận trong đợt trả này. Bạn có thể chọn &quot;Chưa trả&quot; nếu sinh viên chưa mang trả thiết bị đó đợt này.
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
                              {lines.filter((item) => !isConsumable(item)).map((item) => {
                                const currentCond = conditions[item.borrowItemId] || 'Good'
                                return (
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
                                        value={currentCond}
                                        onChange={(event) => setConditions((current) => ({
                                          ...current,
                                          [item.borrowItemId]: event.target.value,
                                        }))}
                                        sx={{
                                          minWidth: 150,
                                          bgcolor: currentCond === 'NotReturned' ? '#fffbeb' : '#ffffff',
                                          color: currentCond === 'NotReturned' ? '#b45309' : 'inherit',
                                          fontWeight: currentCond === 'NotReturned' ? 700 : 500,
                                        }}
                                      >
                                        <MenuItem value="Good">Bình thường</MenuItem>
                                        <MenuItem value="Damaged">Hỏng hóc</MenuItem>
                                        <MenuItem value="Lost">Bị mất</MenuItem>
                                        <MenuItem value="NotReturned" sx={{ color: '#b45309', fontWeight: 700, bgcolor: '#fffbeb' }}>
                                          Chưa trả
                                        </MenuItem>
                                      </Select>
                                      {currentCond === 'Damaged' && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                          {damagePhotos[item.borrowItemId] && (
                                            <Box
                                              component="img"
                                              src={damagePhotos[item.borrowItemId].photoUrl}
                                              alt={`Ảnh hỏng ${item.itemCode || ''}`}
                                              sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, border: '1px solid #e2e8f0' }}
                                            />
                                          )}
                                          <Button
                                            component="label"
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            disabled={Boolean(uploadingLineId) || uploading || submitting}
                                            sx={{ textTransform: 'none', fontWeight: 700 }}
                                          >
                                            {uploadingLineId === item.borrowItemId
                                              ? <CircularProgress size={18} />
                                              : damagePhotos[item.borrowItemId] ? 'Chụp lại' : 'Chụp ảnh hỏng (bắt buộc)'}
                                            <input
                                              hidden
                                              type="file"
                                              accept="image/*"
                                              capture="environment"
                                              onChange={(event) => {
                                                const file = event.target.files?.[0]
                                                event.target.value = ''
                                                handleDamagePhotoSelected(item, file)
                                              }}
                                            />
                                          </Button>
                                        </Box>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
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
