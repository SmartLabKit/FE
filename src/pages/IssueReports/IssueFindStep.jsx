import { useRef } from 'react'
import { BadgeOutlined as CardIcon, Search as SearchIcon } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { formatVietnamDate } from '../../utils/dateFormatting'

/**
 * Bước 1: tìm đơn đang mượn (MSSV, tên, mã đơn, mã thiết bị hoặc quét thẻ sinh viên),
 * hoặc nhập mã thiết bị đang nằm trong tủ (không có đơn mượn).
 */
export default function IssueFindStep({
  mode,
  onModeChange,
  code,
  onCodeChange,
  onSearch,
  onScanCard,
  orders,
  onPickOrder,
  busy,
}) {
  const cardInput = useRef(null)
  const fromLoan = mode === 'loan'

  return (
    <>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        color="primary"
        value={mode}
        disabled={busy}
        onChange={(_, value) => value && onModeChange(value)}
      >
        <ToggleButton value="loan" sx={{ textTransform: 'none', fontWeight: 700 }}>Từ đơn mượn</ToggleButton>
        <ToggleButton value="cabinet" sx={{ textTransform: 'none', fontWeight: 700 }}>Thiết bị trong tủ</ToggleButton>
      </ToggleButtonGroup>

      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch(code)
        }}
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
      >
        <TextField
          key={mode}
          label={fromLoan ? 'MSSV, tên, mã đơn hoặc mã thiết bị' : 'Mã thiết bị hoặc serial'}
          placeholder="Nhập hoặc quét mã rồi Enter"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          autoFocus
          fullWidth
        />
        <Button
          type="submit"
          variant="outlined"
          disabled={!code.trim() || busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, height: 56, flexShrink: 0 }}
        >
          Tìm
        </Button>
      </Box>

      {fromLoan && (
        <Box>
          <Button
            variant="text"
            startIcon={<CardIcon />}
            disabled={busy}
            onClick={() => cardInput.current?.click()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Quét thẻ sinh viên
          </Button>
          <input
            ref={cardInput}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onScanCard(file)
            }}
          />
        </Box>
      )}

      {fromLoan && orders.length > 0 && (
        <Paper variant="outlined" sx={{ borderColor: '#d8dced' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, px: 2, pt: 1.5 }}>Chọn đơn đang mượn</Typography>
          <List dense>
            {orders.map((order) => (
              <ListItemButton key={order.borrowRequestId} disabled={busy} onClick={() => onPickOrder(order.borrowRequestId)}>
                <ListItemText
                  primary={`${order.requestCode} · ${order.requesterName}`}
                  secondary={[order.classCode, order.projectTitle, `hạn trả ${formatVietnamDate(order.dueDate)}`]
                    .filter(Boolean)
                    .join(' · ')}
                />
                {order.isOverdue && <Chip size="small" color="error" label="Quá hạn" />}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      <Typography variant="body2" color="text.secondary">
        {fromLoan
          ? 'Chỉ tìm trong các đơn đang mượn ở lab bạn phụ trách.'
          : 'Dùng cho thiết bị phát hiện hỏng hoặc mất trong tủ, không gắn với đơn mượn nào.'}
      </Typography>
    </>
  )
}
