import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { findDuplicateSpecKeys, generateComponentShortCode, isYoutubeUrl, parseSpecsText } from './componentHelpers'

const TRACKING_TYPES = [
  { value: 'CONSUMABLE', label: 'Tiêu hao (dùng một lần)' },
  { value: 'REUSABLE', label: 'Tái sử dụng (quản lý từng chiếc)' },
  { value: 'HIGH_VALUE', label: 'Giá trị cao (có Serial & Bảo hành)' },
]

const TWO_COLUMNS = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }

const isHttpUrl = (url) => /^https?:\/\/\S+\.\S+/i.test(url)

/** Lỗi đầu tiên của biểu mẫu, hợp lệ thì trả ''. Chỉ tên, danh mục, loại quản lý, đơn vị và tồn tối thiểu là bắt buộc. */
function validate(form) {
  const minStock = form.minStock.trim()
  const duplicates = findDuplicateSpecKeys(parseSpecsText(form.specifications))
  if (!form.componentName.trim()) return 'Nhập tên linh kiện.'
  if (!form.categoryId) return 'Chọn danh mục.'
  if (!form.trackingType) return 'Chọn loại quản lý.'
  if (!form.unit.trim()) return 'Nhập đơn vị tính.'
  if (!minStock) return 'Nhập tồn tối thiểu (0 nếu không cần giữ sẵn).'
  if (!/^\d+$/.test(minStock)) return 'Tồn tối thiểu phải là số nguyên từ 0.'
  if (!/^[A-Za-z0-9.-]*$/.test(form.shortCode.trim())) return 'Mã viết tắt chỉ gồm chữ không dấu, số, dấu chấm và gạch ngang.'
  if (duplicates.length > 0) return `Thông số bị trùng tên: ${duplicates.join(', ')}.`
  if (form.datasheetUrl.trim() && !isHttpUrl(form.datasheetUrl.trim())) return 'Link datasheet phải bắt đầu bằng http:// hoặc https://.'
  if (form.youtubeUrl.trim() && !isYoutubeUrl(form.youtubeUrl.trim())) {
    return 'Link YouTube không đúng định dạng (VD: https://www.youtube.com/watch?v=...).'
  }
  if (form.pdfGuideUrl.trim() && !isHttpUrl(form.pdfGuideUrl.trim())) return 'Link PDF hướng dẫn phải bắt đầu bằng http:// hoặc https://.'
  return ''
}

/** Tải ảnh, file datasheet và lưu hướng dẫn cho linh kiện vừa tạo; trả về danh sách lỗi, không dừng giữa chừng. */
async function saveExtras(id, name, form, images, datasheet) {
  const errors = []
  const run = async (action, message) => {
    try {
      await action()
    } catch (extraError) {
      errors.push(`${message}: ${extractErrorMessage(extraError, 'không rõ lỗi')}`)
    }
  }
  for (const file of images) await run(() => inventoryService.uploadComponentImage(id, file), `Ảnh ${file.name}`)
  if (datasheet) await run(() => inventoryService.uploadDatasheet(id, datasheet), `File ${datasheet.name}`)
  if (form.youtubeUrl.trim()) {
    const tutorial = {
      title: `Video hướng dẫn ${name} (YouTube)`,
      url: form.youtubeUrl.trim(),
      content: `Video YouTube hướng dẫn đấu nối và lập trình cho ${name}.`,
    }
    await run(() => inventoryService.createTutorial(id, tutorial), 'Link YouTube')
  }
  if (form.pdfGuideUrl.trim()) {
    const tutorial = {
      title: `Tài liệu PDF hướng dẫn ${name}`,
      url: form.pdfGuideUrl.trim(),
      content: `Tài liệu PDF hướng dẫn thực hành sử dụng ${name}.`,
    }
    await run(() => inventoryService.createTutorial(id, tutorial), 'Link PDF hướng dẫn')
  }
  return errors
}

