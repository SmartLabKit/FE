const STORAGE_KEY = 'smartlabkit_components'
const STOCK_INWARDS_STORAGE_KEY = 'smartlabkit_stock_inwards'

export const INITIAL_COMPONENTS = [
  { name: 'Điện trở kim loại 10kΩ', code: 'RES-10K-01', category: 'Điện trở', stock: '500', location: 'A-02' },
  { name: 'Tụ gốm 10uF', code: 'CAP-10U-02', category: 'Tụ điện', stock: '300', location: 'A-03' },
  { name: 'Arduino Uno R3', code: 'MCU-ARD-01', category: 'Vi điều khiển', stock: '15', location: 'B-01' },
  { name: 'Breadboard 400 điểm', code: 'BRD-SLD-05', category: 'Khay hàn', stock: '50', location: 'C-02' },
  { name: 'LED đỏ 5mm', code: 'LED-RED-01', category: 'LED', stock: '100', location: 'D-01' },
  { name: 'Probe oscilloscope 100MHz', code: 'PRB-OSC-01', category: 'Dụng cụ đo', stock: '10', location: 'E-01' },
]

function getSavedComponents() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return []

  const parsed = JSON.parse(saved)
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu linh kiện đã lưu không hợp lệ.')
  }

  return parsed
}

export function getComponents() {
  const savedComponents = getSavedComponents()
  const savedCodes = new Set(savedComponents.map((component) => component.code))
  return [
    ...savedComponents,
    ...INITIAL_COMPONENTS.filter((component) => !savedCodes.has(component.code)),
  ]
}

export function getPendingInboundComponents() {
  const inwards = getStockInwards()
  const components = getComponents()
  return components.filter((component) => {
    const hasStockInward = inwards.some((inward) => (
      inward.items?.some((item) => item.componentCode === component.code) ||
      inward.componentCode === component.code
    ))
    return !hasStockInward && !component.location && Number(component.stock || 0) === 0
  })
}

export function saveComponent(component) {
  const existing = getComponents().find(
    (item) => item.code.trim().toLowerCase() === component.code.trim().toLowerCase()
  )
  if (existing) {
    throw new Error('Mã linh kiện đã tồn tại. Vui lòng nhập mã khác.')
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify([component, ...getSavedComponents()]))
}

export function updateComponentLocation(code, location, quantity) {
  const component = getComponents().find((item) => item.code === code)
  if (!component) {
    throw new Error('Không tìm thấy linh kiện trong danh mục.')
  }

  const updatedComponent = {
    ...component,
    stock: Number(component.stock || 0) + quantity,
    location,
  }
  const savedComponents = getSavedComponents().filter((item) => item.code !== code)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([updatedComponent, ...savedComponents]))
  return updatedComponent
}

const INITIAL_STOCK_INWARDS = [
  { id: 'NK-2026-104', date: '14/02/2026', supplier: 'Công ty TNHH Linh kiện Điện tử Việt', quantity: 120, totalValue: 1200000, status: 'Hoàn tất' },
  { id: 'NK-2026-103', date: '14/02/2026', supplier: 'Farnell Electronics', quantity: 48, totalValue: 980000, status: 'Đang xử lý' },
  { id: 'NK-2026-102', date: '13/02/2026', supplier: 'Seeed Studio', quantity: 210, totalValue: 2400000, status: 'Hoàn tất' },
  { id: 'NK-2026-101', date: '13/02/2026', supplier: 'Adafruit Industries', quantity: 86, totalValue: 1100000, status: 'Đang xử lý' },
  { id: 'NK-2026-100', date: '12/02/2026', supplier: 'SparkFun Electronics', quantity: 32, totalValue: 640000, status: 'Hoàn tất' },
  { id: 'NK-2026-099', date: '12/02/2026', supplier: 'Digi-Key Electronics', quantity: 75, totalValue: 920000, status: 'Đang xử lý' },
  { id: 'NK-2026-098', date: '11/02/2026', supplier: 'Mouser Electronics', quantity: 56, totalValue: 1800000, status: 'Hoàn tất' },
]

