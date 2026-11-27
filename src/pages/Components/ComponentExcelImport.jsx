import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  LinearProgress,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
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
import {
  ArrowBack as BackIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  ErrorOutlined as ErrorIcon,
  PictureAsPdf as PdfIcon,
  PlayCircle as YoutubeIcon,
  ReceiptLong as ReceiptIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { downloadComponentsTemplate, parseComponentsExcel } from '../../utils/excelHelper'
import { trackingTypeLabel } from '../../utils/trackingTypeLabel'
import {
  findDuplicateSpecKeys,
  getDisplayCode,
  generateComponentShortCode,
  normalizeSearchText,
  parseSpecsText,
} from './componentHelpers'

const TRACKING_TYPES = ['CONSUMABLE', 'REUSABLE', 'HIGH_VALUE']

const normalizeName = (name) => String(name || '').trim().toLowerCase()

/**
 * Tên linh kiện không được trùng (không phân biệt hoa thường), giống ràng buộc trong DB.
 * Trả về key dòng → lý do: đã có trong hệ thống, hoặc trùng với dòng được chọn đầu tiên cùng tên trong file.
 */
function getDuplicateMessages(rows, existingByName) {
  const firstSelectedByName = new Map()
  for (const row of rows) {
    const name = normalizeName(row.componentName)
    if (!name || firstSelectedByName.has(name)) continue
    if (row.selected || row.status === 'success') firstSelectedByName.set(name, row)
  }

  const messages = new Map()
  for (const row of rows) {
    if (row.status === 'success') continue
    const name = normalizeName(row.componentName)
    if (!name) continue

    const existing = existingByName.get(name)
    if (existing) {
      messages.set(row.key, `Đã có trong hệ thống (${getDisplayCode(existing) || existing.componentName})`)
      continue
    }

    const first = firstSelectedByName.get(name)
    if (first && first.key !== row.key) {
      messages.set(row.key, `Trùng tên với dòng #${first.rowNumber} trong file`)
    }
  }
  return messages
}

/**
 * Màn hình Nhập hàng loạt linh kiện kho từ file Excel (.xlsx / .xls / .csv).
 * Cho phép tải template mẫu (dữ liệu thực tế ngoài thị trường như HShop.vn), đọc file,
 * kiểm tra & chỉnh sửa trực tiếp từng dòng (tự sinh mã viết tắt kiểu thuốc y tế, khớp danh mục),
 * sau đó đẩy toàn bộ danh sách linh kiện lên hệ thống.
 */
export default function ComponentExcelImport() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [existingComponents, setExistingComponents] = useState([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importSummary, setImportSummary] = useState(null)
  const [summaryToastOpen, setSummaryToastOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const createdIds = rows.map((row) => row.componentId).filter(Boolean)

  const existingByName = useMemo(() => {
    const map = new Map()
    existingComponents.forEach((component) => {
      const name = normalizeName(component.componentName)
      if (name) map.set(name, component)
    })
    return map
  }, [existingComponents])

  useEffect(() => {
    let active = true
    Promise.all([
      inventoryService.getCategories(),
      inventoryService.getComponents().catch(() => []),
    ])
      .then(([catList, compList]) => {
        if (active) {
          setCategories(Array.isArray(catList) ? catList : [])
          setExistingComponents(Array.isArray(compList) ? compList : [])
        }
      })
      .catch((err) => {
        if (active) setError(extractErrorMessage(err, 'Không thể tải danh mục linh kiện.'))
      })
      .finally(() => {
        if (active) setLoadingInit(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Tự động tìm categoryId phù hợp theo tên danh mục trong Excel
  const matchCategoryId = (categoryName) => {
    if (!categoryName || !categories.length) return ''
    const norm = normalizeSearchText(categoryName)
    const exact = categories.find((c) => normalizeSearchText(c.categoryName) === norm)
    if (exact) return exact.categoryId
    const partial = categories.find(
      (c) =>
        normalizeSearchText(c.categoryName).includes(norm) ||
        norm.includes(normalizeSearchText(c.categoryName))
    )
    return partial ? partial.categoryId : ''
  }

  // Kiểm tra lỗi cho từng dòng dữ liệu trước khi đẩy lên hệ thống
  const validateRow = (row) => {
    const errors = []
    if (!row.componentName?.trim()) errors.push('Thiếu tên linh kiện')
    if (!row.categoryId) errors.push(`Không khớp danh mục "${row.categoryName || 'trống'}"`)
    if (!row.unit?.trim()) errors.push('Thiếu đơn vị tính')
    if (!TRACKING_TYPES.includes(row.trackingType)) errors.push(`Loại quản lý không hợp lệ: "${row.rawTracking || 'trống'}"`)
    const minStockText = String(row.minStock ?? '').trim()
    const minStock = Number(minStockText)
    if (minStockText === '') errors.push('Thiếu tồn tối thiểu (0 nếu không cần giữ sẵn)')
    else if (!Number.isInteger(minStock) || minStock < 0) errors.push('Tồn tối thiểu phải là số nguyên >= 0')
    const specs = parseSpecsText(row.specifications)
    if (specs.some((s) => s.specKey.length > 100)) errors.push('Tên thông số tối đa 100 ký tự')
    if (specs.some((s) => s.specValue.length > 255)) errors.push('Giá trị thông số tối đa 255 ký tự')
    const duplicateKeys = findDuplicateSpecKeys(specs)
    if (duplicateKeys.length > 0) errors.push(`Thông số bị trùng tên: ${duplicateKeys.join(', ')}`)
    return errors
  }

  // Đưa các dòng của file vào bảng, thay danh sách hiện tại
  const applyFileRows = (name, enriched) => {
    setFileName(name)
    const duplicates = getDuplicateMessages(enriched, existingByName)
    setRows(enriched.map((row) => (duplicates.has(row.key) ? { ...row, selected: false } : row)))
    setImportSummary(null)
  }

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')

    try {
      const parsed = await parseComponentsExcel(file)
      if (parsed.length === 0) {
        setError('File Excel không có dòng dữ liệu linh kiện nào. Vui lòng dùng đúng file mẫu.')
        return
      }
      const enriched = parsed.map((item, idx) => {
        const catId = matchCategoryId(item.categoryName)
        return {
          ...item,
          key: `imp-${Date.now()}-${idx}`,
          categoryId: catId,
          shortCode: item.shortCode || generateComponentShortCode(item.componentName, item.categoryName),
          selected: true,
          status: 'pending', // pending | success | error
          statusMessage: '',
        }
      })
      // Còn dòng chưa đẩy thì hỏi trước khi thay bằng file mới
      const unsent = rows.filter((row) => row.status !== 'success' && !existingByName.has(normalizeName(row.componentName)))
      if (unsent.length > 0) {
        setPendingFile({ name: file.name, rows: enriched })
        return
      }
      applyFileRows(file.name, enriched)
    } catch (parseErr) {
      setError(`Không thể đọc file Excel: ${parseErr.message || 'Định dạng không hợp lệ.'}`)
    }
  }

  const updateRow = (key, patch) => {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        const next = { ...row, ...patch, status: 'pending', statusMessage: '' }
        if (patch.componentName !== undefined && !row.manualCode) {
          next.shortCode = generateComponentShortCode(patch.componentName, row.categoryName)
        }
        return next
      })
    )
  }

  const removeRow = (key) => {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  const evaluatedRows = useMemo(() => {
    const duplicates = getDuplicateMessages(rows, existingByName)
    return rows.map((row) => {
      const errors = validateRow(row)
      if (duplicates.has(row.key)) errors.unshift(duplicates.get(row.key))
      const duplicateMessage = duplicates.get(row.key) || ''
      return { ...row, errors, isDuplicate: duplicates.has(row.key), existsAlready: duplicateMessage.startsWith('Đã có') }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categories, existingByName])

  const duplicateCount = useMemo(() => evaluatedRows.filter((row) => row.isDuplicate).length, [evaluatedRows])
  // Bảng chỉ giữ dòng còn cần xử lý: dòng đã tạo xong và dòng đã có sẵn trong hệ thống được ẩn đi
  const visibleRows = useMemo(
    () => evaluatedRows.filter((row) => row.status !== 'success' && !row.existsAlready),
    [evaluatedRows]
  )
  const existingCount = evaluatedRows.filter((row) => row.existsAlready).length

  const selectedValidRows = useMemo(
    () => evaluatedRows.filter((row) => row.selected && row.errors.length === 0 && row.status !== 'success'),
    [evaluatedRows]
  )

  const invalidCount = useMemo(
    () => evaluatedRows.filter((row) => row.selected && row.errors.length > 0).length,
    [evaluatedRows]
  )

  // Đẩy lần lượt các dòng hợp lệ lên Backend API
  const handleImportSubmit = async () => {
    if (selectedValidRows.length === 0) {
      setError('Không có dòng hợp lệ nào được chọn để đẩy lên hệ thống.')
      return
    }

    setImporting(true)
    setError('')
    setImportSummary(null)
    setProgress({ current: 0, total: selectedValidRows.length })

    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < selectedValidRows.length; i++) {
      const row = selectedValidRows[i]
      setProgress({ current: i + 1, total: selectedValidRows.length })

      const name = row.componentName.trim()
      const shortCode = (row.shortCode || generateComponentShortCode(name)).trim().toUpperCase()
      const minStockText = String(row.minStock ?? '').trim()

      const payload = {
        categoryId: row.categoryId,
        componentName: name,
        shortCode: shortCode || null,
        manufacturer: row.manufacturer?.trim() || null,
        description: row.description?.trim() || null,
        datasheetUrl: row.datasheetUrl?.trim() || null,
        trackingType: row.trackingType,
        unit: row.unit.trim(),
        minStock: minStockText === '' ? null : Number(minStockText),
        specs: parseSpecsText(row.specifications),
      }

      try {
        const saved = await inventoryService.createComponent(payload)
        const id = saved?.componentId || ''
        const apiCode = getDisplayCode(saved)

        const tutorialsToSave = []
        if (row.youtubeUrl?.trim()) {
          tutorialsToSave.push({
            title: `Video hướng dẫn ${name} (YouTube)`,
            url: row.youtubeUrl.trim(),
            content: `Video YouTube hướng dẫn đấu nối và sử dụng ${name}.`,
          })
        }
        if (row.pdfGuideUrl?.trim()) {
          tutorialsToSave.push({
            title: `Tài liệu PDF hướng dẫn ${name}`,
            url: row.pdfGuideUrl.trim(),
            content: `Tài liệu PDF hướng dẫn thực hành cho ${name}.`,
          })
        }

        const tutorialErrors = []
        if (id) {
          for (const tut of tutorialsToSave) {
            try {
              await inventoryService.createTutorial(id, tut)
            } catch (tutErr) {
              tutorialErrors.push(extractErrorMessage(tutErr, `Không lưu được "${tut.title}"`))
            }
          }
        }

        if (saved?.componentId) setExistingComponents((current) => [...current, saved])
        successCount += 1
        let message = apiCode ? `Đã tạo (${apiCode})` : 'Đã tạo thành công'
        if (tutorialErrors.length > 0) {
          message += `. Lỗi hướng dẫn: ${tutorialErrors.join('; ')}`
        }
        setRows((current) =>
          current.map((r) => (r.key === row.key ? { ...r, status: 'success', statusMessage: message, componentId: id } : r))
        )
      } catch (saveErr) {
        failedCount += 1
        const msg = extractErrorMessage(saveErr, 'Lỗi tạo linh kiện')
        setRows((current) =>
          current.map((r) => (r.key === row.key ? { ...r, status: 'error', statusMessage: msg } : r))
        )
      }
    }

    setImporting(false)
    setImportSummary({ successCount, failedCount })
    setSummaryToastOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <PortalLayout
      headerTitle="Nhập linh kiện từ file mẫu"
      headerSubtitle="Khai báo hàng loạt linh kiện kho từ file mẫu (.xlsx / .csv), tự sinh mã viết tắt tra cứu nhanh"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/class-setup/admin/components')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Danh sách linh kiện kho
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/class-setup/admin/components/new')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Nhập lẻ từng linh kiện
            </Button>
            <Button
              variant="outlined"
              startIcon={<ReceiptIcon />}
              onClick={() => navigate('/class-setup/admin/stock-inwards')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Nhập hàng mới
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {importSummary && (
          <Alert
            severity={importSummary.failedCount === 0 ? 'success' : 'warning'}
            sx={{ mb: 2 }}
            action={
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  onClick={() => navigate('/class-setup/admin/stock-inwards')}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Nhập hàng ngay
                </Button>
                {createdIds.length > 0 && (
                  <Button
                    size="small"
                    color="inherit"
                    variant="outlined"
                    onClick={() => navigate('/class-setup/admin/components?received=created', { state: { createdIds } })}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Xem linh kiện vừa tạo
                  </Button>
                )}
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => navigate('/class-setup/admin/components')}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Về danh sách
                </Button>
              </Stack>
            }
          >
            Hoàn tất đẩy danh sách: <strong>{importSummary.successCount} linh kiện thành công</strong>
            {importSummary.failedCount > 0 ? `, ${importSummary.failedCount} dòng lỗi.` : '.'} (Tồn kho sẽ tăng sau khi nhập hàng.)
          </Alert>
        )}

        {/* Bước 1 & 2: Tải template mẫu & Upload file Excel */}
        <Card variant="outlined" sx={{ mb: 2.5, borderColor: '#d8dced', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
              }}
            >
              {/* Bước 1 */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <ExcelIcon sx={{ color: '#16a34a' }} />
                  <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 15 }}>
                    Bước 1: Tải file mẫu Excel (.xlsx)
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 13, color: '#475569', mb: 2, lineHeight: 1.5 }}>
                  File mẫu có sẵn các cột cần điền, sheet hướng dẫn, danh sách danh mục và linh kiện hiện có để đối chiếu khi nhập.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  disabled={loadingInit}
                  onClick={() => downloadComponentsTemplate(categories, existingComponents)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#16a34a', color: '#15803d', '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' } }}
                >
                  Tải Template Linh Kiện (.xlsx)
                </Button>
              </Box>

              {/* Bước 2 */}
              <Box sx={{ p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px dashed #60a5fa' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <UploadIcon sx={{ color: '#0058be' }} />
                  <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 15 }}>
                    Bước 2: Tải lên file Excel để đọc &amp; kiểm tra
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 13, color: '#475569', mb: 2, lineHeight: 1.5 }}>
                  Chọn tệp <code>.xlsx</code>, <code>.xls</code> hoặc <code>.csv</code>. Hệ thống sẽ tự động kiểm tra lỗi,
                  khớp danh mục và tự sinh mã viết tắt cho các dòng để trống trước khi đẩy lên server.
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                  <Button
                    component="label"
                    variant="contained"
                    startIcon={<UploadIcon />}
                    disabled={importing}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                  >
                    Chọn file Excel
                    <input
                      hidden
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelected}
                    />
                  </Button>
                  {fileName && (
                    <Chip
                      label={fileName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Bước 3: Bảng xem trước & chỉnh sửa trước khi đẩy lên hệ thống */}
        {evaluatedRows.length > 0 && visibleRows.length === 0 && !importSummary && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Mọi linh kiện trong file đã có trong hệ thống, không cần nhập lại. Muốn có hàng để mượn thì vào{' '}
            <strong>Nhập kho</strong>.
          </Alert>
        )}

        {visibleRows.length > 0 && (
          <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 16 }}>
                    Bước 3: Xem trước danh sách ({visibleRows.length} linh kiện)
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap">
                    <Chip size="small" color="success" variant="outlined" label={`Sẵn sàng đẩy: ${selectedValidRows.length}`} sx={{ fontWeight: 700 }} />
                    {invalidCount > 0 && (
                      <Chip size="small" color="error" variant="outlined" label={`Cần sửa lỗi: ${invalidCount}`} sx={{ fontWeight: 700 }} />
                    )}
                    {existingCount > 0 && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Đã có trong hệ thống, bỏ qua: ${existingCount}`}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                    {duplicateCount - existingCount > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`Trùng tên trong file, đã bỏ chọn: ${duplicateCount - existingCount}`}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    disabled={importing}
                    onClick={() => {
                      setRows([])
                      setFileName('')
                      setImportSummary(null)
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Xóa danh sách
                  </Button>
                  <Button
                    variant="contained"
                    disabled={importing || selectedValidRows.length === 0}
                    onClick={handleImportSubmit}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                  >
                    {importing
                      ? `Đang đẩy ${progress.current}/${progress.total}...`
                      : `Đẩy ${selectedValidRows.length} linh kiện lên hệ thống`}
                  </Button>
                </Stack>
              </Box>

              {importing && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress.total ? (progress.current / progress.total) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              )}

              <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#faf9ff' }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={visibleRows.length > 0 && visibleRows.every((r) => r.selected)}
                          onChange={(e) => {
                            const shown = new Set(visibleRows.map((r) => r.key))
                            setRows((cur) => cur.map((r) => (shown.has(r.key) ? { ...r, selected: e.target.checked } : r)))
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Dòng</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 230 }}>Tên linh kiện (*)</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 145 }}>Mã viết tắt</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 170 }}>Danh mục (*)</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 145 }}>Loại quản lý</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 90 }}>Đơn vị</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 110 }}>Tồn tối thiểu (*)</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 105 }}>Tài liệu</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 170 }}>Trạng thái</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.map((row) => {
                      const hasError = row.errors.length > 0
                      return (
                        <TableRow
                          key={row.key}
                          sx={{
                            bgcolor:
                              row.status === 'success'
                                ? '#f0fdf4'
                                : row.status === 'error' || (row.selected && hasError)
                                  ? '#fef2f2'
                                  : undefined,
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              disabled={importing || row.status === 'success'}
                              checked={row.selected}
                              onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', fontSize: 12 }}>#{row.rowNumber}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              disabled={importing || row.status === 'success'}
                              value={row.componentName}
                              onChange={(e) => updateRow(row.key, { componentName: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              disabled={importing || row.status === 'success'}
                              value={row.shortCode}
                              onChange={(e) =>
                                updateRow(row.key, { shortCode: e.target.value.toUpperCase(), manualCode: true })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              fullWidth
                              error={!row.categoryId}
                              disabled={importing || row.status === 'success'}
                              value={row.categoryId}
                              onChange={(e) => {
                                const cat = categories.find((c) => c.categoryId === e.target.value)
                                updateRow(row.key, {
                                  categoryId: e.target.value,
                                  categoryName: cat?.categoryName || row.categoryName,
                                })
                              }}
                            >
                              <MenuItem value="">-- Chọn danh mục --</MenuItem>
                              {categories.map((cat) => (
                                <MenuItem key={cat.categoryId} value={cat.categoryId}>
                                  {cat.categoryName}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              fullWidth
                              disabled={importing || row.status === 'success'}
                              value={row.trackingType}
                              onChange={(e) => updateRow(row.key, { trackingType: e.target.value })}
                            >
                              {TRACKING_TYPES.map((t) => (
                                <MenuItem key={t} value={t}>
                                  {trackingTypeLabel(t)}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              disabled={importing || row.status === 'success'}
                              value={row.unit}
                              onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              fullWidth
                              disabled={importing || row.status === 'success'}
                              value={row.minStock}
                              onKeyDown={(e) => {
                                if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
                              }}
                              onChange={(e) => updateRow(row.key, { minStock: e.target.value })}
                              slotProps={{ htmlInput: { min: 0, step: 1 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {row.datasheetUrl && (
                                <Chip size="small" label="DS" sx={{ fontSize: 10, height: 20, bgcolor: '#e0f2fe', color: '#0369a1' }} />
                              )}
                              {row.youtubeUrl && (
                                <Chip
                                  size="small"
                                  icon={<YoutubeIcon sx={{ fontSize: 13 }} />}
                                  label="YT"
                                  sx={{ fontSize: 10, height: 20, bgcolor: '#fee2e2', color: '#b91c1c' }}
                                />
                              )}
                              {row.pdfGuideUrl && (
                                <Chip
                                  size="small"
                                  icon={<PdfIcon sx={{ fontSize: 13 }} />}
                                  label="PDF"
                                  sx={{ fontSize: 10, height: 20, bgcolor: '#fef3c7', color: '#b45309' }}
                                />
                              )}
                              {!row.datasheetUrl && !row.youtubeUrl && !row.pdfGuideUrl && (
                                <Typography fontSize={11} color="text.secondary">—</Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {row.status === 'success' ? (
                              <Chip
                                size="small"
                                color="success"
                                icon={<CheckCircleIcon />}
                                label={row.statusMessage || 'Thành công'}
                                sx={{ fontSize: 11, fontWeight: 600 }}
                              />
                            ) : row.status === 'error' ? (
                              <Typography fontSize={11.5} color="error" fontWeight={600}>
                                {row.statusMessage}
                              </Typography>
                            ) : hasError ? (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <ErrorIcon color="error" sx={{ fontSize: 15 }} />
                                <Typography fontSize={11.5} color="error">
                                  {row.errors.join('; ')}
                                </Typography>
                              </Stack>
                            ) : (
                              <Chip size="small" label="Hợp lệ" color="primary" variant="outlined" sx={{ fontSize: 11 }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              disabled={importing}
                              onClick={() => removeRow(row.key)}
                              sx={{ minWidth: 32, p: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Box>
      <Dialog open={Boolean(pendingFile)} onClose={() => setPendingFile(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>Thay danh sách hiện tại bằng file mới?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: '#3d4556', lineHeight: 1.6 }}>
            Bảng đang có <strong>{visibleRows.length} dòng chưa đẩy</strong>. File <strong>{pendingFile?.name}</strong> có{' '}
            {pendingFile?.rows.length} dòng.
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b', mt: 1 }}>
            Các dòng chưa đẩy sẽ bị bỏ. Muốn giữ thì bấm Hủy và đẩy chúng trước.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setPendingFile(null)} sx={{ textTransform: 'none' }}>Hủy</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              applyFileRows(pendingFile.name, pendingFile.rows)
              setPendingFile(null)
            }}
            sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            Thay bằng file mới
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={summaryToastOpen && Boolean(importSummary)}
        autoHideDuration={6000}
        onClose={() => setSummaryToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={importSummary?.failedCount === 0 ? 'success' : 'warning'}
          onClose={() => setSummaryToastOpen(false)}
          sx={{ width: '100%' }}
        >
          Đã tạo {importSummary?.successCount ?? 0} linh kiện
          {importSummary?.failedCount > 0 ? `, ${importSummary.failedCount} dòng lỗi` : ''}. Tồn kho tăng sau khi nhập kho.
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
