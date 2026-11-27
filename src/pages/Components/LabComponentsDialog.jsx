import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import { Close as RemoveIcon } from '@mui/icons-material'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { extractErrorMessage } from '../../services/api'
import { inventoryService } from '../../services/inventoryService'
import { getDisplayCode } from './componentHelpers'
import { suggestLabForCategory } from '../../utils/labSuggestion'

const headCellSx = { fontWeight: 700, color: '#334155' }

/**
 * Danh sách linh kiện một lab được nhận. Phiếu nhập của lab chỉ nhập được các linh kiện này,
 * dự án của môn học ở lab cũng chỉ chọn được các linh kiện này.
 * - canEdit (COMPONENT_MANAGE): thêm, bỏ linh kiện; linh kiện lab còn hàng thì không bỏ được.
 */
export default function LabComponentsDialog({ room, canEdit, onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [list, components] = await Promise.all([
          inventoryService.getLabRoomComponents(room.roomId),
          canEdit ? inventoryService.getComponents() : Promise.resolve([]),
        ])
        if (!active) return
        setRows(list)
        setCatalog(components.filter((component) => component.isActive !== false))
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách linh kiện của lab.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [room.roomId, canEdit])

  const labHint = (component) => suggestLabForCategory(catalog, component.categoryId)?.roomCode || ''

  const listedIds = useMemo(() => new Set(rows.map((row) => row.componentId)), [rows])
  const addable = useMemo(
    () => catalog.filter((component) => !listedIds.has(component.componentId)),
    [catalog, listedIds],
  )

  const keyword = search.trim().toLowerCase()
  const shown = rows.filter((row) => {
    if (!keyword) return true
    const text = `${row.componentName} ${row.shortCode || ''} ${row.componentCode} ${row.categoryName}`.toLowerCase()
    return text.includes(keyword)
  })

  const addPicked = () => {
    const added = picked.map((component) => ({
      componentId: component.componentId,
      componentCode: component.componentCode,
      shortCode: component.shortCode,
      componentName: component.componentName,
      categoryName: component.categoryName,
      trackingType: component.trackingType,
      unit: component.unit,
      quantityInLab: 0,
      isNew: true,
    }))
    setRows((current) => [...added, ...current])
    setPicked([])
    setDirty(true)
  }

  const removeRow = (componentId) => {
    setRows((current) => current.filter((row) => row.componentId !== componentId))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.updateLabRoomComponents(room.roomId, rows.map((row) => row.componentId))
      onSaved(`Đã cập nhật danh sách linh kiện của ${room.roomCode}.`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu danh sách linh kiện.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Linh kiện của lab · {room.roomCode} {room.roomName}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Phiếu nhập kho của lab chỉ nhập được các linh kiện trong danh sách. Dự án của môn học ở lab này cũng chỉ chọn được các linh kiện này,
          phần còn lại sinh viên ghi vào mục tự chuẩn bị.
        </Alert>

        {canEdit && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <Autocomplete
              multiple
              size="small"
              options={addable}
              value={picked}
              onChange={(event, value) => setPicked(value)}
              getOptionLabel={(option) => `${option.componentName} · ${getDisplayCode(option)}`}
              isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
              renderOption={(props, option) => {
                const { key, ...rest } = props
                return (
                  <Box component="li" key={key} {...rest} sx={{ display: 'block !important', py: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{option.componentName}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                      {getDisplayCode(option)} · {option.categoryName}
                      {option.roomCodes?.length ? ` · đang thuộc ${option.roomCodes.join(', ')}` : ' · chưa thuộc lab nào'}
                      {!option.roomCodes?.length && labHint(option) ? ` · nên vào ${labHint(option)}` : ''}
                    </Typography>
                  </Box>
                )
              }}
              renderInput={(params) => <TextField {...params} label="Thêm linh kiện vào lab" placeholder="Tìm theo tên hoặc mã" />}
              noOptionsText="Không còn linh kiện nào để thêm"
              sx={{ flex: 1 }}
              disabled={loading || saving}
            />
            <Button variant="outlined" onClick={addPicked} disabled={picked.length === 0 || saving} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
              Thêm {picked.length > 0 ? picked.length : ''}
            </Button>
          </Stack>
        )}

        <TextField
          size="small"
          fullWidth
          placeholder="Lọc trong danh sách"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{rows.length} linh kiện</Typography>

        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Linh kiện', 'Mã', 'Loại', 'Lab đang giữ', ''].map((head) => (
                  <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              )}
              {!loading && shown.map((row) => {
                const held = Number(row.quantityInLab || 0)
                return (
                  <TableRow key={row.componentId} hover sx={row.isNew ? { bgcolor: '#f0f7ff' } : undefined}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {row.componentName}
                      {row.isNew && <Typography component="span" sx={{ ml: 1, fontSize: 11, color: '#0058be' }}>mới thêm</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{row.shortCode || row.componentCode}</TableCell>
                    <TableCell><TrackingTypeBadge type={row.trackingType} /></TableCell>
                    <TableCell>{held > 0 ? `${held} ${row.unit || ''}`.trim() : '—'}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <Tooltip title={held > 0 ? 'Lab còn hàng nên chưa bỏ được' : 'Bỏ khỏi lab'}>
                          <span>
                            <IconButton size="small" onClick={() => removeRow(row.componentId)} disabled={held > 0 || saving}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {rows.length === 0 ? 'Lab chưa nhận linh kiện nào.' : 'Không có linh kiện phù hợp.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        {canEdit && (
          <Button variant="contained" onClick={save} disabled={saving || !dirty} sx={{ bgcolor: '#0058be' }}>
            {saving ? 'Đang lưu...' : 'Lưu danh sách'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
