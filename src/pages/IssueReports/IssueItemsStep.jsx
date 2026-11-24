import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { labCode } from '../../utils/labLabel'

const LINE_STATUS = {
  Issued: { label: 'Đang mượn', color: 'primary' },
  Returned: { label: 'Đã trả', color: 'success' },
  Damaged: { label: 'Đã ghi nhận hỏng', color: 'error' },
  Lost: { label: 'Đã ghi nhận mất', color: 'error' },
  Pending: { label: 'Con thay thế, chờ giao', color: 'info' },
}

const isSelectable = (item) => item.status === 'Issued' && Boolean(item.itemCode)

function lineStatus(item) {
  if (item.status === 'Issued' && !item.itemCode) return { label: 'Vật tư tiêu hao', color: 'default' }
  return LINE_STATUS[item.status] || { label: item.status, color: 'default' }
}

/** Bước 2: xem đơn và chọn món bị hư. Món đã trả, đã ghi nhận và vật tư tiêu hao không chọn được. */
export default function IssueItemsStep({ order, busy, onPick }) {
  const items = [...(order.items || [])].sort((a, b) => Number(isSelectable(b)) - Number(isSelectable(a)))
  const hasSelectable = items.some(isSelectable)

  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.75, bgcolor: '#f8fafc', borderColor: '#d8dced' }}>
        <Typography sx={{ fontWeight: 800 }}>Đơn {order.requestCode}</Typography>
        <Typography variant="body2">
          {[order.requesterName, order.studentCode, order.classCode].filter(Boolean).join(' · ')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {[order.projectTitle, labCode(order, ''), `hạn trả ${formatVietnamDate(order.dueDate)}`].filter(Boolean).join(' · ')}
        </Typography>
      </Paper>

      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {hasSelectable ? 'Chọn món bị hư' : 'Đơn không còn thiết bị nào đang mượn'}
      </Typography>
      <Stack spacing={1}>
        {items.map((item) => {
          const selectable = isSelectable(item)
          const status = lineStatus(item)
          return (
            <Paper
              key={item.borrowItemId}
              variant="outlined"
              sx={{
                p: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                opacity: selectable ? 1 : 0.6,
                borderColor: '#d8dced',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.componentName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[
                    item.itemCode || item.componentCode,
                    item.serialNumber && `Serial ${item.serialNumber}`,
                    !item.itemCode && `${item.quantity} ${item.unit || ''}`,
                  ].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" color={status.color} label={status.label} />
              {selectable && (
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  disabled={busy}
                  onClick={() => onPick(item)}
                  sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                >
                  Món này hư
                </Button>
              )}
            </Paper>
          )
        })}
      </Stack>
    </>
  )
}
