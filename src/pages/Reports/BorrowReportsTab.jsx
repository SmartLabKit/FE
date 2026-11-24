import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Chip, Grid } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { CHART_COLORS, CHART_DANGER, formatDate, formatDuration, formatNumber, formatPercent, getRows, toLabel } from './reportFormat'
import { GroupBars, ReportBar, ReportSection, ReportTable, StatTile } from './reportUi'
import { BarChart, ShareDonut } from './reportCharts'

const CHART_MAX_CLASSES = 6
const TOP_COMPONENTS = 5
const brokenOf = (row) => Number(row.damagedUnits || 0) + Number(row.lostUnits || 0)
const sumOf = (rows, pick) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0)

const PAGE_SIZE = 10

const componentCell = (row) => (
  <>
    <b>{row.componentName}</b>
    <br />
    <Box component="span" sx={{ color: '#0058be', fontSize: 12 }}>{row.componentCode}</Box>
  </>
)

/** Tab "Mượn trả": thống kê đơn, theo lớp, linh kiện mượn nhiều, quá hạn, hư hỏng / mất. */
export default function BorrowReportsTab({ filters }) {
  const { fromDate, toDate, roomId } = filters
  const navigate = useNavigate()
  const openBorrowRequest = (row) => navigate(`/borrow/requests/${row.borrowRequestId}`)
  const period = { fromDate, toDate, roomId }

  const summary = useReport(() => reportService.getBorrowSummary(period), [fromDate, toDate, roomId])
  const byClass = useReport(() => reportService.getClassUsage(period), [fromDate, toDate, roomId])
  const topComponents = useReport(() => reportService.getTopComponents({ ...period, top: TOP_COMPONENTS }), [fromDate, toDate, roomId])

  const [overduePage, setOverduePage] = useState(1)
  const overdue = useReport(
    () => reportService.getOverdueBorrows({ roomId, page: overduePage, size: PAGE_SIZE }),
    [roomId, overduePage],
  )

  const [damagePage, setDamagePage] = useState(1)
  const damages = useReport(
    () => reportService.getDamages({ ...period, page: damagePage, size: PAGE_SIZE }),
    [fromDate, toDate, roomId, damagePage],
  )

  const classRows = [...getRows(byClass.data)].sort((a, b) => b.issuedQuantity - a.issuedQuantity)
  const chartClasses = classRows.slice(0, CHART_MAX_CLASSES)
  const classTotal = (pick) => (byClass.data ? formatNumber(sumOf(classRows, pick)) : '—')
  const brokenTotal = sumOf(classRows, brokenOf)

  const filterKey = `${fromDate}|${toDate}|${roomId}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setOverduePage(1)
    setDamagePage(1)
  }

  return (
    <>
      <ReportSection title="Thống kê đơn mượn" subtitle="Đơn tính theo ngày tạo, món tính theo ngày giao và ngày trả" loading={summary.loading} error={summary.error}>
        {summary.data && (
          <>
            <Grid container spacing={2} sx={{ p: 2, pb: 0 }}>
              <Grid size={{ xs: 6, md: 4 }}><StatTile label="Đơn tạo trong kỳ" value={formatNumber(summary.data.totalRequests)} /></Grid>
              <Grid size={{ xs: 6, md: 4 }}><StatTile label="Món giao trong kỳ" value={classTotal((row) => row.issuedQuantity)} /></Grid>
              <Grid size={{ xs: 6, md: 4 }}><StatTile label="Sinh viên đang giữ" value={classTotal((row) => row.holdingQuantity)} hint="lúc này" /></Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <StatTile
                  label="Trả hỏng hoặc mất"
                  hint="trong kỳ"
                  value={classTotal(brokenOf)}
                  valueColor={!byClass.data ? undefined : brokenTotal > 0 ? CHART_DANGER : '#2e7d32'}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}><StatTile label="Tỉ lệ từ chối" value={formatPercent(summary.data.rejectionRate)} /></Grid>
              <Grid size={{ xs: 6, md: 4 }}><StatTile label="Thời gian duyệt trung bình" value={formatDuration(summary.data.averageApprovalHours)} /></Grid>
            </Grid>
            <Grid container>
              <Grid size={{ xs: 12, md: 4 }}>
                <ShareDonut
                  title="Đơn theo trạng thái"
                  parts={(summary.data.byStatus || []).map((group) => ({ name: toLabel(group.key), value: group.count }))}
                  format={(value) => `${formatNumber(value)} đơn`}
                  emptyText="Không có đơn mượn trong kỳ."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}><GroupBars title="Theo phòng Lab" groups={summary.data.byRoom} labelOf={(key) => key} /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><GroupBars title="Theo lớp" groups={summary.data.byClass} labelOf={(key) => key} /></Grid>
            </Grid>
          </>
        )}
      </ReportSection>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ReportSection title="Mức mượn theo lớp" subtitle="Giao, trả, hỏng, mất trong kỳ; đang giữ tính lúc này" loading={byClass.loading} error={byClass.error}>
            {chartClasses.length > 0 && (
              <BarChart
                categories={chartClasses.map((row) => row.classCode)}
                series={[
                  { name: 'Đã giao', color: CHART_COLORS[0], values: chartClasses.map((row) => row.issuedQuantity) },
                  { name: 'Hư hỏng hoặc mất', color: CHART_DANGER, values: chartClasses.map(brokenOf) },
                ]}
                tooltip={(index, seriesIndex) => {
                  const row = chartClasses[index]
                  return seriesIndex === 0
                    ? `${row.classCode} · ${formatNumber(row.issuedQuantity)} món đã giao`
                    : `${row.classCode} · ${formatNumber(row.damagedUnits)} hỏng · ${formatNumber(row.lostUnits)} mất`
                }}
                legend
              />
            )}
            <ReportTable
              rows={classRows}
              rowKey={(row) => row.classId}
              emptyText="Không lớp nào mượn đồ trong kỳ."
              columns={[
                { key: 'classCode', label: 'Lớp', render: (row) => <b>{row.classCode}</b> },
                { key: 'requestCount', label: 'Số đơn', align: 'right', render: (row) => formatNumber(row.requestCount) },
                { key: 'issuedQuantity', label: 'Đã giao', align: 'right', render: (row) => formatNumber(row.issuedQuantity) },
                { key: 'returnedQuantity', label: 'Đã trả', align: 'right', render: (row) => formatNumber(row.returnedQuantity) },
                { key: 'holdingQuantity', label: 'Đang giữ', align: 'right', render: (row) => formatNumber(row.holdingQuantity) },
                { key: 'damagedUnits', label: 'Hỏng', align: 'right', render: (row) => formatNumber(row.damagedUnits) },
                { key: 'lostUnits', label: 'Mất', align: 'right', render: (row) => formatNumber(row.lostUnits) },
              ]}
            />
          </ReportSection>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ReportSection title="Linh kiện mượn nhiều nhất" subtitle={`Top ${TOP_COMPONENTS} trong kỳ`} loading={topComponents.loading} error={topComponents.error}>
            <ReportBar
              ranked
              emptyText="Không có gì được mượn trong kỳ."
              items={getRows(topComponents.data).slice(0, TOP_COMPONENTS).map((row) => ({
                key: row.componentId,
                label: row.componentName,
                value: row.totalQuantity,
                display: `${formatNumber(row.totalQuantity)} ${row.unit || ''}`.trim(),
                caption: `trong ${formatNumber(row.timesBorrowed)} đơn`,
              }))}
            />
          </ReportSection>
        </Grid>
      </Grid>

      <ReportSection title="Đơn mượn quá hạn" subtitle="Tính tại thời điểm hiện tại, trễ lâu nhất trước" loading={overdue.loading} error={overdue.error}>
        <ReportTable
          rows={getRows(overdue.data)}
          rowKey={(row) => row.borrowRequestId}
          onRowClick={openBorrowRequest}
          emptyText="Không có đơn mượn quá hạn."
          columns={[
            { key: 'requestCode', label: 'Mã đơn', render: (row) => <Box component="span" sx={{ color: '#0058be', fontWeight: 600 }}>{row.requestCode}</Box> },
            { key: 'requesterName', label: 'Người mượn', render: (row) => <>{row.requesterName}<br /><Box component="span" sx={{ color: '#697386', fontSize: 12 }}>{row.requesterUsername}</Box></> },
            { key: 'classCode', label: 'Lớp / Project', render: (row) => <>{row.classCode || '—'}<br /><Box component="span" sx={{ color: '#697386', fontSize: 12 }}>{row.projectTitle || ''}</Box></> },
            { key: 'roomCode', label: 'Lab' },
            { key: 'dueDate', label: 'Hạn trả', render: (row) => formatDate(row.dueDate) },
            { key: 'daysOverdue', label: 'Trễ', align: 'right', render: (row) => <Chip size="small" color="error" label={`${row.daysOverdue} ngày`} /> },
            {
              key: 'outstandingItems',
              label: 'Chưa trả',
              render: (row) => (row.outstandingItems || [])
                .map((item) => `${item.componentName}${item.itemCode ? ` (${item.itemCode})` : ''} x${item.quantity}`)
                .join(', '),
            },
          ]}
          pagination={{ page: overduePage, size: PAGE_SIZE, totalCount: overdue.data?.totalCount, onPageChange: setOverduePage }}
        />
      </ReportSection>

      <ReportSection title="Linh kiện hư hỏng / mất khi trả" subtitle="Theo ngày trả trong kỳ, chỉ thống kê, không bồi thường" loading={damages.loading} error={damages.error}>
        <ReportTable
          rows={getRows(damages.data)}
          onRowClick={openBorrowRequest}
          rowKey={(row) => `${row.borrowRequestId}-${row.componentCode}-${row.itemCode || ''}-${row.returnedAt}`}
          emptyText="Không có đồ hư hỏng hoặc mất trong kỳ."
          columns={[
            { key: 'requestCode', label: 'Mã đơn', render: (row) => <Box component="span" sx={{ color: '#0058be', fontWeight: 600 }}>{row.requestCode}</Box> },
            { key: 'requesterName', label: 'Người mượn', render: (row) => <>{row.requesterName}<br /><Box component="span" sx={{ color: '#697386', fontSize: 12 }}>{row.requesterUsername}</Box></> },
            { key: 'classCode', label: 'Lớp', render: (row) => row.classCode || '—' },
            { key: 'componentName', label: 'Linh kiện', render: componentCell },
            { key: 'itemCode', label: 'Mã thiết bị', render: (row) => row.itemCode || '—' },
            { key: 'returnCondition', label: 'Tình trạng', render: (row) => <Chip size="small" color={row.returnCondition === 'Lost' ? 'error' : 'warning'} label={toLabel(row.returnCondition)} /> },
            { key: 'returnedAt', label: 'Ngày trả', render: (row) => formatDate(row.returnedAt) },
          ]}
          pagination={{ page: damagePage, size: PAGE_SIZE, totalCount: damages.data?.totalCount, onPageChange: setDamagePage }}
        />
      </ReportSection>
    </>
  )
}
