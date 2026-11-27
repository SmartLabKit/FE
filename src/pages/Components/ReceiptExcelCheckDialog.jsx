import { useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { TableChart as ExcelIcon } from '@mui/icons-material'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { parseStockReceiptExcel } from '../../utils/excelHelper'
import { compareReceiptWithExcel } from './receiptCheck'

const STATUS = {
  unknown: { label: 'Mã không có', color: 'error' },
  missing: { label: 'Thiếu trong phiếu', color: 'error' },
  extra: { label: 'Không có trong file', color: 'warning' },
  diff: { label: 'Lệch', color: 'warning' },
  match: { label: 'Khớp', color: 'success' },
}

const quantityText = (value) => (value === null ? '—' : Number(value).toLocaleString('vi-VN'))

/** Chọn lại file Excel đã dùng để nhập, so từng linh kiện với phiếu. Chỉ xem, không sửa dữ liệu. */
export default function ReceiptExcelCheckDialog({ receiptCode, lines, onClose }) {
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    setResults(null)
    setFileName(file.name)
    try {
      const rows = await parseStockReceiptExcel(file).catch(() => null)
      if (!rows) {
        setError('Không đọc được file này. Hãy chọn file .xlsx, .xls hoặc .csv.')
        return
      }
      if (rows.length === 0) {
        setError('File Excel không có dòng hàng nào.')
        return
      }
      const [components, cabinets] = await Promise.all([
        inventoryService.getComponents(),
        inventoryService.getCabinets({ size: 100 }),
      ])
      setResults(compareReceiptWithExcel(lines, rows, components, cabinets))
    } catch (checkError) {
      setError(extractErrorMessage(checkError, 'Không thể tải dữ liệu để đối chiếu.'))
    } finally {
      setBusy(false)
    }
  }

  const wrong = results ? results.filter((r) => r.status !== 'match').length : 0
  const ownCount = results ? results.length : 0

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Đối chiếu {receiptCode} với Excel</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant={results ? 'outlined' : 'contained'}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ExcelIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {results ? 'Chọn file khác' : 'Chọn file Excel'}
            <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={check} />
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {fileName || 'Chọn lại file đã dùng để lập phiếu. Chỉ so sánh, không thay đổi phiếu.'}
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {results && (
          <>
            <Alert severity={wrong === 0 ? 'success' : 'warning'}>
              {wrong === 0
                ? `Khớp hết ${ownCount} linh kiện của phiếu.`
                : `${wrong}/${ownCount} linh kiện cần xem lại.`}
            </Alert>
            <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#faf9ff' }}>
                    {['Linh kiện', 'File', 'Phiếu', 'Kết quả', 'Chi tiết'].map((head) => (
                      <TableCell key={head} sx={{ fontWeight: 600 }}>{head}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.key}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{result.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#0058be', fontWeight: 700 }}>{result.code}</Typography>
                      </TableCell>
                      <TableCell>{quantityText(result.fileQuantity)}</TableCell>
                      <TableCell>{quantityText(result.receiptQuantity)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={STATUS[result.status].color} label={STATUS[result.status].label} />
                      </TableCell>
                      <TableCell>
                        {result.notes.length === 0
                          ? '—'
                          : result.notes.map((note) => <Typography key={note} variant="body2">{note}</Typography>)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
