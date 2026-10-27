import { useState } from 'react'
import {
  AddPhotoAlternate as AddPhotoIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { saveComponent } from './componentStore'

const componentTypes = [
  'Vi điều khiển',
  'Điện trở',
  'Tụ điện',
  'Khay hàn',
  'LED',
  'Dụng cụ đo',
  'Khác',
]

function FormField({ label, required, children }) {
  return (
    <Box>
      <Typography sx={{ mb: 0.75, color: '#263247', fontSize: 11, fontWeight: 600 }}>
        {label}{required && ' *'}
      </Typography>
      {children}
    </Box>
  )
}

export default function NewComponent() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    code: '',
    category: 'Vi điều khiển',
    specifications: '',
    sampleCode: '',
    expectedQuantity: '1',
  })
  const [datasheetName, setDatasheetName] = useState('')
  const [error, setError] = useState('')

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    try {
      saveComponent({
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
        sampleCode: form.sampleCode.trim(),
        datasheet: datasheetName,
        stock: 0,
        location: '',
        expectedQuantity: Number(form.expectedQuantity),
      })
      navigate('/class-setup/admin/components', {
        state: { createdComponentName: form.name.trim() },
      })
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu linh kiện. Vui lòng thử lại.')
    }
  }

  return (
    <PortalLayout
      headerTitle="Khai báo linh kiện mới"
    >
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Card
          variant="outlined"
          sx={{ borderColor: '#d8dced', borderRadius: 1, boxShadow: 'none' }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 16 }}>
                Khai báo linh kiện mới
              </Typography>
  
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Grid container spacing={1.75}>
                    <Grid size={12}>
                      <FormField label="Tên linh kiện" required>
                        <Box
                          component="input"
                          required
                          name="name"
                          value={form.name}
                          onChange={updateField}
                          placeholder="e.g. ESP32 DevKitC V4"
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            height: 35,
                            px: 1.25,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            color: '#263247',
                            fontFamily: 'inherit',
                            '&:focus': { outline: '2px solid #0865ce', outlineOffset: -1 },
                          }}
                        />
                      </FormField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormField label="Mã linh kiện" required>
                        <Box
                          component="input"
                          required
                          name="code"
                          value={form.code}
                          onChange={updateField}
                          placeholder="e.g. MCU-ESP32-04"
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            height: 35,
                            px: 1.25,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            color: '#263247',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            '&:focus': { outline: '2px solid #0865ce', outlineOffset: -1 },
                          }}
                        />
                      </FormField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormField label="Loại linh kiện" required>
                        <Box
                          component="select"
                          required
                          name="category"
                          value={form.category}
                          onChange={updateField}
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            height: 35,
                            px: 1,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            bgcolor: '#fff',
                            color: '#263247',
                            fontFamily: 'inherit',
                            fontSize: 12,
                          }}
                        >
                          {componentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </Box>
                      </FormField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormField label="Số lượng dự kiến" required>
                        <Box
                          component="input"
                          required
                          type="number"
                          min="1"
                          step="1"
                          name="expectedQuantity"
                          value={form.expectedQuantity}
                          onChange={updateField}
                          placeholder="1"
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            height: 35,
                            px: 1.25,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            color: '#263247',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            '&:focus': { outline: '2px solid #0865ce', outlineOffset: -1 },
                          }}
                        />
                      </FormField>
                    </Grid>

                    <Grid size={12}>
                      <FormField label="Thông số kỹ thuật">
                        <Box
                          component="textarea"
                          name="specifications"
                          value={form.specifications}
                          onChange={updateField}
                          placeholder="e.g. Dual Core 240MHz, 4MB Flash, Type-C, 3.3V..."
                          rows={3}
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            px: 1.25,
                            py: 1,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            color: '#263247',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            resize: 'vertical',
                            '&:focus': { outline: '2px solid #0865ce', outlineOffset: -1 },
                          }}
                        />
                      </FormField>
                    </Grid>

                    <Grid size={12}>
                      <FormField label="Mã code mẫu">
                        <Box
                          component="input"
                          name="sampleCode"
                          value={form.sampleCode}
                          onChange={updateField}
                          placeholder="e.g. esp32_blink.ino"
                          sx={{
                            boxSizing: 'border-box',
                            width: '100%',
                            height: 35,
                            px: 1.25,
                            border: '1px solid #cbd2e1',
                            borderRadius: 1,
                            color: '#263247',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            '&:focus': { outline: '2px solid #0865ce', outlineOffset: -1 },
                          }}
                        />
                      </FormField>
                    </Grid>
                  </Grid>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      border: '1px solid #d8dced',
                      borderRadius: 1,
                      bgcolor: '#faf9ff',
                    }}
                  >
                    <Typography sx={{ mb: 1.25, color: '#596477', fontSize: 11 }}>
                      Thông số kỹ thuật
                    </Typography>
                    <Box sx={{ p: 1, mb: 1.25, border: '1px solid #d8dced', borderRadius: 1, bgcolor: '#fff' }}>
                      {[
                        ['Loại linh kiện', form.category],
                        ['Thông số', form.specifications || 'Chưa cập nhật'],
                        ['Datasheet', datasheetName || 'Chưa tải lên'],
                      ].map(([label, value]) => (
                        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5, '&:last-child': { mb: 0 } }}>
                          <Typography sx={{ color: '#596477', fontSize: 9, flexShrink: 0 }}>{label}</Typography>
                          <Typography sx={{ color: '#263247', fontSize: 9, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    <Box sx={{ p: 1, mb: 1.25, border: '1px solid #d8dced', borderRadius: 1, bgcolor: '#fff' }}>
                      <Typography sx={{ color: '#596477', fontSize: 9 }}>Mã code mẫu</Typography>
                      <Typography sx={{ mt: 0.5, color: '#263247', fontSize: 9 }}>
                        {form.sampleCode || 'Chưa có mã code mẫu'}
                      </Typography>
                    </Box>

                    <Button
                      component="label"
                      fullWidth
                      sx={{
                        minHeight: 74,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        border: '1px dashed #cbd2e1',
                        borderRadius: 1,
                        color: '#0865ce',
                        bgcolor: '#fff',
                        textTransform: 'none',
                        '&:hover': { bgcolor: '#f7f9ff' },
                      }}
                    >
                      <AddPhotoIcon sx={{ fontSize: 20 }} />
                      <Typography sx={{ color: '#596477', fontSize: 9 }}>
                        {datasheetName || 'Datasheet linh kiện'}
                      </Typography>
                      <Typography sx={{ fontSize: 9 }}>Tải lên</Typography>
                      <Box
                        component="input"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        hidden
                        onChange={(event) => setDatasheetName(event.target.files?.[0]?.name || '')}
                      />
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/class-setup/admin/components')}
                  sx={{ px: 2, borderColor: '#d8dced', color: '#596477', textTransform: 'none', fontSize: 12 }}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    px: 2.5,
                    bgcolor: '#0865ce',
                    boxShadow: 'none',
                    textTransform: 'none',
                    fontSize: 12,
                    '&:hover': { bgcolor: '#0757b2', boxShadow: 'none' },
                  }}
                >
                  Lưu linh kiện
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </PortalLayout>
  )
}
