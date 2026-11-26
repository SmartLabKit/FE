import { useState } from 'react'
import { DeleteOutlined as DeleteIcon } from '@mui/icons-material'
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const headCellSx = { fontWeight: 700, color: '#475569', fontSize: 12.5 }

/**
 * Nhân viên lab ghi thiết bị thừa khi kiểm: con có trong tủ mà danh sách không có.
 * Nhập mã trên nhãn, hoặc (không có nhãn) chọn linh kiện; quản lý kho xử lý từng con khi duyệt.
 */
export function AuditExtrasEditor({ extras, components, onChange }) {
  const [code, setCode] = useState('')
  const [noLabel, setNoLabel] = useState(false)
  const [component, setComponent] = useState(null)
  const [note, setNote] = useState('')

  const nameOf = (componentId) => components.find((c) => c.componentId === componentId)?.componentName || ''
  const canAdd = noLabel ? Boolean(component) : code.trim() !== ''

  const add = () => {
    if (!canAdd) return
    const itemCode = noLabel ? null : code.trim().toUpperCase()
    if (itemCode && extras.some((extra) => extra.itemCode === itemCode)) {
      setCode('')
      return
    }
    onChange([
      ...extras,
      {
        key: `x-${Date.now()}`,
        itemCode,
        componentId: noLabel ? component.componentId : null,
        note: note.trim() || null,
      },
    ])
    setCode('')
    setComponent(null)
    setNote('')
  }

  return (
    <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #eef0f6' }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Thiết bị thừa ({extras.length})</Typography>
      <Typography sx={{ fontSize: 12.5, color: '#64748b', mb: 1 }}>
        Có trong tủ mà danh sách không có. Ghi lại để quản lý kho xử lý, tồn kho không tự cộng thêm.
      </Typography>

      {extras.length > 0 && (
        <Box sx={{ mb: 1 }}>
          {extras.map((extra) => (
            <Box key={extra.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13.5, flex: 1 }}>
                {extra.itemCode || `Không có nhãn · ${nameOf(extra.componentId)}`}
                {extra.note ? ` — ${extra.note}` : ''}
              </Typography>
              <IconButton size="small" title="Bỏ" onClick={() => onChange(extras.filter((item) => item.key !== extra.key))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {noLabel ? (
          <Autocomplete
            size="small"
            options={components}
            value={component}
            onChange={(_event, value) => setComponent(value)}
            getOptionLabel={(option) => option.componentName || ''}
            isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
            renderInput={(params) => <TextField {...params} placeholder="Linh kiện" />}
            sx={{ width: 260 }}
          />
        ) : (
          <TextField
            size="small"
            placeholder="Mã trên nhãn"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
            }}
            sx={{ width: 180 }}
          />
        )}
        <TextField size="small" placeholder="Ghi chú (không bắt buộc)" value={note} onChange={(event) => setNote(event.target.value)} sx={{ width: 220 }} />
        <FormControlLabel
          control={<Checkbox size="small" checked={noLabel} onChange={(event) => setNoLabel(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 13 }}>Không có nhãn</Typography>}
        />
        <Button size="small" variant="outlined" onClick={add} disabled={!canAdd} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Thêm
        </Button>
      </Box>
    </Box>
  )
}

/** Tình trạng của con thừa theo mã nhãn, kèm việc cần làm. */
function describe(extra) {
  switch (extra.resolution) {
    case 'OtherCabinet':
      return `Thuộc tủ ${extra.itemCabinetCode} (${extra.itemRoomCode}), để nhầm tủ.`
    case 'Lost':
      return `Đã báo thất lạc trước đây (tủ ${extra.itemCabinetCode}), nay tìm lại.`
    case 'Borrowed':
      return `Còn ghi đang cho mượn trong đơn ${extra.borrowRequestCode || ''}: sinh viên đã trả mà lab chưa nhận trả.`
    case 'InThisCabinet':
      return 'Đã thuộc tủ này.'
    case 'Retired':
      return 'Thiết bị đã ngừng dùng.'
    case 'Unknown':
      return 'Mã không có trong hệ thống: hàng chưa từng nhập kho.'
    default:
      return 'Không có nhãn: hàng chưa từng nhập kho.'
  }
}

/**
 * Quản lý kho xem thiết bị thừa của phiên kiểm và xử lý từng con: chuyển về tủ này, khôi phục,
 * nhắc nhận trả, hoặc lập phiếu nhập kho.
 */
export function AuditExtrasReview({ audit, canResolve, receipts, onResolved, onError }) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState('')
  const extras = audit?.extras || []
  if (extras.length === 0) return null

  const run = async (extra, request, done) => {
    setBusyId(extra.extraId)
    try {
      await inventoryService.moveComponentItems(request)
      await onResolved(done)
    } catch (actionError) {
      onError(extractErrorMessage(actionError, 'Không xử lý được thiết bị này.'))
    } finally {
      setBusyId('')
    }
  }

  const moveHere = (extra) =>
    run(
      extra,
      {
        componentId: extra.componentId,
        fromCabinetId: extra.itemCabinetId,
        fromStatus: 'Available',
        itemIds: [extra.itemId],
        toCabinetId: audit.cabinetId,
        reason: 'Kiểm kê: thiết bị để nhầm tủ, chuyển về tủ đang để',
      },
      `Đã chuyển ${extra.itemCode} về tủ này.`
    )

  const restore = (extra) => {
    const request = {
      componentId: extra.componentId,
      fromCabinetId: extra.itemCabinetId,
      fromStatus: 'Lost',
      itemIds: [extra.itemId],
      toStatus: 'Available',
      reason: 'Kiểm kê: tìm thấy lại thiết bị thất lạc',
    }
    if (extra.sameLab) request.toCabinetId = audit.cabinetId
    return run(extra, request, `Đã khôi phục ${extra.itemCode}.`)
  }

  // Phiếu nhập điền sẵn: lab của tủ đã kiểm, đúng linh kiện, 1 cái, hàng cho tặng, ghi chú nguồn gốc
  const openReceipt = (extra) => {
    let origin = 'không có nhãn'
    if (extra.itemCode) origin = `nhãn ${extra.itemCode} không có trong hệ thống`
    const parts = [`Phát hiện khi kiểm kê tủ ${audit.cabinetCode} (${audit.roomCode}), ${origin}`]
    if (extra.note) parts.push(extra.note)
    navigate('/class-setup/admin/stock-inwards', {
      state: {
        fromAudit: {
          auditId: audit.auditId,
          extraId: extra.extraId,
          roomId: audit.roomId,
          cabinetId: audit.cabinetId,
          componentId: extra.componentId || '',
          note: parts.join('. '),
        },
      },
    })
  }

  const actionOf = (extra) => {
    const busy = busyId === extra.extraId
    const button = (label, onClick) => (
      <Button size="small" variant="outlined" disabled={busy} onClick={onClick} sx={{ textTransform: 'none', fontWeight: 700 }}>
        {label}
      </Button>
    )
    if (extra.resolution === 'InThisCabinet') return <Typography sx={{ fontSize: 13, color: '#16a34a' }}>Đã xong</Typography>
    if (!canResolve) return null
    if (extra.resolution === 'OtherCabinet' && extra.sameLab) return button('Chuyển về tủ này', () => moveHere(extra))
    if (extra.resolution === 'OtherCabinet') return <Typography sx={{ fontSize: 13 }}>Khác lab: mang trả về {extra.itemRoomCode}</Typography>
    if (extra.resolution === 'Lost') return button(extra.sameLab ? 'Khôi phục về tủ này' : 'Khôi phục', () => restore(extra))
    if (extra.resolution === 'Borrowed' && extra.borrowRequestId) {
      return button('Mở đơn mượn', () => navigate(`/borrow/requests/${extra.borrowRequestId}`))
    }
    if (extra.resolution === 'Unknown' || extra.resolution === 'NoLabel') {
      const done = receipts?.[extra.extraId]
      if (done) {
        return (
          <Button size="small" color="success" onClick={() => navigate(`/class-setup/admin/stock-receipts/${done.receiptId}`)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Đã lập phiếu {done.receiptCode}
          </Button>
        )
      }
      return button('Lập phiếu nhập kho', () => openReceipt(extra))
    }
    return null
  }

  return (
    <Box sx={{ p: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#faf9ff' }}>
            <TableCell sx={headCellSx}>Mã / linh kiện</TableCell>
            <TableCell sx={headCellSx}>Tình trạng</TableCell>
            <TableCell sx={headCellSx} align="right">Xử lý</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {extras.map((extra) => (
            <TableRow key={extra.extraId}>
              <TableCell>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{extra.itemCode || 'Không có nhãn'}</Typography>
                <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                  {[extra.componentName, extra.serialNumber && `S/N ${extra.serialNumber}`, extra.note].filter(Boolean).join(' · ')}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: 13 }}>{describe(extra)}</TableCell>
              <TableCell align="right">{actionOf(extra)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}
