import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogContent, TextField, Typography } from '@mui/material'
import { returnSlipService } from '../../services/returnSlipService'
import ReturnRow from './ReturnRow'
import { isConsumable, itemSubtitle } from './returnSlipHelpers'

/** Chọn món muốn trả rồi gửi lab duyệt. items: các món đang mượn chưa nằm trong phiếu nào. Lab chọn ngày khi duyệt. */
export default function ReturnSlipDialog({ borrowRequestId, items, preselected, onClose, onCreated }) {
  const [selected, setSelected] = useState(() => new Set((preselected || []).filter((id) => items.some((i) => i.borrowItemId === id))))
  const [quantities, setQuantities] = useState({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const all = selected.size === items.length
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
        note: note.trim() || null,
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
    <Dialog open onClose={(_event, reason) => reason !== 'backdropClick' && !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogContent sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Trả linh kiện</Typography>
        <Typography sx={{ fontSize: 14, color: '#64748b', mb: 1 }}>Lab sẽ báo ngày mang lên.</Typography>

        <ReturnRow
          title={<b>Trả hết</b>}
          before={
            <Checkbox
              checked={all}
              onChange={() => setSelected(all ? new Set() : new Set(items.map((i) => i.borrowItemId)))}
              sx={{ p: 0 }}
              slotProps={{ input: { 'aria-label': 'Trả hết' } }}
            />
          }
        />
        {items.map((item) => {
          const checked = selected.has(item.borrowItemId)
          return (
            <ReturnRow
              key={item.borrowItemId}
              title={item.componentName}
              subtitle={isConsumable(item) && checked ? 'Còn lại bao nhiêu? Dùng hết thì nhập 0.' : itemSubtitle(item)}
              before={
                <Checkbox
                  checked={checked}
                  onChange={() => toggle(item.borrowItemId)}
                  sx={{ p: 0 }}
                  slotProps={{ input: { 'aria-label': item.componentName } }}
                />
              }
              after={
                isConsumable(item) &&
                checked && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      value={quantities[item.borrowItemId] ?? ''}
                      onChange={(event) => {
                        setError('')
                        setQuantities((current) => ({ ...current, [item.borrowItemId]: event.target.value.trim() }))
                      }}
                      slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Số còn lại ${item.componentName}`, style: { textAlign: 'center' } } }}
                      sx={{ width: 74 }}
                    />
                    <Typography sx={{ fontSize: 14, color: '#64748b' }}>/ {item.quantity}</Typography>
                  </Box>
                )
              }
            />
          )
        })}

        <TextField
          fullWidth
          multiline
          placeholder="Ghi chú (không bắt buộc)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          sx={{ mt: 2 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Button
          fullWidth
          variant="contained"
          onClick={save}
          disabled={saving}
          sx={{ mt: 2.5, py: 1.25, textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
        >
          {saving ? 'Đang gửi…' : 'Gửi'}
        </Button>
        <Button fullWidth onClick={onClose} disabled={saving} sx={{ mt: 1, textTransform: 'none', color: '#64748b' }}>
          Đóng
        </Button>
      </DialogContent>
    </Dialog>
  )
}
