import { useEffect, useState } from 'react'
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
import { inventoryService } from '../../services/inventoryService'

function getRows(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

function isConsumable(trackingType) {
  return normalize(trackingType) === 'consumable'
}

function isReusable(trackingType) {
  return normalize(trackingType) === 'reusable'
}

function isAvailable(item) {
  return normalize(item.status) === 'available'
}

export default function ReceiveTransferModal({ open, line, loading, onClose, onReceive }) {
  const [cabinets, setCabinets] = useState([])
  const [sourceCabinetIds, setSourceCabinetIds] = useState([])
  const [availableItems, setAvailableItems] = useState([])
  const [cabinetId, setCabinetId] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const consumable = isConsumable(line?.trackingType)
  const reusable = isReusable(line?.trackingType)
  const selectedItemIds = selectedItems.map((item) => item.itemId)

  useEffect(() => {
    if (!open || !line) return undefined

    let active = true
    const loadModalData = async () => {
      setLoadingData(true)
      setCabinets([])
      setSourceCabinetIds([])
      setAvailableItems([])
      setCabinetId('')
      setSelectedItems([])
      setBarcodeInput('')
      setError('')
      try {
        const [destinationCabinets, sourceCabinets] = await Promise.all([
          inventoryService.getCabinets({ roomId: line.pickupRoomId, page: 1, size: 100 }),
          inventoryService.getCabinets({ roomId: line.sourceRoomId, page: 1, size: 100 }),
        ])
        const roomCabinets = destinationCabinets.filter((cabinet) => cabinet.roomId === line.pickupRoomId)
        const originCabinets = sourceCabinets.filter((cabinet) => cabinet.roomId === line.sourceRoomId)
        if (!active) return
        setCabinets(roomCabinets)
        setSourceCabinetIds(originCabinets.map((cabinet) => cabinet.cabinetId))
        const firstEmptyCabinet = roomCabinets.find((cabinet) =>
          Number(cabinet.unitCount) === 0 && Number(cabinet.consumableQuantity) === 0,
        )
        setCabinetId(firstEmptyCabinet?.cabinetId || '')

        if (reusable && originCabinets.length) {
          const itemPages = await Promise.all(originCabinets.map((cabinet) =>
            inventoryService.getComponentItems({
              componentId: line.componentId,
              cabinetId: cabinet.cabinetId,
              status: 'Available',
              page: 1,
              size: 50,
            }),
          ))
          const itemsById = new Map()
          itemPages.flatMap(getRows).forEach((item) => {
            if (
              item.componentId === line.componentId &&
              originCabinets.some((cabinet) => cabinet.cabinetId === item.cabinetId) &&
              isAvailable(item) &&
              item.itemId
            ) {
              itemsById.set(item.itemId, item)
            }
          })
          if (active) {
            const items = [...itemsById.values()].slice(0, 50)
            setAvailableItems(items)
            setSelectedItems(items.slice(0, line.quantity))
          }
        }
      } catch (loadError) {
        if (active) {
          setError(extractErrorMessage(loadError, 'Không thể tải danh sách tủ hoặc linh kiện của Lab.'))
        }
      } finally {
        if (active) setLoadingData(false)
      }
    }

    loadModalData()
    return () => {
      active = false
    }
  }, [line, open, reusable])

  const toggleItem = (itemId) => {
    setError('')
    const item = availableItems.find((availableItem) => availableItem.itemId === itemId)
    if (!item) return
    setSelectedItems((current) => {
      if (current.some((selected) => selected.itemId === itemId)) {
        return current.filter((selected) => selected.itemId !== itemId)
      }
      if (current.length >= line.quantity) return current
      return [...current, item]
    })
  }

  const autoSelect = () => {
    setError('')
    setSelectedItems(availableItems.slice(0, line.quantity))
  }

  const handleAddByBarcode = async (event) => {
    event.preventDefault()
    const code = barcodeInput.trim()
    if (!code || !line || consumable) return
    if (selectedItemIds.length >= line.quantity) {
      setError(`Đã chọn đủ ${line.quantity} linh kiện.`)
      return
    }

    setScanning(true)
    setError('')
    try {
      const searchedItems = (await Promise.all(sourceCabinetIds.map((sourceCabinetId) =>
          inventoryService.getComponentItems({
            search: code,
            componentId: line.componentId,
            cabinetId: sourceCabinetId,
            status: 'Available',
            page: 1,
            size: 50,
          }),
        ))).flatMap(getRows)
      const matches = searchedItems.filter((item) =>
          item.componentId === line.componentId &&
          sourceCabinetIds.includes(item.cabinetId) &&
          isAvailable(item) &&
          normalize(reusable ? item.itemCode : item.serialNumber) === normalize(code),
      )

      const uniqueMatches = [...new Map(matches.map((item) => [item.itemId, item])).values()]
      if (uniqueMatches.length !== 1) {
        throw new Error(uniqueMatches.length
          ? 'Mã quét khớp với nhiều linh kiện. Vui lòng kiểm tra mã barcode.'
          : reusable
            ? 'Không tìm thấy itemCode trong danh sách linh kiện Available tại Lab xuất.'
            : 'Không tìm thấy serialNumber Available tại Lab xuất.')
      }

      const item = uniqueMatches[0]
      if (!item.itemId) throw new Error('Dữ liệu item tra cứu không có itemId.')
      if (selectedItemIds.includes(item.itemId)) throw new Error('Linh kiện này đã được chọn, không thể thêm trùng.')
      setSelectedItems((current) => current.length < line.quantity ? [...current, item] : current)
      if (reusable) {
        setAvailableItems((current) => current.some((availableItem) => availableItem.itemId === item.itemId)
          ? current
          : [...current, item])
      }
      setBarcodeInput('')
    } catch (scanError) {
      setError(extractErrorMessage(scanError, 'Không thể tra cứu mã linh kiện.'))
    } finally {
      setScanning(false)
    }
  }

  const submit = async () => {
    if (!line || !cabinetId) return
    if (!consumable && selectedItemIds.length !== line.quantity) {
      setError(`Cần chọn đúng ${line.quantity} linh kiện trước khi xác nhận nhận hàng.`)
      return
    }
    const success = await onReceive({
      borrowItemId: line.borrowItemId,
      toCabinetId: cabinetId,
      itemIds: consumable ? [] : selectedItemIds,
    })
    if (success) onClose()
  }

  const canSubmit = Boolean(
    line &&
    cabinetId &&
    !loadingData &&
    !loading &&
    !scanning &&
    (consumable || selectedItemIds.length === line.quantity),
  )

  return (
    <Dialog open={open} onClose={() => { if (!loading && !scanning) onClose() }} fullWidth maxWidth="sm">
      <DialogTitle>
        {line
          ? `Xác nhận điều chuyển ${line.quantity} ${line.unit || 'cái'} ${line.componentCode}`
          : 'Xác nhận điều chuyển'}
      </DialogTitle>
      <DialogContent>
        {line && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              select
              required
              fullWidth
              label="Chọn vị trí tủ nhận"
              value={cabinetId}
              onChange={(event) => setCabinetId(event.target.value)}
              disabled={loadingData || loading}
            >
              {cabinets.map((cabinet) => (
                <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>
                  {cabinet.cabinetCode} · {cabinet.cabinetName}
                </MenuItem>
              ))}
            </TextField>

            {loadingData && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!loadingData && !cabinets.length && (
              <Alert severity="warning">Lab nhận chưa có tủ lưu trữ khả dụng.</Alert>
            )}

            {!consumable && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: 'grey.50' }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      Danh sách thiết bị nhận ({selectedItemIds.length}/{line.quantity})
                    </Typography>
                    {reusable && availableItems.length > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={loadingData || availableItems.length < line.quantity}
                        onClick={autoSelect}
                      >
                        Chọn nhanh
                      </Button>
                    )}
                  </Stack>

                  <Box component="form" onSubmit={handleAddByBarcode}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label={reusable ? 'Quét hoặc nhập itemCode' : 'Quét hoặc nhập serialNumber'}
                        value={barcodeInput}
                        onChange={(event) => setBarcodeInput(event.target.value)}
                        disabled={loadingData || loading || scanning || selectedItemIds.length >= line.quantity}
                        inputProps={{ autoComplete: 'off' }}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        disabled={!barcodeInput.trim() || loadingData || loading || scanning || selectedItemIds.length >= line.quantity}
                      >
                        {scanning ? <CircularProgress size={20} /> : 'Thêm'}
                      </Button>
                    </Stack>
                  </Box>

                  {reusable && (
                    <TableContainer sx={{ maxHeight: 220, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox" />
                            <TableCell width={64}>STT</TableCell>
                            <TableCell>Mã con</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {availableItems.map((item, index) => {
                            const checked = selectedItemIds.includes(item.itemId)
                            return (
                              <TableRow key={item.itemId} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={checked}
                                    onChange={() => toggleItem(item.itemId)}
                                    disabled={!checked && selectedItemIds.length >= line.quantity}
                                    inputProps={{ 'aria-label': `Chọn linh kiện ${item.itemCode}` }}
                                  />
                                </TableCell>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontFamily="monospace">{item.itemCode}</Typography>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {!availableItems.length && !loadingData && (
                            <TableRow><TableCell colSpan={3} align="center">Không tìm thấy linh kiện Available tại Lab xuất.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {!reusable && (
                    <Typography variant="caption" color="text.secondary">
                      Đã quét {selectedItemIds.length}/{line.quantity} thiết bị.
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || scanning}>Đóng</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận đã nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
