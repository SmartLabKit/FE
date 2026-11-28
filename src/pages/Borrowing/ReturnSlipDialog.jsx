import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, TextField, Typography } from '@mui/material'
import { AssignmentReturn as AssignmentReturnIcon } from '@mui/icons-material'
import { returnSlipService } from '../../services/returnSlipService'
import ReturnRow from './ReturnRow'
import { isConsumable, itemSubtitle } from './returnSlipHelpers'

/** Chọn món muốn trả rồi gửi lab duyệt. items: các món đang mượn chưa nằm trong phiếu nào. Lab chọn ngày khi duyệt. */
export default function ReturnSlipDialog({ borrowRequestId, items, preselected, onClose, onCreated }) {
  const [selected, setSelected] = useState(() => new Set((preselected || []).filter((id) => items.some((i) => i.borrowItemId === id))))
  const [quantities, setQuantities] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const all = selected.size === items.length
  const some = selected.size > 0 && !all
  const toggle = (id) => {
    setError('')
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const save = async () => {
    const chosen = items.filter((item) => selected.has(item.borrowItemId))
    if (chosen.length === 0) return setError('Chọn ít nhất 1 món.')
    const wrong = chosen.find((item) => {
      const text = quantities[item.borrowItemId] ?? ''
      return isConsumable(item) && (!/^\d+$/.test(text) || Number(text) > item.quantity)
    })
    if (wrong) return setError(`${wrong.componentName}: nhập số còn lại từ 0 đến ${wrong.quantity}.`)

    setSaving(true)
    setError('')
    try {
      const slip = await returnSlipService.create(borrowRequestId, {
        note: null,
        lines: chosen.map((item) => ({
          borrowItemId: item.borrowItemId,
          quantity: isConsumable(item) ? Number(quantities[item.borrowItemId]) : null,
        })),
      })
      onCreated(slip)
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={(_event, reason) => reason !== 'backdropClick' && !saving && onClose()}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', gap: 1.75, alignItems: 'center' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', color: '#0058be', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <AssignmentReturnIcon />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Trả linh kiện</Typography>
          <Typography sx={{ fontSize: 13.5, color: '#64748b' }}>Chọn món muốn trả. Lab duyệt rồi báo ngày mang lên.</Typography>
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, pt: 0 }}>
        <Box sx={{ border: '1px solid #e4e6ef', borderRadius: 2.5, overflow: 'hidden' }}>
          <Box
            onClick={() => setSelected(all ? new Set() : new Set(items.map((i) => i.borrowItemId)))}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f5', cursor: 'pointer' }}
          >
            <Checkbox
              checked={all}
              indeterminate={some}
              sx={{ p: 0 }}
              slotProps={{ input: { 'aria-label': 'Chọn tất cả' } }}
            />
            <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Chọn tất cả</Typography>
            <Typography sx={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Đã chọn {selected.size}/{items.length}
            </Typography>
          </Box>
          <Box sx={{ px: 2.5, maxHeight: 360, overflowY: 'auto' }}>
            {items.map((item) => {
              const checked = selected.has(item.borrowItemId)
              const consumable = isConsumable(item)
              return (
                <ReturnRow
                  key={item.borrowItemId}
                  selected={checked}
                  onClick={() => toggle(item.borrowItemId)}
                  title={item.componentName}
                  subtitle={consumable && checked ? 'Còn lại bao nhiêu? Dùng hết thì nhập 0.' : itemSubtitle(item)}
                  before={
                    <Checkbox
                      checked={checked}
                      sx={{ p: 0 }}
                      slotProps={{ input: { 'aria-label': item.componentName } }}
                    />
                  }
                  after={
                    consumable &&
                    checked && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }} onClick={(event) => event.stopPropagation()}>
                        <TextField
                          size="small"
                          value={quantities[item.borrowItemId] ?? ''}
                          placeholder="0"
                          onChange={(event) => {
                            setError('')
                            setQuantities((current) => ({ ...current, [item.borrowItemId]: event.target.value.trim() }))
                          }}
                          slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Số còn lại ${item.componentName}`, style: { textAlign: 'center' } } }}
                          sx={{ width: 68, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 1.5 } }}
                        />
                        <Typography sx={{ fontSize: 14, color: '#64748b' }}>/ {item.quantity}</Typography>
                      </Box>
                    )
                  }
                />
              )
            })}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b' }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || selected.size === 0}
          sx={{ px: 3, py: 1.1, textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0058be', boxShadow: 'none' }}
        >
          {saving ? 'Đang gửi…' : selected.size > 0 ? `Gửi phiếu trả · ${selected.size} món` : 'Gửi phiếu trả'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