/** Khai báo linh kiện có trong file phiếu nhập nhưng chưa có trong hệ thống, không rời phiếu đang lập. */
export default function DeclareComponentDialog({ row, categories, onClose, onDeclared }) {
  const [form, setForm] = useState({
    componentName: row.componentName || '',
    shortCode: generateComponentShortCode(row.componentName || ''),
    categoryId: '',
    trackingType: '',
    unit: 'cái',
    minStock: '',
    manufacturer: '',
    description: '',
    specifications: '',
    datasheetUrl: '',
    youtubeUrl: '',
    pdfGuideUrl: '',
  })
  const { hasPermission } = useAuth()
  const canAddTutorial = hasPermission('TUTORIAL_MANAGE')
  const [manualShortCode, setManualShortCode] = useState(false)
  const [images, setImages] = useState([])
  const [datasheet, setDatasheet] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [extraErrors, setExtraErrors] = useState([])

  const change = (event) => {
    const { name, value } = event.target
    if (name === 'shortCode') setManualShortCode(value.trim() !== '')
    setForm((current) => {
      const next = { ...current, [name]: value }
      if (!manualShortCode && (name === 'componentName' || name === 'categoryId')) {
        const category = categories.find((item) => item.id === next.categoryId)
        next.shortCode = generateComponentShortCode(next.componentName, category?.name || '')
      }
      return next
    })
    setError('')
  }

  const save = async () => {
    const invalid = validate(form)
    if (invalid) return setError(invalid)

    setSaving(true)
    setError('')
    try {
      const name = form.componentName.trim()
      const saved = await inventoryService.createComponent({
        categoryId: form.categoryId,
        componentName: name,
        shortCode: form.shortCode.trim().toUpperCase() || null,
        manufacturer: form.manufacturer.trim() || null,
        description: form.description.trim() || null,
        datasheetUrl: form.datasheetUrl.trim() || null,
        trackingType: form.trackingType,
        unit: form.unit.trim(),
        minStock: Number(form.minStock),
        specs: parseSpecsText(form.specifications),
      })
      const failed = await saveExtras(saved.componentId, name, form, images, datasheet)
      if (failed.length === 0) return onDeclared(saved)
      setCreated(saved)
      setExtraErrors(failed)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể khai báo linh kiện.'))
    }
    setSaving(false)
  }

  const close = () => {
    if (saving) return
    if (created) onDeclared(created)
    else onClose()
  }

  const field = (name, label, props) => (
    <TextField fullWidth size="small" name={name} label={label} value={form[name]} onChange={change} {...props} />
  )

  return (
    <Dialog open onClose={(_event, reason) => reason !== 'backdropClick' && close()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Khai báo linh kiện mới</DialogTitle>
      <DialogContent dividers>
        {created ? (
          <Alert severity="warning">
            Đã khai báo {created.componentName}, nhưng chưa lưu được: {extraErrors.join('; ')}. Bạn bổ
            sung sau ở trang sửa linh kiện.
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Alert severity="info">
              Dòng #{row.rowNumber} trong file{row.componentCode ? ` (mã "${row.componentCode}")` : ''} chưa có trong hệ
              thống. Chỉ ô có dấu * là bắt buộc.
            </Alert>
            <Box sx={TWO_COLUMNS}>
              {field('componentName', 'Tên linh kiện', { required: true, slotProps: { htmlInput: { maxLength: 150 } } })}
              {field('categoryId', 'Danh mục', {
                required: true,
                select: true,
                children: categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                )),
              })}
              {field('trackingType', 'Loại quản lý', {
                required: true,
                select: true,
                helperText: 'Không đổi được sau khi khai báo.',
                children: TRACKING_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                )),
              })}
              {field('unit', 'Đơn vị tính', { required: true, slotProps: { htmlInput: { maxLength: 20 } } })}
              {field('minStock', 'Tồn tối thiểu', { required: true, helperText: 'Dưới mức này sẽ báo Sắp hết. Nhập 0 nếu không cần giữ sẵn.' })}
            </Box>

            <Typography sx={{ fontWeight: 700, color: '#334155' }}>Thông tin thêm (không bắt buộc)</Typography>
            <Box sx={TWO_COLUMNS}>
              {field('shortCode', 'Mã viết tắt', {
                helperText: 'Tự sinh từ tên, sửa được.',
                slotProps: { htmlInput: { maxLength: 30 } },
              })}
              {field('manufacturer', 'Hãng sản xuất', { slotProps: { htmlInput: { maxLength: 100 } } })}
              {field('datasheetUrl', 'Link datasheet', { placeholder: 'https://...' })}
              {field('description', 'Mô tả', { multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 2000 } } })}
              {field('specifications', 'Thông số kỹ thuật', {
                multiline: true,
                minRows: 2,
                placeholder: 'Điện áp: 3.3V; Giao tiếp: I2C',
                helperText: 'Ghi "Tên: giá trị", cách nhau bằng dấu ; hoặc xuống dòng.',
              })}
              {canAddTutorial && field('youtubeUrl', 'Link YouTube hướng dẫn', { placeholder: 'https://www.youtube.com/watch?v=...' })}
              {canAddTutorial && field('pdfGuideUrl', 'Link PDF hướng dẫn', { placeholder: 'https://.../huong-dan.pdf' })}
              <Box>
                <Button component="label" variant="outlined" size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Chọn ảnh linh kiện
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImages([...(event.target.files || [])])}
                  />
                </Button>
                <Typography sx={{ mt: 0.5, fontSize: 12, color: '#697386', wordBreak: 'break-word' }}>
                  {images.map((file) => file.name).join(', ') || 'Chưa chọn ảnh.'}
                </Typography>
              </Box>
              <Box>
                <Button component="label" variant="outlined" size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Chọn file datasheet
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => setDatasheet(event.target.files?.[0] || null)}
                  />
                </Button>
                <Typography sx={{ mt: 0.5, fontSize: 12, color: '#697386', wordBreak: 'break-word' }}>
                  {datasheet?.name || 'Chưa chọn file.'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ gap: 1 }}>
        {error && (
          <Alert severity="error" sx={{ flex: 1, py: 0 }}>
            {error}
          </Alert>
        )}
        <Button onClick={close} disabled={saving} sx={{ textTransform: 'none' }}>
          Đóng
        </Button>
        {!created && (
          <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {saving ? 'Đang lưu…' : 'Khai báo'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
