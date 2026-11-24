import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AutoFixHigh as AutoGenIcon,
  Description as DescriptionIcon,
  InfoOutlined as InfoIcon,
  PictureAsPdf as PdfIcon,
  PlayCircle as YoutubeIcon,
  TableChart as ExcelIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import {
  classifyTutorialType,
  extractYoutubeVideoId,
  findDuplicateSpecKeys,
  formatSpecsText,
  generateComponentShortCode,
  getComponentShortCode,
  isYoutubeUrl,
  parseSpecsText,
} from './componentHelpers'

const blankForm = {
  componentName: '',
  shortCode: '',
  categoryId: '',
  manufacturer: '',
  description: '',
  specifications: '',
  unit: 'cái',
  trackingType: 'CONSUMABLE',
  minStock: '',
  datasheetUrl: '',
  youtubeUrl: '',
  pdfGuideUrl: '',
  isActive: true,
}

export default function NewComponent() {
  const { componentId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(blankForm)
  const [manualShortCode, setManualShortCode] = useState(false)
  const [categories, setCategories] = useState([])
  const [imageFiles, setImageFiles] = useState([])
  const [savedImages, setSavedImages] = useState([])
  const [datasheetFile, setDatasheetFile] = useState(null)
  const [savedDatasheetUrl, setSavedDatasheetUrl] = useState('')
  const [tutorials, setTutorials] = useState([])
  const [tutorialForm, setTutorialForm] = useState({
    type: 'youtube',
    title: '',
    url: '',
    description: '',
    content: '',
  })
  const [editingTutorialId, setEditingTutorialId] = useState('')
  const [tab, setTab] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const categoryList = await inventoryService.getCategories()
        if (active) setCategories(categoryList)
        if (componentId) {
          const component = await inventoryService
            .getComponentById(componentId)
            .catch(() => inventoryService.getComponent(componentId))
          if (!component) throw new Error('Không tìm thấy linh kiện cần cập nhật.')
          if (active) {
            const rawDs = component.datasheetUrl || ''
            const existingShortCode = getComponentShortCode(component)

            setManualShortCode(true)
            setForm({
              componentName: component.componentName || component.ComponentName || '',
              shortCode: existingShortCode,
              categoryId: component.categoryId || component.CategoryId || '',
              manufacturer: component.manufacturer || component.Manufacturer || '',
              description: component.description || component.Description || '',
              specifications: Array.isArray(component.specs || component.Specs)
                ? formatSpecsText(component.specs || component.Specs)
                : component.specifications || component.Specifications || '',
              unit: component.unit || component.Unit || '',
              trackingType: component.trackingType || component.TrackingType || 'CONSUMABLE',
              minStock: component.minStock ?? component.MinStock ?? '',
              datasheetUrl: rawDs,
              youtubeUrl: '',
              pdfGuideUrl: '',
              isActive: component.isActive !== false && component.IsActive !== false,
            })

            setSavedImages(Array.isArray(component.images) ? component.images : [])
            setSavedDatasheetUrl(rawDs)

            const apiTutorials = await inventoryService.getTutorials(componentId).catch(() => [])
            setTutorials(apiTutorials)
          }
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu linh kiện.'))
      }
    }
    load()
    return () => {
      active = false
    }
  }, [componentId])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => {
      const next = { ...current, [name]: value }
      // Tự động sinh mã viết tắt kiểu thuốc y tế từ tên linh kiện nếu người dùng chưa chỉnh tay
      if (name === 'componentName' && !manualShortCode) {
        const catName = categories.find((c) => c.categoryId === current.categoryId)?.categoryName || ''
        next.shortCode = generateComponentShortCode(value, catName)
      }
      if (name === 'categoryId' && !manualShortCode && current.componentName) {
        const catName = categories.find((c) => c.categoryId === value)?.categoryName || ''
        next.shortCode = generateComponentShortCode(current.componentName, catName)
      }
      return next
    })
    if (name === 'shortCode') {
      setManualShortCode(true)
    }
    setError('')
  }

  const regenerateShortCode = () => {
    const catName = categories.find((c) => c.categoryId === form.categoryId)?.categoryName || ''
    setManualShortCode(false)
    setForm((current) => ({
      ...current,
      shortCode: generateComponentShortCode(current.componentName, catName),
    }))
  }

  // Thêm / sửa tutorial (hỗ trợ cả khi đang TẠO MỚI linh kiện — lưu tạm vào danh sách chờ và gửi API ngay sau khi tạo linh kiện)
  const saveTutorial = async () => {
    const titleVal = tutorialForm.title.trim()
    const urlVal = tutorialForm.url.trim()
    const contentVal = (tutorialForm.content || tutorialForm.description || '').trim()

    if (!titleVal) {
      setError('Vui lòng nhập tiêu đề hướng dẫn.')
      return
    }
    if (!urlVal) {
      setError('Vui lòng nhập đường dẫn (YouTube / PDF / Web) cho hướng dẫn.')
      return
    }
    if (tutorialForm.type === 'youtube' && !isYoutubeUrl(urlVal)) {
      setError('Đường dẫn YouTube không hợp lệ (VD: https://www.youtube.com/watch?v=... hoặc https://youtu.be/...).')
      return
    }
    if (!contentVal) {
      setError('Nội dung / mô tả hướng dẫn là bắt buộc.')
      return
    }

    setError('')
    const payload = {
      type: tutorialForm.type,
      title: titleVal,
      url: urlVal,
      content: contentVal,
    }

    // Nếu đang tạo mới linh kiện (chưa có componentId), đưa vào hàng đợi để tự lưu ngay khi bấm Lưu linh kiện
    if (!componentId) {
      if (editingTutorialId) {
        setTutorials((current) =>
          current.map((item) => ((item.tutorialId || item.id) === editingTutorialId ? { ...item, ...payload } : item))
        )
      } else {
        setTutorials((current) => [...current, { ...payload, tutorialId: `draft-${Date.now()}-${Math.random()}` }])
      }
      setTutorialForm({ type: 'youtube', title: '', url: '', description: '', content: '' })
      setEditingTutorialId('')
      return
    }

    try {
      if (editingTutorialId) {
        const saved = await inventoryService.updateTutorial(componentId, editingTutorialId, payload)
        setTutorials((current) =>
          current.map((item) =>
            (item.tutorialId || item.id) === editingTutorialId ? { ...payload, ...(saved || {}) } : item
          )
        )
      } else {
        const saved = await inventoryService.createTutorial(componentId, payload)
        setTutorials((current) => [...current, { ...payload, ...(saved || {}) }])
      }
      setTutorialForm({ type: 'youtube', title: '', url: '', description: '', content: '' })
      setEditingTutorialId('')
    } catch (tutorialError) {
      setError(extractErrorMessage(tutorialError, 'Không thể thêm hướng dẫn.'))
    }
  }

  const deleteTutorial = async (tutorial) => {
    const tutId = tutorial.tutorialId || tutorial.id
    if (!componentId || String(tutId).startsWith('draft-')) {
      setTutorials((current) => current.filter((item) => item !== tutorial))
      return
    }
    try {
      await inventoryService.deleteTutorial(componentId, tutId)
      setTutorials((current) => current.filter((item) => item !== tutorial))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa hướng dẫn.'))
    }
  }

  const editTutorial = (tutorial) => {
    setEditingTutorialId(tutorial.tutorialId || tutorial.id)
    const text = tutorial.content || tutorial.Content || tutorial.description || tutorial.Description || ''
    setTutorialForm({
      type: classifyTutorialType(tutorial),
      title: tutorial.title || tutorial.Title || '',
      url: tutorial.url || tutorial.Url || '',
      description: text,
      content: text,
    })
  }

  const deleteImage = async (image) => {
    try {
      const imgId = image.imageId || image.id
      if (componentId && imgId) {
        await inventoryService.deleteComponentImage(componentId, imgId)
      }
      setSavedImages((current) => current.filter((item) => (item.imageId || item.id) !== imgId && item !== image))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa ảnh.'))
    }
  }

  const deleteDatasheet = async () => {
    try {
      if (componentId) {
        await inventoryService.deleteDatasheet(componentId)
      }
      setSavedDatasheetUrl('')
      setDatasheetFile(null)
      setForm((current) => ({ ...current, datasheetUrl: '' }))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa datasheet.'))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.componentName.trim()) {
      setError('Vui lòng nhập tên linh kiện.')
      setTab(0)
      return
    }
    if (!form.categoryId) {
      setError('Vui lòng chọn danh mục linh kiện.')
      setTab(0)
      return
    }
    if (!form.unit.trim()) {
      setError('Vui lòng nhập đơn vị tính (VD: cái, chiếc, bộ...).')
      setTab(0)
      return
    }

    const minStockText = String(form.minStock ?? '').trim()
    const parsedMinStock = minStockText === '' ? null : Number(minStockText)
    if (parsedMinStock !== null && (!Number.isInteger(parsedMinStock) || parsedMinStock < 0)) {
      setError('Tồn tối thiểu phải là số nguyên >= 0.')
      setTab(0)
      return
    }

    const specsList = parseSpecsText(form.specifications)
    const duplicateSpecKeys = findDuplicateSpecKeys(specsList)
    if (duplicateSpecKeys.length > 0) {
      setError(`Thông số bị trùng tên: ${duplicateSpecKeys.join(', ')}.`)
      setTab(0)
      return
    }

    if (form.youtubeUrl.trim() && !isYoutubeUrl(form.youtubeUrl.trim())) {
      setError('Link YouTube hướng dẫn không đúng định dạng (VD: https://www.youtube.com/watch?v=...).')
      setTab(0)
      return
    }

    setSaving(true)
    try {
      const name = form.componentName.trim()
      const shortCodeVal = (form.shortCode.trim() || generateComponentShortCode(name)).toUpperCase()

      const payload = {
        categoryId: form.categoryId,
        componentName: name,
        shortCode: shortCodeVal || null,
        manufacturer: form.manufacturer.trim() || null,
        description: form.description.trim() || null,
        datasheetUrl: form.datasheetUrl.trim() || null,
        unit: form.unit.trim(),
        minStock: parsedMinStock,
        specs: specsList,
        isActive: form.isActive,
      }
      if (!componentId) payload.trackingType = form.trackingType

      const saved = componentId
        ? await inventoryService.updateComponent(componentId, payload)
        : await inventoryService.createComponent(payload)
      const id = componentId || saved?.componentId

      const followUpErrors = []
      if (id) {
        for (const file of imageFiles) {
          try {
            await inventoryService.uploadComponentImage(id, file)
          } catch (imgErr) {
            followUpErrors.push(extractErrorMessage(imgErr, `Không tải được ảnh ${file.name}`))
          }
        }

        if (datasheetFile) {
          try {
            await inventoryService.uploadDatasheet(id, datasheetFile)
          } catch (dsErr) {
            followUpErrors.push(extractErrorMessage(dsErr, 'Không tải được file datasheet'))
          }
        }

        const pendingTutorials = []
        if (form.youtubeUrl.trim()) {
          pendingTutorials.push({
            title: `Video hướng dẫn ${name} (YouTube)`,
            url: form.youtubeUrl.trim(),
            content: `Video YouTube hướng dẫn đấu nối và lập trình cho ${name}.`,
          })
        }
        if (form.pdfGuideUrl.trim()) {
          pendingTutorials.push({
            title: `Tài liệu PDF hướng dẫn ${name}`,
            url: form.pdfGuideUrl.trim(),
            content: `Tài liệu PDF hướng dẫn thực hành sử dụng ${name}.`,
          })
        }
        if (!componentId) {
          tutorials.forEach((t) => {
            if (t.url && !pendingTutorials.some((p) => p.url === t.url)) pendingTutorials.push(t)
          })
        }

        for (const tut of pendingTutorials) {
          try {
            await inventoryService.createTutorial(id, tut)
          } catch (tutErr) {
            followUpErrors.push(extractErrorMessage(tutErr, `Không lưu được hướng dẫn "${tut.title}"`))
          }
        }
      }

      if (followUpErrors.length > 0) {
        setError(`Đã lưu linh kiện nhưng còn lỗi: ${followUpErrors.join('; ')}`)
        if (!componentId && id) navigate(`/class-setup/admin/components/${id}/edit`, { replace: true })
        return
      }

      navigate('/class-setup/admin/components', {
        state: { createdComponentName: name },
      })
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu linh kiện.'))
    } finally {
      setSaving(false)
    }
  }

  const youtubePreviewId = extractYoutubeVideoId(form.youtubeUrl)

  return (
    <PortalLayout
      headerTitle={componentId ? 'Cập nhật linh kiện' : 'Khai báo linh kiện mới'}
      headerSubtitle="Khai báo danh mục linh kiện chuẩn (tự sinh mã viết tắt tra cứu nhanh, tồn tối thiểu, YouTube & PDF hướng dẫn)"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Card
          component="form"
          onSubmit={handleSubmit}
          variant="outlined"
          sx={{ borderColor: '#d8dced', borderRadius: 1.5, boxShadow: 'none', bgcolor: '#fff' }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box>
                <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 18 }}>
                  {componentId ? 'Cập nhật linh kiện' : 'Thông tin linh kiện'}
                </Typography>
                <Typography sx={{ color: '#697386', fontSize: 13 }}>
                  Khai báo thông tin chi tiết linh kiện. Tồn kho chỉ tăng sau khi lập phiếu nhập kho.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {!componentId && (
                  <Button
                    variant="outlined"
                    startIcon={<ExcelIcon />}
                    onClick={() => navigate('/class-setup/admin/components/import')}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderColor: '#16a34a',
                      color: '#15803d',
                      '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' },
                    }}
                  >
                    Nhập hàng loạt từ Excel
                  </Button>
                )}
                <Button onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none' }}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                >
                  {saving ? 'Đang lưu…' : componentId ? 'Lưu thay đổi' : 'Lưu linh kiện'}
                </Button>
              </Box>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 3, borderBottom: '1px solid #e2e8f0' }}
            >
              <Tab label="Thông tin cơ bản" sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }} />
              <Tab
                label="Ảnh & Datasheet (Kỹ thuật NSX)"
                sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }}
              />
              <Tab
                label={`Tutorial / Hướng dẫn sử dụng (${tutorials.length})`}
                sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }}
              />
            </Tabs>

            {/* TAB 0: THÔNG TIN CƠ BẢN */}
            {tab === 0 && (
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Tên linh kiện"
                    name="componentName"
                    placeholder="VD: Cảm biến nhiệt độ độ ẩm DHT22 (AM2302)"
                    value={form.componentName}
                    onChange={updateField}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Mã viết tắt tra cứu nhanh (tự sinh từ tên)"
                    name="shortCode"
                    placeholder="VD: CBNDDA-DHT22"
                    value={form.shortCode}
                    onChange={updateField}
                    helperText="Sinh tự động kiểu mã viết tắt y tế từ tên linh kiện để thủ kho & sinh viên tìm siêu nhanh."
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Sinh lại mã viết tắt tự động từ tên">
                              <IconButton size="small" onClick={regenerateShortCode} color="primary">
                                <AutoGenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="Danh mục"
                    name="categoryId"
                    value={form.categoryId}
                    onChange={updateField}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.categoryId} value={category.categoryId}>
                        {category.categoryName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="Loại quản lý"
                    name="trackingType"
                    value={form.trackingType}
                    onChange={updateField}
                  >
                    <MenuItem value="CONSUMABLE">CONSUMABLE - Tiêu hao (dùng một lần)</MenuItem>
                    <MenuItem value="REUSABLE">REUSABLE - Tái sử dụng (quản lý từng chiếc)</MenuItem>
                    <MenuItem value="HIGH_VALUE">HIGH_VALUE - Giá thành cao (có Serial & Bảo hành)</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Tồn tối thiểu"
                    name="minStock"
                    placeholder="VD: 10"
                    value={form.minStock}
                    onKeyDown={(e) => {
                      if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
                    }}
                    onChange={updateField}
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    helperText="Tồn kho dưới mức này sẽ báo Sắp hết. Để trống nếu không cần cảnh báo."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Hãng sản xuất / Thương hiệu"
                    name="manufacturer"
                    placeholder="VD: Espressif Systems, Arduino, Rigol, Aosong..."
                    value={form.manufacturer}
                    onChange={updateField}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Đơn vị tính"
                    name="unit"
                    value={form.unit}
                    onChange={updateField}
                    placeholder="cái, chiếc, bộ, gói, cuộn..."
                  />
                </Grid>
                {componentId && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isActive !== false}
                          onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                        />
                      }
                      label={form.isActive !== false ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Mô tả"
                    name="description"
                    placeholder="Công dụng, đặc điểm nổi bật khi dùng trong bài lab thực hành..."
                    value={form.description}
                    onChange={updateField}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Thông số kỹ thuật"
                    name="specifications"
                    placeholder="VD: Điện áp: 3.3-5V; Giao tiếp: I2C/SPI"
                    helperText='Ghi "Tên: giá trị", mỗi thông số cách nhau bằng dấu ; hoặc xuống dòng'
                    value={form.specifications}
                    onChange={updateField}
                  />
                </Grid>

                {/* Nhập nhanh tài liệu kỹ thuật & tài liệu hướng dẫn ngay tại màn hình tạo */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#182238', mb: 1.5 }}>
                      Tài liệu đính kèm nhanh (không bắt buộc)
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Link Datasheet kỹ thuật (NSX)"
                          name="datasheetUrl"
                          value={form.datasheetUrl}
                          onChange={updateField}
                          placeholder="https://www.espressif.com/.../datasheet.pdf"
                          helperText="Tài liệu kỹ thuật chuẩn từ nhà sản xuất (pinout, điện áp)."
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Link Video YouTube hướng dẫn"
                          name="youtubeUrl"
                          value={form.youtubeUrl}
                          onChange={updateField}
                          placeholder="https://www.youtube.com/watch?v=..."
                          helperText="Video YouTube hướng dẫn đấu nối / lập trình cho sinh viên."
                        />
                        {youtubePreviewId && (
                          <Chip
                            size="small"
                            icon={<YoutubeIcon />}
                            color="error"
                            variant="outlined"
                            label="Link YouTube hợp lệ"
                            sx={{ mt: 0.75, fontSize: 11 }}
                          />
                        )}
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Link PDF hướng dẫn thực hành"
                          name="pdfGuideUrl"
                          value={form.pdfGuideUrl}
                          onChange={updateField}
                          placeholder="https://.../huong-dan-lab-esp32.pdf"
                          helperText="Tài liệu PDF bài lab / hướng dẫn cách sử dụng."
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* TAB 1: ẢNH & DATASHEET */}
            {tab === 1 && (
              <Box>
                <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2.5 }}>
                  <strong>Phân biệt Ảnh &amp; Datasheet vs Tutorial / Hướng dẫn:</strong> Tab này lưu{' '}
                  <strong>hình ảnh thực tế</strong> và <strong>Datasheet kỹ thuật chính thức của nhà sản xuất</strong>{' '}
                  (sơ đồ chân pinout, ngưỡng điện áp, kích thước cơ khí). Các <em>video YouTube</em> hoặc{' '}
                  <em>PDF bài hướng dẫn thực hành</em> nằm ở tab <strong>Tutorial / Hướng dẫn sử dụng</strong>.
                </Alert>
                <Grid container spacing={3}>
                  {/* Cột 1: Ảnh linh kiện */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                      <Typography sx={{ mb: 1, fontWeight: 700, color: '#182238', fontSize: 15 }}>Ảnh linh kiện</Typography>
                      <Typography sx={{ mb: 2, color: '#64748b', fontSize: 12 }}>
                        Ảnh minh họa thực tế của linh kiện hiển thị trên Catalog cho sinh viên và thủ kho nhận diện.
                      </Typography>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                        {savedImages.map((image) => (
                          <Box
                            key={image.imageId || image.id}
                            sx={{
                              p: 1,
                              bgcolor: '#fff',
                              border: '1px solid #d8dced',
                              borderRadius: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography
                              component="a"
                              href={image.imageUrl || image.url}
                              target="_blank"
                              rel="noreferrer"
                              sx={{
                                fontSize: 13,
                                color: '#0058be',
                                textDecoration: 'none',
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {image.fileName || image.imageUrl || image.url}
                            </Typography>
                            <Button size="small" color="error" onClick={() => deleteImage(image)} sx={{ minWidth: 32, p: 0.5 }}>
                              Xóa
                            </Button>
                          </Box>
                        ))}
                        {savedImages.length === 0 && !imageFiles.length && (
                          <Typography sx={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                            Chưa có ảnh nào được tải lên.
                          </Typography>
                        )}
                      </Box>

                      <Button component="label" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Chọn ảnh {imageFiles.length ? `(${imageFiles.length} tệp đã chọn)` : ''}
                        <input
                          hidden
                          multiple
                          type="file"
                          accept="image/*"
                          onChange={(event) => setImageFiles([...(event.target.files || [])])}
                        />
                      </Button>
                      <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>
                        {imageFiles.map((file) => file.name).join(', ') ||
                          'Hỗ trợ PNG, JPG, JPEG. Ảnh sẽ được lưu khi bấm Lưu linh kiện.'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Cột 2: Datasheet */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                      <Typography sx={{ mb: 1, fontWeight: 700, color: '#182238', fontSize: 15 }}>
                        Tài liệu Datasheet (Thông số NSX)
                      </Typography>
                      <Typography sx={{ mb: 2, color: '#64748b', fontSize: 12 }}>
                        Tài liệu đặc tả phần cứng chính thức: sơ đồ chân (pinout), dải điện áp, dòng tiêu thụ, sơ đồ mạch chuẩn.
                      </Typography>

                      {savedDatasheetUrl && (
                        <Box
                          sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: '#fff',
                            border: '1px solid #d8dced',
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <DescriptionIcon sx={{ color: '#0284c7' }} />
                            <Typography
                              component="a"
                              href={savedDatasheetUrl?.startsWith('http') ? savedDatasheetUrl : '#'}
                              target="_blank"
                              rel="noreferrer"
                              sx={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#0058be',
                                textDecoration: 'none',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {savedDatasheetUrl}
                            </Typography>
                          </Box>
                          <Button size="small" color="error" onClick={deleteDatasheet} sx={{ textTransform: 'none', minWidth: 'fit-content' }}>
                            Xóa
                          </Button>
                        </Box>
                      )}

                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                          1. Đính kèm tệp Datasheet (.pdf, .doc, .docx):
                        </Typography>
                        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ textTransform: 'none', fontWeight: 600 }}>
                          {datasheetFile?.name || 'Chọn tệp datasheet từ máy tính'}
                          <input
                            hidden
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(event) => setDatasheetFile(event.target.files?.[0] || null)}
                          />
                        </Button>
                        <Typography sx={{ mt: 0.5, color: '#697386', fontSize: 12 }}>
                          {datasheetFile ? `Đã chọn: ${datasheetFile.name}` : 'Tệp sẽ được tải lên máy chủ khi bấm Lưu linh kiện.'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                          2. Hoặc nhập đường dẫn Datasheet trực tuyến (URL):
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          label="Link datasheet (URL)"
                          name="datasheetUrl"
                          value={form.datasheetUrl}
                          onChange={updateField}
                          placeholder="https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf"
                        />
                        {form.datasheetUrl && (
                          <Box sx={{ mt: 0.5 }}>
                            <Button
                              size="small"
                              href={form.datasheetUrl.startsWith('http') ? form.datasheetUrl : `https://${form.datasheetUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              sx={{ textTransform: 'none', fontSize: 12, p: 0 }}
                            >
                              Mở liên kết datasheet ↗
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* TAB 2: TUTORIAL / HƯỚNG DẪN SỬ DỤNG (YouTube & PDF) */}
            {tab === 2 && (
              <Box>
                <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2.5 }}>
                  <strong>Tutorial / Hướng dẫn sử dụng</strong> giúp sinh viên học cách đấu nối, cài thư viện và chạy code mẫu
                  qua <strong>Video YouTube</strong> hoặc <strong>Tài liệu PDF hướng dẫn</strong> (khác với Datasheet chỉ nêu thông số kỹ thuật từ NSX).
                  {!componentId && ' Các hướng dẫn bạn thêm tại đây sẽ tự động được lưu ngay khi bấm "Lưu linh kiện".'}
                </Alert>

                <Box sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Loại tài liệu hướng dẫn"
                        value={tutorialForm.type}
                        onChange={(e) => setTutorialForm({ ...tutorialForm, type: e.target.value })}
                      >
                        <MenuItem value="youtube">Video YouTube</MenuItem>
                        <MenuItem value="pdf">Tài liệu PDF hướng dẫn</MenuItem>
                        <MenuItem value="link">Bài viết / Liên kết khác</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Tiêu đề hướng dẫn *"
                        placeholder={
                          tutorialForm.type === 'youtube'
                            ? 'VD: Video hướng dẫn lập trình ESP32 trên Arduino IDE'
                            : 'VD: Tài liệu PDF bài Lab đấu nối cảm biến DHT22'
                        }
                        value={tutorialForm.title}
                        onChange={(event) => setTutorialForm({ ...tutorialForm, title: event.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={
                          tutorialForm.type === 'youtube'
                            ? 'Link YouTube *'
                            : tutorialForm.type === 'pdf'
                              ? 'Link file PDF hướng dẫn *'
                              : 'URL hướng dẫn *'
                        }
                        placeholder={
                          tutorialForm.type === 'youtube'
                            ? 'https://www.youtube.com/watch?v=...'
                            : 'https://.../huong-dan.pdf'
                        }
                        value={tutorialForm.url}
                        onChange={(event) => setTutorialForm({ ...tutorialForm, url: event.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                        label="Nội dung / Tóm tắt hướng dẫn *"
                        placeholder="Mô tả ngắn nội dung video hoặc tài liệu hướng dẫn để sinh viên dễ tra cứu..."
                        value={tutorialForm.content || tutorialForm.description}
                        onChange={(event) =>
                          setTutorialForm({
                            ...tutorialForm,
                            content: event.target.value,
                            description: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {editingTutorialId && (
                          <Button
                            onClick={() => {
                              setEditingTutorialId('')
                              setTutorialForm({ type: 'youtube', title: '', url: '', description: '', content: '' })
                            }}
                            sx={{ textTransform: 'none' }}
                          >
                            Hủy sửa
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="contained"
                          onClick={saveTutorial}
                          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                        >
                          {editingTutorialId ? 'Cập nhật hướng dẫn' : '+ Thêm vào danh sách hướng dẫn'}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {tutorials.length === 0 ? (
                  <Typography sx={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', py: 2 }}>
                    Chưa có bài hướng dẫn YouTube hoặc PDF nào.
                  </Typography>
                ) : (
                  tutorials.map((tutorial) => {
                    const kind = classifyTutorialType(tutorial)
                    return (
                      <Box
                        key={tutorial.tutorialId || tutorial.id}
                        sx={{
                          py: 1.5,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #e4e6ef',
                          gap: 2,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            {kind === 'youtube' ? (
                              <Chip
                                size="small"
                                icon={<YoutubeIcon />}
                                label="YouTube"
                                sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 11, height: 22 }}
                              />
                            ) : kind === 'pdf' ? (
                              <Chip
                                size="small"
                                icon={<PdfIcon />}
                                label="PDF hướng dẫn"
                                sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: 11, height: 22 }}
                              />
                            ) : (
                              <Chip size="small" label="Liên kết" sx={{ fontSize: 11, height: 22 }} />
                            )}
                            <Typography sx={{ fontWeight: 700 }}>{tutorial.title || tutorial.Title}</Typography>
                          </Stack>
                          {(tutorial.content || tutorial.Content || tutorial.description || tutorial.Description) && (
                            <Typography sx={{ fontSize: 13, color: '#475569', my: 0.5, whiteSpace: 'pre-wrap' }}>
                              {tutorial.content || tutorial.Content || tutorial.description || tutorial.Description}
                            </Typography>
                          )}
                          <Typography
                            component="a"
                            href={tutorial.url || tutorial.Url}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ color: '#0058be', fontSize: 13, wordBreak: 'break-all' }}
                          >
                            {tutorial.url || tutorial.Url}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, minWidth: 'fit-content' }}>
                          <Button size="small" onClick={() => editTutorial(tutorial)} sx={{ textTransform: 'none' }}>
                            Sửa
                          </Button>
                          <Button size="small" color="error" onClick={() => deleteTutorial(tutorial)} sx={{ textTransform: 'none' }}>
                            Xóa
                          </Button>
                        </Box>
                      </Box>
                    )
                  })
                )}
              </Box>
            )}

            {/* Bottom Actions - luôn hiển thị ở chân Card */}
            <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none' }}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be', minWidth: 140 }}
              >
                {saving ? 'Đang lưu…' : componentId ? 'Lưu thay đổi' : 'Lưu linh kiện'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
