import { getVietnamDateInputValue, formatVietnamDate } from '../../utils/dateFormatting'
import { getComponentShortCode, getDisplayCode, normalizeSearchText } from './componentHelpers'

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`

/** Linh kiện của một dòng Excel: ưu tiên mã (mã hệ thống hoặc mã viết tắt), không có mã khớp mới tìm theo tên. */
export function findReceiptComponent(components, row) {
  const code = normalizeSearchText(row.componentCode)
  const name = normalizeSearchText(row.componentName)
  return (
    (code &&
      (components.find((c) => normalizeSearchText(c.componentCode) === code) ||
        components.find((c) => normalizeSearchText(getComponentShortCode(c)) === code))) ||
    (name && components.find((c) => normalizeSearchText(c.componentName) === name)) ||
    null
  )
}

/** Dòng Excel có tên khác với linh kiện tìm được theo mã: thường là ghi nhầm mã. */
export function hasDifferentName(component, row) {
  const name = normalizeSearchText(row.componentName)
  return Boolean(name) && name !== normalizeSearchText(component.componentName)
}

const uniquePrices = (values) => [...new Set(values.map(Number))].sort((a, b) => a - b)
const totalOf = (list) => list.reduce((sum, x) => sum + Number(x.quantity || 0), 0)

function groupBy(list, keyOf) {
  const map = new Map()
  list.forEach((x) => {
    const key = keyOf(x)
    map.set(key, [...(map.get(key) || []), x])
  })
  return map
}

function priceNotes(rows, lines) {
  if (rows.some((row) => row.unitPrice === '')) return []
  const filePrices = uniquePrices(rows.map((row) => row.unitPrice))
  const receiptPrices = uniquePrices(lines.map((line) => line.unitPrice))
  if (filePrices.join() === receiptPrices.join()) return []
  return [`Đơn giá: file ${filePrices.map(money).join(', ')}, phiếu ${receiptPrices.map(money).join(', ')}`]
}

function cabinetNotes(rows, lines, cabinets) {
  const inReceipt = (text) =>
    lines.some((line) => {
      const cabinet = cabinets.find((c) => c.cabinetId === line.cabinetId)
      return [line.cabinetCode, cabinet?.cabinetName].some((x) => x && normalizeSearchText(x) === text)
    })
  const wrong = [...new Set(rows.map((row) => row.cabinetCode).filter((x) => x && !inReceipt(normalizeSearchText(x))))]
  if (wrong.length === 0) return []
  return [`Tủ: file ${wrong.join(', ')}, phiếu ${[...new Set(lines.map((line) => line.cabinetCode))].join(', ')}`]
}

function unitNotes(rows, lines) {
  const fileUnits = rows.flatMap((row) =>
    row.serialsText
      .split('\n')
      .filter(Boolean)
      .map((serial) => ({ serial, version: row.version, warranty: row.warrantyExpiresAt }))
  )
  const units = new Map(
    lines.flatMap((line) => line.units || []).map((unit) => [normalizeSearchText(unit.serialNumber), unit])
  )
  if (fileUnits.length === 0 || units.size === 0) return []
  const fileSerials = new Set(fileUnits.map((x) => normalizeSearchText(x.serial)))
  const missing = fileUnits.filter((x) => !units.has(normalizeSearchText(x.serial))).map((x) => x.serial)
  const extra = [...units.entries()].filter(([serial]) => !fileSerials.has(serial)).map(([, unit]) => unit.serialNumber)

  const notes = []
  if (missing.length > 0) notes.push(`Serial có trong file, không có trong phiếu: ${missing.join(', ')}`)
  if (extra.length > 0) notes.push(`Serial có trong phiếu, không có trong file: ${extra.join(', ')}`)
  fileUnits.forEach(({ serial, version, warranty }) => {
    const unit = units.get(normalizeSearchText(serial))
    if (!unit) return
    if (version && version !== unit.hardwareVersion) {
      notes.push(`${serial}: version file ${version}, phiếu ${unit.hardwareVersion || 'trống'}`)
    }
    const saved = unit.warrantyExpiresAt ? getVietnamDateInputValue(unit.warrantyExpiresAt) : ''
    if (warranty && warranty !== saved) {
      notes.push(`${serial}: bảo hành file ${formatVietnamDate(warranty)}, phiếu ${saved ? formatVietnamDate(saved) : 'trống'}`)
    }
  })
  return notes
}

/**
 * So file Excel với phiếu nhập, mỗi linh kiện một dòng (gộp các dòng cùng linh kiện).
 * status: unknown (file ghi mã không tồn tại), missing (file có, phiếu không), extra (phiếu có, file không), diff (lệch), match,
 * Ô để trống trong file (đơn giá, tủ, version, bảo hành) thì không so.
 */
export function compareReceiptWithExcel(lines, rows, components, cabinets = []) {
  const matched = rows.map((row) => ({ row, component: findReceiptComponent(components, row) }))
  const fileGroups = groupBy(matched.filter((x) => x.component), (x) => x.component.componentId)
  const lineGroups = groupBy(lines, (line) => line.componentId)

  const results = matched
    .filter((x) => !x.component)
    .map(({ row }) => ({
      key: `row-${row.rowNumber}`,
      status: 'unknown',
      code: row.componentCode || '—',
      name: row.componentName || '—',
      fileQuantity: row.quantity === '' ? null : Number(row.quantity),
      receiptQuantity: null,
      notes: [`Dòng #${row.rowNumber}: không tìm thấy linh kiện này trong hệ thống`],
    }))

  fileGroups.forEach((group, componentId) => {
    const { component } = group[0]
    const fileRows = group.map((x) => x.row)
    const receiptLines = lineGroups.get(componentId) || []
    const fileQuantity = totalOf(fileRows)
    const receiptQuantity = totalOf(receiptLines)
    const notes = fileRows
      .filter((row) => hasDifferentName(component, row))
      .map((row) => `Dòng #${row.rowNumber}: file ghi tên "${row.componentName}", mã này là "${component.componentName}"`)
    if (receiptLines.length > 0) {
      if (fileQuantity !== receiptQuantity) notes.unshift(`Số lượng: file ${fileQuantity}, phiếu ${receiptQuantity}`)
      notes.push(
        ...priceNotes(fileRows, receiptLines),
        ...cabinetNotes(fileRows, receiptLines, cabinets),
        ...unitNotes(fileRows, receiptLines)
      )
    }
    let status = notes.length > 0 ? 'diff' : 'match'
    if (receiptLines.length === 0) status = 'missing'
    results.push({
      key: componentId,
      status,
      code: getDisplayCode(component),
      name: component.componentName,
      fileQuantity,
      receiptQuantity: receiptLines.length > 0 ? receiptQuantity : null,
      notes,
    })
  })

  lineGroups.forEach((receiptLines, componentId) => {
    if (fileGroups.has(componentId)) return
    results.push({
      key: componentId,
      status: 'extra',
      code: receiptLines[0].componentCode,
      name: receiptLines[0].componentName,
      fileQuantity: null,
      receiptQuantity: totalOf(receiptLines),
      notes: [],
    })
  })

  const order = ['unknown', 'missing', 'extra', 'diff', 'match']
  return results.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.code.localeCompare(b.code))
}
