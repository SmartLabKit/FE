import { useEffect, useState } from 'react'
import { Alert, Autocomplete, Grid, TextField } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { inventoryService } from '../../services/inventoryService'
import { reportService } from '../../services/reportService'
import { formatNumber, toLabel } from './reportFormat'
import { ReportSection, ReportTable, StatTile } from './reportUi'

/** Tab "Thẻ kho": tồn đầu, nhập / xuất theo loại giao dịch và tồn cuối của 1 linh kiện trong kỳ. */
export default function StockMovementTab({ filters }) {
  const { fromDate, toDate, roomId } = filters

  const [components, setComponents] = useState([])
  const [component, setComponent] = useState(null)

  useEffect(() => {
    let active = true
    inventoryService.getComponents()
      .then((items) => { if (active) setComponents(items) })
      .catch(() => { if (active) setComponents([]) })
    return () => { active = false }
  }, [])

  const componentId = component?.componentId
  // BE bắt buộc componentId nên chỉ gọi API khi đã chọn linh kiện
  const movements = useReport(
    () => reportService.getStockMovements({ componentId, roomId, fromDate, toDate }),
    [componentId, roomId, fromDate, toDate],
    Boolean(componentId),
  )
  const data = componentId ? movements.data : null

  return (
    <ReportSection
      title="Thẻ kho"
      subtitle="Tối đa 366 ngày, mặc định 30 ngày gần nhất"
      loading={movements.loading}
      error={movements.error}
      action={
        <Autocomplete
          size="small"
          options={components}
          value={component}
          onChange={(_, value) => setComponent(value)}
          getOptionLabel={(option) => `${option.componentCode} · ${option.componentName}`}
          isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
          renderInput={(params) => <TextField {...params} label="Chọn linh kiện" />}
          sx={{ minWidth: { xs: '100%', sm: 320 } }}
        />
      }
    >
      {!componentId && <Alert severity="info" sx={{ m: 2 }}>Chọn một linh kiện để xem thẻ kho.</Alert>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tồn đầu kỳ" value={`${formatNumber(data.openingBalance)} ${data.unit || ''}`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tổng nhập" value={formatNumber(data.totalIn)} color="#2e7d32" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tổng xuất" value={formatNumber(data.totalOut)} color="#c62828" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tồn cuối kỳ" value={`${formatNumber(data.closingBalance)} ${data.unit || ''}`} /></Grid>
          </Grid>
          <ReportTable
            rows={data.types || []}
            rowKey={(row) => row.type}
            emptyText="Không có giao dịch trong kỳ."
            columns={[
              { key: 'type', label: 'Loại giao dịch', render: (row) => toLabel(row.type) },
              { key: 'quantityIn', label: 'Nhập', align: 'right', render: (row) => formatNumber(row.quantityIn) },
              { key: 'quantityOut', label: 'Xuất', align: 'right', render: (row) => formatNumber(row.quantityOut) },
            ]}
          />
        </>
      )}
    </ReportSection>
  )
}