function getSavedStockInwards() {
  const saved = localStorage.getItem(STOCK_INWARDS_STORAGE_KEY)
  if (!saved) return []

  const parsed = JSON.parse(saved)
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu phiếu nhập kho đã lưu không hợp lệ.')
  }

  return parsed
}

export function getStockInwards() {
  return [...getSavedStockInwards(), ...INITIAL_STOCK_INWARDS]
}

export function saveStockInward(inward) {
  if (!Array.isArray(inward.items) || inward.items.length === 0) {
    throw new Error('Vui lòng chọn ít nhất một linh kiện để nhập kho.')
  }

  const catalog = getComponents()
  const items = inward.items.map((item) => {
    const component = catalog.find((entry) => entry.code === item.componentCode)
    if (!component) {
      throw new Error(`Không tìm thấy linh kiện ${item.componentCode} trong danh mục.`)
    }
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
      throw new Error(`Số lượng thực nhận của ${component.name} phải lớn hơn 0.`)
    }
    if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) {
      throw new Error(`Đơn giá của ${component.name} không hợp lệ.`)
    }
    return {
      componentCode: component.code,
      componentName: component.name,
      expectedQuantity: Number(component.expectedQuantity || 1),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalValue: Number(item.quantity) * Number(item.unitPrice),
    }
  })

  const existing = getSavedStockInwards()
  const nextSequence = 105 + existing.length
  const date = new Date(`${inward.date}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Ngày nhập kho không hợp lệ.')
  }

  const record = {
    id: `NK-${date.getFullYear()}-${String(nextSequence).padStart(3, '0')}`,
    date: new Intl.DateTimeFormat('vi-VN').format(date),
    supplier: inward.supplier.trim(),
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: items.reduce((sum, item) => sum + item.totalValue, 0),
    status: 'Chờ phân bổ',
    createdToday: inward.createdToday,
  }

  localStorage.setItem(STOCK_INWARDS_STORAGE_KEY, JSON.stringify([record, ...existing]))
  return record
}

export function getStockInwardById(id) {
  return getStockInwards().find((record) => record.id === id)
}

export function allocateStockInward(id, location) {
  const existing = getSavedStockInwards()
  const record = existing.find((item) => item.id === id)
  if (!record) {
    throw new Error('Không tìm thấy phiếu nhập kho cần phân bổ.')
  }
  if (record.status === 'Hoàn tất') {
    throw new Error('Phiếu nhập này đã được phân bổ trước đó.')
  }
  if (!Array.isArray(record.items) || record.items.length === 0) {
    if (!record.componentCode || !record.quantity) {
      throw new Error('Phiếu nhập này chưa có linh kiện hoặc số lượng thực nhận.')
    }
    updateComponentLocation(record.componentCode, location, Number(record.quantity))
    const updatedRecords = existing.map((item) => (
      item.id === id
        ? { ...item, location, status: 'Hoàn tất', allocatedAt: new Date().toISOString() }
        : item
    ))
    localStorage.setItem(STOCK_INWARDS_STORAGE_KEY, JSON.stringify(updatedRecords))
    return
  }

  const locations = typeof location === 'string'
    ? Object.fromEntries(record.items.map((item) => [item.componentCode, location]))
    : location
  for (const item of record.items) {
    if (!locations[item.componentCode]) {
      throw new Error(`Vui lòng chọn vị trí lưu trữ cho ${item.componentName}.`)
    }
  }
  record.items.forEach((item) => {
    updateComponentLocation(item.componentCode, locations[item.componentCode], Number(item.quantity))
  })
  const updatedRecords = existing.map((item) => (
    item.id === id
      ? {
          ...item,
          items: item.items.map((line) => ({
            ...line,
            location: locations[line.componentCode],
          })),
          location: locations[item.items[0].componentCode],
          status: 'Hoàn tất',
          allocatedAt: new Date().toISOString(),
        }
      : item
  ))
  localStorage.setItem(STOCK_INWARDS_STORAGE_KEY, JSON.stringify(updatedRecords))
}
