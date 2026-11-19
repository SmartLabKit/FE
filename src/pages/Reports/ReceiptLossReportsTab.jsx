import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Chip, Grid, MenuItem, TextField } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { CHART_COLORS, formatMoney, formatMoneyAxis, formatNumber, stockCardPath } from './reportFormat'
import { ReportSection, ReportTable, StatTile } from './reportUi'
import { BarChart } from './reportCharts'

/**
 * Dựng đủ các tháng trong kỳ [fromDate..toDate] (tháng không có phiếu = 0) từ groups { key: 'yyyy-MM', receiptCount, amount },
 * giống MonthlyReceiptChart bên mobile.
 */
function buildMonthlySeries(groups, fromDate, toDate) {
  const byKey = Object.fromEntries((groups || []).map((group) => [group.key, group]))
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date()
  const to = toDate ? new Date(`${toDate}T00:00:00`) : new Date()
  const months = []
  for (let month = new Date(from.getFullYear(), from.getMonth(), 1); month <= to; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    months.push({
      key,
      label: `T${month.getMonth() + 1}`,
      amount: Number(byKey[key]?.amount || 0),
      receiptCount: byKey[key]?.receiptCount || 0,
    })
  }
  return months
}

const TOP_LOSSES = 5

const GROUP_BY_OPTIONS = [
  { value: 'month', label: 'Theo tháng' },
  { value: 'supplier', label: 'Theo nhà cung cấp' },
  { value: 'category', label: 'Theo danh mục' },
]

/** Tab "Nhập kho & hao hụt" (chỉ Admin / InventoryManager vì có số tiền). */
export default function ReceiptLossReportsTab({ filters }) {
  const { fromDate, toDate } = filters
  const navigate = useNavigate()

  const [groupBy, setGroupBy] = useState('month')
  const receipts = useReport(
    () => reportService.getReceiptReport({ fromDate, toDate, groupBy }),
    [fromDate, toDate, groupBy],
  )
  const losses = useReport(() => reportService.getLosses({ fromDate, toDate }), [fromDate, toDate])

  const groupLabel = GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label
  const topLosses = [...(losses.data?.items || [])]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, TOP_LOSSES)
  const months = groupBy === 'month' && receipts.data ? buildMonthlySeries(receipts.data.groups, fromDate, toDate) : []

  return (
    <>
      <ReportSection
        title="Nhập kho trong kỳ"
        subtitle="Chỉ tính phiếu nhập đã hoàn tất"
        loading={receipts.loading}
        error={receipts.error}
        action={
          <TextField select size="small" label="Gom nhóm" value={groupBy} onChange={(event) => setGroupBy(event.target.value)} sx={{ minWidth: 190 }}>
            {GROUP_BY_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        }
      >
        {receipts.data && (
          <>
            <Grid container spacing={2} sx={{ p: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}><StatTile label="Số phiếu nhập" value={formatNumber(receipts.data.receiptCount)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><StatTile label="Tổng tiền nhập" value={formatMoney(receipts.data.totalAmount)} /></Grid>
            </Grid>
            {months.length > 0 && (
              <BarChart
                categories={months.map((month) => month.label)}
                series={[{ name: 'Tiền nhập', color: CHART_COLORS[0], values: months.map((month) => month.amount) }]}
                formatAxis={formatMoneyAxis}
                minStep={1000000}
                tooltip={(index) => `${months[index].key}: ${formatMoney(months[index].amount)} · ${months[index].receiptCount} phiếu`}
              />
            )}
            <ReportTable
              rows={receipts.data.groups || []}
              rowKey={(row) => row.key}
              emptyText="Không có phiếu nhập trong kỳ."
              columns={[
                { key: 'key', label: groupLabel },
                { key: 'receiptCount', label: 'Số phiếu', align: 'right', render: (row) => formatNumber(row.receiptCount) },
                { key: 'amount', label: 'Thành tiền', align: 'right', render: (row) => formatMoney(row.amount) },
              ]}
            />
          </>
        )}
      </ReportSection>

      <ReportSection title="Hao hụt trong kỳ" subtitle={`Thiết bị mất / thanh lý và vật tư bị điều chỉnh giảm · top ${TOP_LOSSES} linh kiện theo giá trị`} loading={losses.loading} error={losses.error}>
        {losses.data && (
          <>
            <Grid container spacing={2} sx={{ p: 2 }}>
              <Grid size={{ xs: 6, md: 3 }}><StatTile label="Thiết bị mất" value={formatNumber(losses.data.lostUnits)} valueColor="#c62828" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatTile label="Thiết bị thanh lý" value={formatNumber(losses.data.retiredUnits)} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatTile label="Vật tư điều chỉnh giảm" value={formatNumber(losses.data.adjustedOutQuantity)} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tổng giá trị hao hụt" value={formatMoney(losses.data.totalValue)} valueColor="#c62828" /></Grid>
            </Grid>
            <ReportTable
              rows={topLosses}
              rowKey={(row) => row.componentId}
              onRowClick={(row) => navigate(stockCardPath(row.componentId))}
              emptyText="Không có hao hụt trong kỳ."
              columns={[
                { key: 'componentName', label: 'Linh kiện', render: (row) => <><b>{row.componentName}</b><br /><Box component="span" sx={{ color: '#0058be', fontSize: 12 }}>{row.componentCode}</Box></> },
                { key: 'trackingType', label: 'Loại quản lý', render: (row) => <Chip size="small" variant="outlined" label={row.trackingType} sx={{ fontSize: 11 }} /> },
                { key: 'lostUnits', label: 'Mất', align: 'right', render: (row) => formatNumber(row.lostUnits) },
                { key: 'retiredUnits', label: 'Thanh lý', align: 'right', render: (row) => formatNumber(row.retiredUnits) },
                { key: 'adjustedOutQuantity', label: 'Điều chỉnh giảm', align: 'right', render: (row) => formatNumber(row.adjustedOutQuantity) },
                { key: 'value', label: 'Giá trị', align: 'right', render: (row) => formatMoney(row.value) },
              ]}
            />
          </>
        )}
      </ReportSection>
    </>
  )
}
