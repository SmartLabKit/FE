import { useEffect, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Grid, TextField } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useReport } from '../../hooks/useReport'
import { inventoryService } from '../../services/inventoryService'
import { reportService } from '../../services/reportService'
import { getDisplayCode } from '../Components/componentHelpers'
import { formatNumber, movementLabel } from './reportFormat'
import { ReportSection, ReportTable, StatTile } from './reportUi'

const signed = (value, sign) => (Number(value) > 0 ? `${sign}${formatNumber(value)}` : '')

/**
 * Tab "Thẻ kho": tồn đầu, nhập / xuất theo loại giao dịch và tồn cuối của 1 linh kiện trong kỳ.
 * Linh kiện đang chọn nằm trên URL (?componentId=...) để các bảng khác bấm sang được và link gửi đi vẫn đúng.
 */
export default function StockMovementTab({ filters }) {
  const { fromDate, toDate, roomId } = filters
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const limitedToLab = Boolean(roomId) || !(hasRole?.('Admin') || hasRole?.('InventoryManager'))
  const canOpenComponent = hasRole?.('InventoryManager')
  const [searchParams, setSearchParams] = useSearchParams()
  const componentId = searchParams.get('componentId') || undefined

  const [components, setComponents] = useState([])

  useEffect(() => {
    let active = true
    inventoryService.getComponents()
      .then((items) => { if (active) setComponents(items) })
      .catch(() => { if (active) setComponents([]) })
    return () => { active = false }
  }, [])

  const component = components.find((item) => item.componentId === componentId) || null

  const selectComponent = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('componentId', value.componentId)
    else next.delete('componentId')
    setSearchParams(next, { replace: true })
  }

  const movements = useReport(
    () => reportService.getStockMovements({ componentId, roomId, fromDate, toDate }),
    [componentId, roomId, fromDate, toDate],
    Boolean(componentId),
  )
  const data = componentId ? movements.data : null
  const unit = data?.unit ? ` ${data.unit}` : ''

  return (
    <ReportSection
      title={data?.componentName || component?.componentName || 'Thẻ kho'}
      subtitle={data?.componentCode || component
        ? `${data?.componentCode || getDisplayCode(component)} · tối đa 366 ngày`
        : 'Tối đa 366 ngày, mặc định 30 ngày gần nhất'}
      loading={movements.loading}
      error={movements.error}
      action={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Autocomplete
            size="small"
            options={components}
            value={component}
            onChange={(_, value) => selectComponent(value)}
            getOptionLabel={(option) => `${getDisplayCode(option)} · ${option.componentName}`}
            isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
            renderInput={(params) => <TextField {...params} label="Chọn linh kiện" />}
            sx={{ minWidth: { xs: '100%', sm: 320 } }}
          />
          {canOpenComponent && componentId && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(`/class-setup/admin/components/${componentId}/edit`)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Mở linh kiện
            </Button>
          )}
        </Box>
      }
    >
      {!componentId && <Alert severity="info" sx={{ m: 2 }}>Chọn một linh kiện để xem thẻ kho.</Alert>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tồn đầu kỳ" value={`${formatNumber(data.openingBalance)}${unit}`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Nhập" value={`${signed(data.totalIn, '+') || 0}${unit}`} valueColor={data.totalIn > 0 ? '#2e7d32' : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Xuất" value={`${signed(data.totalOut, '−') || 0}${unit}`} valueColor={data.totalOut > 0 ? '#c62828' : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tồn cuối kỳ" value={`${formatNumber(data.closingBalance)}${unit}`} /></Grid>
          </Grid>
          <Alert severity="info" sx={{ mx: 2, mb: 2, py: 0 }}>
            {limitedToLab ? 'Chuyển giữa các tủ trong lab này không tính là nhập, xuất.' : 'Chuyển giữa các tủ, các lab không tính là nhập, xuất.'}
            {' '}Phiếu nhập đã hủy cũng không tính.
          </Alert>
          <ReportTable
            rows={data.types || []}
            rowKey={(row) => row.type}
            emptyText="Không có nhập xuất trong kỳ."
            columns={[
              { key: 'type', label: 'Loại giao dịch', render: (row) => movementLabel(row.type) },
              { key: 'quantityIn', label: 'Nhập', align: 'right', render: (row) => <Box component="span" sx={{ color: '#2e7d32', fontWeight: 600 }}>{signed(row.quantityIn, '+')}</Box> },
              { key: 'quantityOut', label: 'Xuất', align: 'right', render: (row) => <Box component="span" sx={{ color: '#c62828', fontWeight: 600 }}>{signed(row.quantityOut, '−')}</Box> },
            ]}
          />
        </>
      )}
    </ReportSection>
  )
}
