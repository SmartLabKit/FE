import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardContent, Grid, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import {
  Description as DescriptionIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'

const blankForm = {
  componentName: '',
  categoryId: '',
  manufacturer: '',
  description: '',
  specifications: '',
  unit: '',
  trackingType: 'CONSUMABLE',
  datasheetUrl: '',
  isActive: true,
}

export default function NewComponent() {
  const { componentId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(blankForm)
  const [categories, setCategories] = useState([])
  const [imageFiles, setImageFiles] = useState([])
  const [savedImages, setSavedImages] = useState([])
  const [datasheetFile, setDatasheetFile] = useState(null)
  const [savedDatasheetUrl, setSavedDatasheetUrl] = useState('')
  const [savedDatasheetFile, setSavedDatasheetFile] = useState(null)
  const [tutorials, setTutorials] = useState([])
  const [tutorialForm, setTutorialForm] = useState({ title: '', url: '', description: '', content: '' })
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
          const component = await inventoryService.getComponentById(componentId).catch(() => inventoryService.getComponent(componentId))
          if (!component) throw new Error('Không tìm thấy linh kiện cần cập nhật.')
          if (active) {
            const rawDs =
              component.datasheetUrl ||
              component.DatasheetUrl ||
              component.datasheetLink ||
              component.DatasheetLink ||
              (typeof component.datasheet === 'string' ? component.datasheet : component.datasheet?.url || component.datasheet?.Url) ||
              (typeof component.Datasheet === 'string' ? component.Datasheet : component.Datasheet?.url || component.Datasheet?.Url) ||
              component.datasheetPath ||
              component.DatasheetPath ||
              localStorage.getItem(`component_datasheet_url_${componentId}`) ||
              ''

            let savedFile = null
            try {
              const raw = localStorage.getItem(`component_datasheet_file_${componentId}`)
              if (raw) savedFile = JSON.parse(raw)
            } catch {
              // ignore
            }

            let localImages = []
            try {
              const raw = localStorage.getItem(`component_images_${componentId}`)
              if (raw) localImages = JSON.parse(raw)
            } catch {
              // ignore
            }

            setForm({
              componentName: component.componentName || component.ComponentName || '',
              categoryId: component.categoryId || component.CategoryId || '',
              manufacturer: component.manufacturer || component.Manufacturer || '',
              description: component.description || component.Description || '',
              specifications: Array.isArray(component.specs || component.Specs)
                ? (component.specs || component.Specs).join(', ')
                : component.specifications || component.Specifications || '',
              unit: component.unit || component.Unit || '',
              trackingType: component.trackingType || component.TrackingType || 'CONSUMABLE',
              datasheetUrl: rawDs,
              isActive: component.isActive !== false && component.IsActive !== false,
            })

            const imgList = (Array.isArray(component.images) && component.images.length > 0)
              ? component.images
              : (Array.isArray(component.Images) && component.Images.length > 0)
                ? component.Images
                : localImages
            setSavedImages(imgList)

            setSavedDatasheetUrl(rawDs || savedFile?.url || '')
            setSavedDatasheetFile(savedFile)

            const tutList = await inventoryService.getTutorials(componentId).catch(() => [])
            setTutorials(tutList)
          }
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu linh kiện.'))
      }
    }
    load()
    return () => { active = false }
  }, [componentId])

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const saveTutorial = async (event) => {
    event.preventDefault()
    if (!componentId) {
      setError('Hãy lưu linh kiện trước khi thêm hướng dẫn.')
      return
    }
    const contentVal = (tutorialForm.content || tutorialForm.description || '').trim()
    if (!contentVal) {
      setError('Nội dung hướng dẫn là bắt buộc.')
      return
    }
    const payload = {
      title: tutorialForm.title.trim(),
      url: tutorialForm.url.trim(),
      content: contentVal,
      description: contentVal,
      // PascalCase compatibility
      Title: tutorialForm.title.trim(),
      Url: tutorialForm.url.trim(),
      Content: contentVal,
      Description: contentVal,
    }
    try {
      if (editingTutorialId) {
        const saved = await inventoryService.updateTutorial(componentId, editingTutorialId, payload)
        setTutorials((current) => current.map((item) => (item.tutorialId || item.id) === editingTutorialId ? saved : item))
      } else {
        const saved = await inventoryService.createTutorial(componentId, payload)
        setTutorials((current) => [...current, saved])
      }
      setTutorialForm({ title: '', url: '', description: '', content: '' })
      setEditingTutorialId('')
    } catch (tutorialError) {
      setError(extractErrorMessage(tutorialError, 'Không thể thêm hướng dẫn.'))
    }
  }

  const deleteTutorial = async (tutorial) => {
    try {
      await inventoryService.deleteTutorial(componentId, tutorial.tutorialId || tutorial.id)
      setTutorials((current) => current.filter((item) => item !== tutorial))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa hướng dẫn.'))
    }
  }

  const editTutorial = (tutorial) => {
    setEditingTutorialId(tutorial.tutorialId || tutorial.id)
    const text = tutorial.content || tutorial.Content || tutorial.description || tutorial.Description || ''
    setTutorialForm({
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
        await inventoryService.deleteComponentImage(componentId, imgId).catch(() => {})
      }
      const updated = savedImages.filter((item) => (item.imageId || item.id) !== imgId && item !== image)
      setSavedImages(updated)
      if (componentId) {
        localStorage.setItem(`component_images_${componentId}`, JSON.stringify(updated))
      }
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa ảnh.'))
    }
  }

  const deleteDatasheet = async () => {
    try {
      if (componentId) {
        await inventoryService.deleteDatasheet(componentId).catch(() => {})
        localStorage.removeItem(`component_datasheet_url_${componentId}`)
        localStorage.removeItem(`component_datasheet_file_${componentId}`)
      }
      setSavedDatasheetUrl('')
      setSavedDatasheetFile(null)
      setDatasheetFile(null)
      setForm((current) => ({ ...current, datasheetUrl: '' }))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa datasheet.'))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const specsList = form.specifications.trim() ? [form.specifications.trim()] : []
      const dsUrl = form.datasheetUrl.trim() || null
      const payload = {
        ...form,
        componentName: form.componentName.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        specifications: form.specifications.trim(),
        specs: specsList,
        unit: form.unit.trim(),
        datasheetUrl: dsUrl,
        // PascalCase compatibility
        ComponentName: form.componentName.trim(),
        Manufacturer: form.manufacturer.trim(),
        Description: form.description.trim(),
        Specifications: form.specifications.trim(),
        Specs: specsList,
        Unit: form.unit.trim(),
        DatasheetUrl: dsUrl,
        isActive: form.isActive,
      }

      const saved = componentId
        ? await inventoryService.updateComponent(componentId, payload)
        : await inventoryService.createComponent(payload)

      const extractId = (obj) => {
        if (!obj) return ''
        if (typeof obj === 'string') return obj
        return (
          obj.componentId ||
          obj.ComponentId ||
          obj.id ||
          obj.Id ||
          obj.data?.componentId ||
          obj.data?.ComponentId ||
          obj.data?.id ||
          obj.data?.Id ||
          ''
        )
      }
      const id = componentId || extractId(saved)

      if (id) {
        if (dsUrl) {
          localStorage.setItem(`component_datasheet_url_${id}`, dsUrl)
        } else {
          localStorage.removeItem(`component_datasheet_url_${id}`)
        }

        // Upload images
        const currentSavedImages = [...savedImages]
        for (const file of imageFiles) {
          try {
            const imgRes = await inventoryService.uploadComponentImage(id, file)
            currentSavedImages.push({
              imageId: imgRes?.imageId || imgRes?.id || `${Date.now()}-${Math.random()}`,
              imageUrl: imgRes?.imageUrl || imgRes?.url || URL.createObjectURL(file),
              fileName: file.name,
            })
          } catch (imgErr) {
            console.warn('Image upload error:', imgErr)
          }
        }
        if (currentSavedImages.length > 0) {
          localStorage.setItem(`component_images_${id}`, JSON.stringify(currentSavedImages))
        }

        // Upload datasheet file
        if (datasheetFile) {
          try {
            const dsRes = await inventoryService.uploadDatasheet(id, datasheetFile)
            const uploadedUrl = dsRes?.url || dsRes?.datasheetUrl || dsRes?.path || datasheetFile.name
            localStorage.setItem(`component_datasheet_file_${id}`, JSON.stringify({
              name: datasheetFile.name,
              url: uploadedUrl,
            }))
          } catch (dsErr) {
            console.warn('Datasheet upload error:', dsErr)
          }
        }
      }

      navigate('/class-setup/admin/components', {
        state: { createdComponentName: form.componentName.trim() },
      })
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu linh kiện.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PortalLayout
      headerTitle={componentId ? 'Cập nhật linh kiện' : 'Khai báo linh kiện mới'}
      headerSubtitle="Khai báo linh kiện riêng biệt, không làm tăng tồn kho"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Card
          component="form"
          onSubmit={handleSubmit}
          variant="outlined"
          sx={{ borderColor: '#d8dced', borderRadius: 1.5, boxShadow: 'none', bgcolor: '#fff' }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 18 }}>
                  {componentId ? 'Cập nhật linh kiện' : 'Thông tin linh kiện'}
                </Typography>
                <Typography sx={{ color: '#697386', fontSize: 13 }}>
                  Khai báo thông tin chi tiết linh kiện. Tồn kho chỉ tăng sau khi lập phiếu nhập kho.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
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

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              sx={{ mb: 3, borderBottom: '1px solid #e2e8f0' }}
            >
              <Tab label="Thông tin cơ bản" sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }} />
              <Tab label="Ảnh & Datasheet" sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }} />
              <Tab label="Tutorial / Hướng dẫn" sx={{ fontWeight: 700, textTransform: 'none', fontSize: 14 }} />
            </Tabs>

            {/* TAB 0: THÔNG TIN CƠ BẢN */}
            {tab === 0 && (
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth required label="Tên linh kiện" name="componentName" value={form.componentName} onChange={updateField} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth required select label="Danh mục" name="categoryId" value={form.categoryId} onChange={updateField}>
                    {categories.map((category) => (
                      <MenuItem key={category.categoryId} value={category.categoryId}>{category.categoryName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Hãng sản xuất" name="manufacturer" value={form.manufacturer} onChange={updateField} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth required label="Đơn vị" name="unit" value={form.unit} onChange={updateField} placeholder="cái, chiếc, hộp..." />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth required select label="Loại quản lý" name="trackingType" value={form.trackingType} onChange={updateField}>
                    <MenuItem value="CONSUMABLE">CONSUMABLE - Dùng một lần</MenuItem>
                    <MenuItem value="REUSABLE">REUSABLE - Tái sử dụng</MenuItem>
                    <MenuItem value="HIGH_VALUE">HIGH VALUE - Giá thành cao</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={3} label="Mô tả" name="description" value={form.description} onChange={updateField} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={3} label="Thông số kỹ thuật" name="specifications" value={form.specifications} onChange={updateField} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Link datasheet (không bắt buộc)"
                    name="datasheetUrl"
                    value={form.datasheetUrl}
                    onChange={updateField}
                    placeholder="VD: https://docs.arduino.cc/hardware/uno-rev3"
                    helperText="Có thể nhập link tài liệu kỹ thuật trực tiếp tại đây hoặc đính kèm tệp ở tab 'Ảnh & Datasheet'."
                  />
                </Grid>
              </Grid>
            )}

            {/* TAB 1: ẢNH & DATASHEET */}
            {tab === 1 && (
              <Grid container spacing={3}>
                {/* Cột 1: Ảnh linh kiện */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                    <Typography sx={{ mb: 1, fontWeight: 700, color: '#182238', fontSize: 15 }}>Ảnh linh kiện</Typography>
                    <Typography sx={{ mb: 2, color: '#64748b', fontSize: 12 }}>Ảnh minh họa của linh kiện hiển thị cho sinh viên và thủ kho.</Typography>

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
                            sx={{ fontSize: 13, color: '#0058be', textDecoration: 'none', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {image.fileName || image.imageUrl || image.url}
                          </Typography>
                          <Button size="small" color="error" onClick={() => deleteImage(image)} sx={{ minWidth: 32, p: 0.5 }}>
                            Xóa
                          </Button>
                        </Box>
                      ))}
                      {savedImages.length === 0 && !imageFiles.length && (
                        <Typography sx={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>Chưa có ảnh nào được tải lên.</Typography>
                      )}
                    </Box>

                    <Button component="label" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600 }}>
                      Chọn ảnh {imageFiles.length ? `(${imageFiles.length} tệp đã chọn)` : ''}
                      <input hidden multiple type="file" accept="image/*" onChange={(event) => setImageFiles([...(event.target.files || [])])} />
                    </Button>
                    <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>
                      {imageFiles.map((file) => file.name).join(', ') || 'Hỗ trợ PNG, JPG, JPEG. Ảnh sẽ được lưu khi bấm Lưu linh kiện.'}
                    </Typography>
                  </Box>
                </Grid>

                {/* Cột 2: Datasheet */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                    <Typography sx={{ mb: 1, fontWeight: 700, color: '#182238', fontSize: 15 }}>Tài liệu Datasheet</Typography>
                    <Typography sx={{ mb: 2, color: '#64748b', fontSize: 12 }}>Tài liệu kỹ thuật / sơ đồ chân / bảng thông số của linh kiện.</Typography>

                    {/* Hiển thị datasheet đã lưu */}
                    {(savedDatasheetUrl || savedDatasheetFile) && (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <DescriptionIcon sx={{ color: '#0284c7' }} />
                          <Typography
                            component="a"
                            href={savedDatasheetUrl?.startsWith('http') ? savedDatasheetUrl : '#'}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ fontSize: 13, fontWeight: 600, color: '#0058be', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {savedDatasheetFile?.name || savedDatasheetUrl}
                          </Typography>
                        </Box>
                        <Button size="small" color="error" onClick={deleteDatasheet} sx={{ textTransform: 'none', minWidth: 'fit-content' }}>
                          Xóa
                        </Button>
                      </Box>
                    )}

                    {/* Upload tệp datasheet */}
                    <Box sx={{ mb: 2.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                        1. Đính kèm tệp Datasheet (.pdf, .doc, .docx):
                      </Typography>
                      <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ textTransform: 'none', fontWeight: 600 }}>
                        {datasheetFile?.name || 'Chọn tệp datasheet từ máy tính'}
                        <input hidden type="file" accept=".pdf,.doc,.docx" onChange={(event) => setDatasheetFile(event.target.files?.[0] || null)} />
                      </Button>
                      <Typography sx={{ mt: 0.5, color: '#697386', fontSize: 12 }}>
                        {datasheetFile ? `Đã chọn: ${datasheetFile.name}` : 'Tệp sẽ được tải lên máy chủ khi bấm Lưu linh kiện.'}
                      </Typography>
                    </Box>

                    {/* Nhập link datasheet trực tuyến */}
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
                        placeholder="https://docs.arduino.cc/..."
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
            )}

            {/* TAB 2: TUTORIAL */}
            {tab === 2 && (
              <Box>
                {!componentId && <Alert severity="info" sx={{ mb: 2 }}>Lưu linh kiện trước khi thêm tutorial.</Alert>}
                <Box component="form" onSubmit={saveTutorial} sx={{ mb: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    required
                    label="Tiêu đề *"
                    placeholder="VD: Hướng dẫn cài đặt ESP32..."
                    value={tutorialForm.title}
                    onChange={(event) => setTutorialForm({ ...tutorialForm, title: event.target.value })}
                  />
                  <TextField
                    required
                    label="URL hướng dẫn *"
                    placeholder="https://..."
                    value={tutorialForm.url}
                    onChange={(event) => setTutorialForm({ ...tutorialForm, url: event.target.value })}
                  />
                  <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                    <TextField
                      fullWidth
                      required
                      multiline
                      minRows={2}
                      label="Nội dung / Mô tả hướng dẫn *"
                      placeholder="Nhập nội dung chi tiết hoặc mô tả về bài hướng dẫn..."
                      value={tutorialForm.content || tutorialForm.description}
                      onChange={(event) => setTutorialForm({
                        ...tutorialForm,
                        content: event.target.value,
                        description: event.target.value,
                      })}
                      helperText="Nội dung hướng dẫn là bắt buộc"
                    />
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' }, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {editingTutorialId && (
                      <Button
                        onClick={() => {
                          setEditingTutorialId('')
                          setTutorialForm({ title: '', url: '', description: '', content: '' })
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Hủy sửa
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!componentId}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                    >
                      {editingTutorialId ? 'Cập nhật tutorial' : 'Thêm tutorial'}
                    </Button>
                  </Box>
                </Box>
                {tutorials.map((tutorial) => (
                  <Box key={tutorial.tutorialId || tutorial.id} sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e4e6ef' }}>
                    <Box sx={{ pr: 2 }}>
                      <Typography sx={{ fontWeight: 600 }}>{tutorial.title || tutorial.Title}</Typography>
                      {(tutorial.content || tutorial.Content || tutorial.description || tutorial.Description) && (
                        <Typography sx={{ fontSize: 13, color: '#475569', my: 0.5, whiteSpace: 'pre-wrap' }}>
                          {tutorial.content || tutorial.Content || tutorial.description || tutorial.Description}
                        </Typography>
                      )}
                      <Typography component="a" href={tutorial.url || tutorial.Url} target="_blank" rel="noreferrer" sx={{ color: '#0058be', fontSize: 13 }}>
                        {tutorial.url || tutorial.Url}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, minWidth: 'fit-content' }}>
                      <Button size="small" onClick={() => editTutorial(tutorial)} sx={{ textTransform: 'none' }}>Sửa</Button>
                      <Button size="small" color="error" onClick={() => deleteTutorial(tutorial)} sx={{ textTransform: 'none' }}>Xóa</Button>
                    </Box>
                  </Box>
                ))}
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
