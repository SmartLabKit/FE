import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardContent, Grid, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material'
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
  const [tutorials, setTutorials] = useState([])
  const [tutorialForm, setTutorialForm] = useState({ title: '', url: '', description: '' })
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
          const components = await inventoryService.getComponents()
          const component = components.find((item) => item.componentId === componentId)
          if (!component) throw new Error('Không tìm thấy linh kiện cần cập nhật.')
          if (active) {
            setForm({
              componentName: component.componentName || '',
              categoryId: component.categoryId || '',
              manufacturer: component.manufacturer || '',
              description: component.description || '',
              specifications: Array.isArray(component.specs)
                ? component.specs.join(', ')
                : component.specifications || '',
              unit: component.unit || '',
              trackingType: component.trackingType || 'CONSUMABLE',
              datasheetUrl: component.datasheetUrl || '',
              isActive: component.isActive !== false,
            })
            setSavedImages(component.images || [])
            setSavedDatasheetUrl(component.datasheetUrl || component.datasheet?.url || '')
            setTutorials(await inventoryService.getTutorials(componentId))
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
    try {
      if (editingTutorialId) {
        const saved = await inventoryService.updateTutorial(componentId, editingTutorialId, tutorialForm)
        setTutorials((current) => current.map((item) => (item.tutorialId || item.id) === editingTutorialId ? saved : item))
      } else {
        const saved = await inventoryService.createTutorial(componentId, tutorialForm)
        setTutorials((current) => [...current, saved])
      }
      setTutorialForm({ title: '', url: '', description: '' })
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
    setTutorialForm({
      title: tutorial.title || '',
      url: tutorial.url || '',
      description: tutorial.description || '',
    })
  }

  const deleteImage = async (image) => {
    try {
      await inventoryService.deleteComponentImage(componentId, image.imageId || image.id)
      setSavedImages((current) => current.filter((item) => item !== image))
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa ảnh.'))
    }
  }

  const deleteDatasheet = async () => {
    try {
      await inventoryService.deleteDatasheet(componentId)
      setSavedDatasheetUrl('')
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa datasheet.'))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        componentName: form.componentName.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        specs: form.specifications.trim() ? [form.specifications.trim()] : [],
        unit: form.unit.trim(),
        datasheetUrl: form.datasheetUrl.trim() || null,
        isActive: form.isActive,
      }
      const saved = componentId
        ? await inventoryService.updateComponent(componentId, payload)
        : await inventoryService.createComponent(payload)
      const id = componentId || saved?.componentId || saved?.id
      if (!id && (imageFiles.length || datasheetFile)) {
        throw new Error('Linh kiện đã được lưu nhưng API không trả componentId để tải tệp đính kèm.')
      }
      if (id) {
        for (const file of imageFiles) await inventoryService.uploadComponentImage(id, file)
        if (datasheetFile) await inventoryService.uploadDatasheet(id, datasheetFile)
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
    <PortalLayout headerTitle={componentId ? 'Cập nhật linh kiện' : 'Khai báo linh kiện mới'} headerSubtitle="Khai báo linh kiện riêng biệt, không làm tăng tồn kho">
      <Box sx={{ maxWidth: 920, mx: 'auto' }}>
        <Card variant="outlined" sx={{ borderColor: '#d8dced', borderRadius: 1, boxShadow: 'none' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography sx={{ mb: 0.5, color: '#182238', fontWeight: 800, fontSize: 16 }}>Thông tin linh kiện</Typography>
            <Typography sx={{ mb: 2, color: '#697386', fontSize: 12 }}>Tồn kho chỉ tăng sau khi tạo phiếu nhập.</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
              <Tab label="Thông tin" />
              <Tab label="Ảnh / Datasheet" />
              <Tab label="Tutorial" />
            </Tabs>
            {tab === 0 && (
              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required label="Tên linh kiện" name="componentName" value={form.componentName} onChange={updateField} /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required select label="Danh mục" name="categoryId" value={form.categoryId} onChange={updateField}>
                    {categories.map((category) => <MenuItem key={category.categoryId} value={category.categoryId}>{category.categoryName}</MenuItem>)}
                  </TextField></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Hãng sản xuất" name="manufacturer" value={form.manufacturer} onChange={updateField} /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required label="Đơn vị" name="unit" value={form.unit} onChange={updateField} placeholder="cái, chiếc, hộp..." /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required select label="Loại quản lý" name="trackingType" value={form.trackingType} onChange={updateField}>
                    <MenuItem value="CONSUMABLE">CONSUMABLE - Dùng một lần</MenuItem>
                    <MenuItem value="REUSABLE">REUSABLE - Tái sử dụng</MenuItem>
                    <MenuItem value="HIGH_VALUE">HIGH VALUE - Giá thành cao</MenuItem>
                  </TextField></Grid>
                  <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={2} label="Mô tả" name="description" value={form.description} onChange={updateField} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} label="Thông số kỹ thuật" name="specifications" value={form.specifications} onChange={updateField} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField fullWidth label="Link datasheet (không bắt buộc)" name="datasheetUrl" value={form.datasheetUrl} onChange={updateField} /></Grid>
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={() => navigate('/class-setup/admin/components')}>Hủy</Button>
                  <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu linh kiện'}</Button>
                </Box>
              </Box>
            )}
            {tab === 1 && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography sx={{ mb: 1, fontWeight: 700 }}>Ảnh linh kiện</Typography>
                  {savedImages.map((image) => <Box key={image.imageId || image.id} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="a" href={image.imageUrl || image.url} target="_blank" rel="noreferrer">{image.fileName || image.imageUrl || image.url}</Typography>
                    <Button size="small" color="error" onClick={() => deleteImage(image)}>Xóa</Button>
                  </Box>)}
                  <Button component="label" variant="outlined" sx={{ textTransform: 'none' }}>
                    Chọn ảnh {imageFiles.length ? `(${imageFiles.length})` : ''}
                    <input hidden multiple type="file" accept="image/*" onChange={(event) => setImageFiles([...(event.target.files || [])])} />
                  </Button>
                  <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>{imageFiles.map((file) => file.name).join(', ') || 'Chưa chọn ảnh.'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography sx={{ mb: 1, fontWeight: 700 }}>Datasheet</Typography>
                  {savedDatasheetUrl && <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="a" href={savedDatasheetUrl} target="_blank" rel="noreferrer">{savedDatasheetUrl}</Typography>
                    <Button size="small" color="error" onClick={deleteDatasheet}>Xóa</Button>
                  </Box>}
                  <Button component="label" variant="outlined" sx={{ textTransform: 'none' }}>
                    {datasheetFile?.name || 'Chọn tệp datasheet'}
                    <input hidden type="file" accept=".pdf,.doc,.docx" onChange={(event) => setDatasheetFile(event.target.files?.[0] || null)} />
                  </Button>
                  <Typography sx={{ mt: 1, color: '#697386', fontSize: 12 }}>Tệp sẽ được tải lên sau khi lưu linh kiện.</Typography>
                </Grid>
              </Grid>
            )}
            {tab === 2 && (
              <Box>
                {!componentId && <Alert severity="info" sx={{ mb: 2 }}>Lưu linh kiện trước khi thêm tutorial.</Alert>}
                <Box component="form" onSubmit={saveTutorial} sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField required label="Tiêu đề" value={tutorialForm.title} onChange={(event) => setTutorialForm({ ...tutorialForm, title: event.target.value })} />
                  <TextField required label="URL hướng dẫn" value={tutorialForm.url} onChange={(event) => setTutorialForm({ ...tutorialForm, url: event.target.value })} />
                  <TextField label="Mô tả" value={tutorialForm.description} onChange={(event) => setTutorialForm({ ...tutorialForm, description: event.target.value })} />
                  <Button type="submit" variant="contained" disabled={!componentId}>{editingTutorialId ? 'Cập nhật tutorial' : 'Thêm tutorial'}</Button>
                </Box>
                {tutorials.map((tutorial) => <Box key={tutorial.tutorialId || tutorial.id} sx={{ py: 1, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e4e6ef' }}>
                  <Box><Typography>{tutorial.title}</Typography><Typography component="a" href={tutorial.url} target="_blank" rel="noreferrer">{tutorial.url}</Typography></Box>
                  <Box><Button onClick={() => editTutorial(tutorial)}>Sửa</Button><Button color="error" onClick={() => deleteTutorial(tutorial)}>Xóa</Button></Box>
                </Box>)}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
