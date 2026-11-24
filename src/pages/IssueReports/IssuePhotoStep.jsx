import { useState } from 'react'
import { AddAPhotoOutlined as CameraIcon } from '@mui/icons-material'
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { ISSUE_TYPES } from './issueReportLabels'

/** Bước ảnh: chọn tình trạng và tải ảnh đúng món bị hư (bắt buộc, trừ khi mất). */
export default function IssuePhotoStep({ issueType, onTypeChange, previewUrl, onPickImage, onClearImage, accept }) {
  const [dragging, setDragging] = useState(false)
  const isLost = issueType === 'Lost'

  return (
    <>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>Tình trạng</Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={issueType}
          onChange={(_, value) => value && onTypeChange(value)}
        >
          {ISSUE_TYPES.map((type) => (
            <ToggleButton key={type.value} value={type.value} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {type.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
          Ảnh linh kiện bị hư {isLost ? '(không bắt buộc khi mất)' : '*'}
        </Typography>
        <Box
          component="label"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            onPickImage(event.dataTransfer.files?.[0])
          }}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            minHeight: 220,
            p: 2,
            cursor: 'pointer',
            textAlign: 'center',
            border: '2px dashed',
            borderColor: dragging ? '#0058be' : '#cbd5e1',
            borderRadius: 2,
            bgcolor: dragging ? '#eff6ff' : '#f8fafc',
            '&:hover': { borderColor: '#0058be' },
          }}
        >
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt="Ảnh linh kiện bị hư"
              sx={{ maxHeight: 260, maxWidth: '100%', objectFit: 'contain', borderRadius: 1 }}
            />
          ) : (
            <>
              <CameraIcon sx={{ fontSize: 44, color: '#0058be' }} />
              <Typography sx={{ fontWeight: 700 }}>Chụp hoặc chọn ảnh linh kiện</Typography>
              <Typography variant="caption" color="text.secondary">
                Kéo thả ảnh vào đây cũng được · JPG, PNG, WEBP · tối đa 5 MB
              </Typography>
            </>
          )}
          <input
            hidden
            type="file"
            accept={accept}
            onChange={(event) => {
              onPickImage(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </Box>
        {previewUrl && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Bấm vào ảnh để đổi ảnh khác.</Typography>
            <Button size="small" color="error" onClick={onClearImage} sx={{ textTransform: 'none' }}>Bỏ ảnh</Button>
          </Box>
        )}
      </Box>
    </>
  )
}
