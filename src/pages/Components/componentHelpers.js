/**
 * Helper hỗ trợ trích xuất hình ảnh, tài liệu, mã viết tắt tra cứu nhanh, đơn giá chuẩn,
 * tutorial YouTube/PDF và dữ liệu phân bổ kho theo Lab cho linh kiện.
 */

// Bỏ dấu tiếng Việt và chuẩn hóa chuỗi để phục vụ tìm kiếm không dấu & sinh mã viết tắt
export function stripVietnameseDiacritics(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function normalizeSearchText(value = '') {
  return stripVietnameseDiacritics(value).toLowerCase().trim()
}

// Tập từ viết tắt kỹ thuật ngắn nên giữ nguyên thay vì cắt còn 1 chữ cái
const TECH_TOKENS = new Set([
  'ESP', 'STM', 'ARM', 'MCU', 'CPU', 'GPU', 'LED', 'LCD', 'OLED', 'TFT', 'I2C', 'SPI', 'UART',
  'USB', 'PWM', 'ADC', 'DAC', 'PIR', 'NFC', 'RFID', 'GPS', 'GSM', 'BLE', 'WIFI', 'LORA', 'CAN',
  'TTL', 'DIP', 'SMD', 'PCB', 'UNO', 'NANO', 'MEGA', 'PRO', 'MINI', 'DEV', 'KIT', 'DC', 'AC',
  'MOSFET', 'IGBT', 'BJT', 'IC', 'OPAMP', 'RELAY', 'SERVO', 'STEP', 'CNC', 'RPM', 'KHZ', 'MHZ',
  'OHM', 'UF', 'NF', 'PF', 'MAH', 'WATT', 'VOLT', 'AMP', 'GND', 'VCC', 'PNP', 'NPN', 'RGB',
])

/**
 * Tự động sinh mã viết tắt kiểu thuốc y tế từ tên linh kiện để tìm kiếm siêu nhanh.
 * Quy tắc:
 * - Các từ mô tả tiếng Việt/Anh lấy chữ cái đầu viết hoa gộp thành nhóm tiền tố (VD: "Cảm biến nhiệt độ độ ẩm" -> "CBNDDA").
 * - Các mã model / thông số có chứa số hoặc ký hiệu kỹ thuật (VD: "DHT22", "ESP32", "10K", "R3", "SG90", "OLED", "I2C") giữ nguyên gọn.
 * Ví dụ:
 * - "Cảm biến nhiệt độ độ ẩm DHT22" -> "CBNDDA-DHT22"
 * - "Kit phát triển WiFi ESP32-WROOM-32" -> "KPT-WIFI-ESP32W32"
 * - "Điện trở cắm 10K Ohm 1/4W" -> "DTC-10K-14W"
 */
export function generateComponentShortCode(componentName = '', categoryName = '') {
  const cleaned = stripVietnameseDiacritics(componentName)
    .replace(/[()[\],;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const rawTokens = cleaned.split(/[\s/]+/).filter(Boolean)
  const prefixInitials = []
  const specTokens = []

  rawTokens.forEach((token) => {
    const upper = token.toUpperCase().replace(/[^A-Z0-9.-]/g, '')
    if (!upper) return

    // Token chứa số (ESP32, DHT22, 10K, 0.96, 12V, R3, SG90) hoặc thuộc danh sách mã kỹ thuật ngắn
    const hasDigit = /\d/.test(upper)
    const isShortAcronym = TECH_TOKENS.has(upper) || (token.length >= 2 && token.length <= 5 && token === token.toUpperCase() && /^[A-Z0-9]+$/.test(token))

    if (hasDigit || isShortAcronym) {
      const compact = upper.replace(/\./g, '').replace(/-+/g, '-')
      if (compact && !specTokens.includes(compact)) {
        specTokens.push(compact)
      }
    } else {
      const firstLetter = upper.replace(/[^A-Z]/g, '').charAt(0)
      if (firstLetter) {
        prefixInitials.push(firstLetter)
      }
    }
  })

  // Nếu tên quá ngắn và chưa có nhóm tiền tố nhưng có danh mục -> lấy 2-3 ký tự đầu từ danh mục
  let prefix = prefixInitials.join('').slice(0, 6)
  if (!prefix && categoryName) {
    prefix = stripVietnameseDiacritics(categoryName)
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase())
      .join('')
      .slice(0, 4)
  }

  const parts = []
  if (prefix) parts.push(prefix)
  if (specTokens.length > 0) {
    parts.push(...specTokens.slice(0, 3))
  }

  return parts.join('-').slice(0, 24)
}

// Lưu / đọc mã viết tắt tra cứu nhanh của linh kiện (API-first + localStorage fallback)
export function getComponentShortCode(component) {
  if (!component) return ''
  const id = component.componentId || component.id || component.ComponentId || component.Id
  const apiShort = component.shortCode || component.ShortCode || component.abbreviation || ''
  if (apiShort && String(apiShort).trim()) return String(apiShort).trim()

  if (id) {
    const saved = localStorage.getItem(`component_shortcode_${id}`)
    if (saved && saved.trim()) return saved.trim()
  }

  return generateComponentShortCode(component.componentName || component.ComponentName || '', component.categoryName || '')
}

export function saveComponentShortCode(id, shortCode) {
  if (!id) return
  const val = String(shortCode || '').trim().toUpperCase()
  if (val) {
    localStorage.setItem(`component_shortcode_${id}`, val)
  } else {
    localStorage.removeItem(`component_shortcode_${id}`)
  }
}

// Lưu / đọc đơn giá chuẩn (quy định đơn giá từng linh kiện)
export function getComponentReferencePrice(component) {
  if (!component) return 0
  const id = component.componentId || component.id || component.ComponentId || component.Id
  const code = component.componentCode || component.ComponentCode
  const apiPrice =
    component.unitPrice ??
    component.UnitPrice ??
    component.referencePrice ??
    component.ReferencePrice ??
    component.defaultUnitPrice ??
    component.DefaultUnitPrice ??
    component.standardPrice ??
    component.price

  if (apiPrice !== undefined && apiPrice !== null && Number(apiPrice) > 0) {
    return Number(apiPrice)
  }

  if (id) {
    const raw = localStorage.getItem(`component_ref_price_${id}`)
    if (raw !== null && Number(raw) > 0) return Number(raw)
  }
  if (code) {
    const rawByCode = localStorage.getItem(`component_ref_price_code_${code}`)
    if (rawByCode !== null && Number(rawByCode) > 0) return Number(rawByCode)
  }

  return 0
}

export function saveComponentReferencePrice(id, price, componentCode = '') {
  const num = Number(price)
  const valid = Number.isFinite(num) && num > 0
  if (id) {
    if (valid) localStorage.setItem(`component_ref_price_${id}`, String(Math.round(num)))
    else localStorage.removeItem(`component_ref_price_${id}`)
  }
  if (componentCode) {
    if (valid) localStorage.setItem(`component_ref_price_code_${componentCode}`, String(Math.round(num)))
    else localStorage.removeItem(`component_ref_price_code_${componentCode}`)
  }
}

// Nhận diện link YouTube và tạo URL embed
export function extractYoutubeVideoId(url = '') {
  if (!url) return ''
  const str = String(url).trim()
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const regex of patterns) {
    const match = regex.exec(str)
    if (match) return match[1]
  }
  return ''
}

export function isYoutubeUrl(url = '') {
  return Boolean(extractYoutubeVideoId(url)) || /youtube\.com|youtu\.be/i.test(String(url || ''))
}

export function isPdfUrl(url = '') {
  const str = String(url || '').toLowerCase()
  return str.endsWith('.pdf') || str.includes('.pdf?') || str.includes('pdf')
}

export function classifyTutorialType(tutorial) {
  if (!tutorial) return 'link'
  const rawType = String(tutorial.type || tutorial.tutorialType || '').toLowerCase()
  if (rawType === 'youtube' || rawType === 'video') return 'youtube'
  if (rawType === 'pdf') return 'pdf'
  const url = tutorial.url || tutorial.Url || ''
  const title = (tutorial.title || tutorial.Title || '').toLowerCase()
  if (isYoutubeUrl(url) || title.includes('youtube') || title.includes('video')) return 'youtube'
  if (isPdfUrl(url) || title.includes('pdf')) return 'pdf'
  return 'link'
}

// Fallback lưu trữ tutorial cục bộ nếu BE chưa trả hoặc đang tạo mới
export function getLocalTutorials(id) {
  if (!id) return []
  try {
    const raw = localStorage.getItem(`component_tutorials_${id}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalTutorials(id, tutorials) {
  if (!id) return
  try {
    localStorage.setItem(`component_tutorials_${id}`, JSON.stringify(tutorials || []))
  } catch {
    // bỏ qua lỗi quota
  }
}

// Lấy URL ảnh đại diện chính của linh kiện (hỗ trợ cả API backend lẫn localStorage đã lưu khi upload)
export function getComponentImage(component) {
  if (!component) return ''
  const id = component.componentId || component.id || component.ComponentId || component.Id

  // 1. Kiểm tra mảng images từ API
  const apiImages = component.images || component.Images
  if (Array.isArray(apiImages) && apiImages.length > 0) {
    const first = apiImages[0]
    const url = typeof first === 'string' ? first : first.imageUrl || first.url || first.ImageUrl || first.Url
    if (url) return url
  }

  // 2. Kiểm tra thuộc tính imageUrl hoặc image
  const single = component.imageUrl || component.ImageUrl || component.image || component.Image || component.thumbnailUrl
  if (typeof single === 'string' && single.trim()) {
    return single.trim()
  }

  // 3. Kiểm tra localStorage (do NewComponent lưu khi thêm ảnh)
  if (id) {
    try {
      const raw = localStorage.getItem(`component_images_${id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0]
          const url = typeof first === 'string' ? first : first.imageUrl || first.url
          if (url) return url
        }
      }
    } catch {
      // bỏ qua lỗi parse json
    }
  }

  return ''
}

// Lấy danh sách toàn bộ ảnh của linh kiện (dùng cho album ảnh / chi tiết)
export function getComponentImages(component) {
  if (!component) return []
  const id = component.componentId || component.id || component.ComponentId || component.Id
  const result = []
  const seenUrls = new Set()

  const addImg = (item) => {
    if (!item) return
    const url = typeof item === 'string' ? item : item.imageUrl || item.url || item.ImageUrl || item.Url
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)
    result.push({
      imageId: item.imageId || item.id || `img-${Date.now()}-${result.length}`,
      imageUrl: url,
      fileName: item.fileName || item.name || 'Ảnh linh kiện',
    })
  }

  // 1. Thêm từ API images
  const apiImages = component.images || component.Images
  if (Array.isArray(apiImages)) {
    apiImages.forEach(addImg)
  }

  // 2. Thêm từ localStorage
  if (id) {
    try {
      const raw = localStorage.getItem(`component_images_${id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach(addImg)
        }
      }
    } catch {
      // bỏ qua
    }
  }

  // 3. Thêm từ single image property nếu chưa có
  const single = component.imageUrl || component.ImageUrl || component.image || component.Image
  if (typeof single === 'string' && single.trim()) {
    addImg({ imageUrl: single.trim(), fileName: 'Ảnh đại diện' })
  }

  return result
}

// Lấy thông tin tài liệu Datasheet
export function getDatasheetInfo(component) {
  if (!component) return { url: '', name: '' }
  const id = component.componentId || component.id || component.ComponentId || component.Id

  const url =
    component.datasheetUrl ||
    component.DatasheetUrl ||
    component.datasheetLink ||
    component.DatasheetLink ||
    (typeof component.datasheet === 'string' ? component.datasheet : component.datasheet?.url) ||
    (id ? localStorage.getItem(`component_datasheet_url_${id}`) : '') ||
    ''

  let fileName = 'Tài liệu kỹ thuật (Datasheet)'
  if (id) {
    try {
      const raw = localStorage.getItem(`component_datasheet_file_${id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.name) fileName = parsed.name
      }
    } catch {
      // bỏ qua
    }
  }

  return { url, name: fileName }
}

// Tính toán tồn kho thực tế theo từng Phòng Lab
export async function getLabStocksForComponent(component, inventoryService) {
  if (!component) return []
  const id = component.componentId || component.id || component.ComponentId || component.Id

  // 1. Nếu API chi tiết đã có sẵn mảng labStocks hoặc stocks
  const directStocks = component.labStocks || component.stocks || component.laboratories
  if (Array.isArray(directStocks) && directStocks.length > 0) {
    return directStocks.map((s) => ({
      labRoomId: s.labRoomId || s.roomId || s.id,
      roomName: s.roomName || s.labRoomName || s.name || 'Phòng Lab',
      quantity: Number(s.quantity ?? s.availableQuantity ?? s.stock ?? 0),
    }))
  }

  // 2. Thử truy vấn danh sách phân bổ qua componentItems và consumableStocks
  try {
    const [itemsRes, consumablesRes, labRooms, cabinets] = await Promise.all([
      inventoryService.getComponentItems({ componentId: id, size: 500 }).catch(() => null),
      inventoryService.getConsumableStocks({ componentId: id, size: 500 }).catch(() => null),
      inventoryService.getLabRooms().catch(() => []),
      inventoryService.getCabinets().catch(() => []),
    ])

    const getRows = (res) => res?.items || res?.data?.items || (Array.isArray(res) ? res : [])

    // Tạo bản đồ ánh xạ tủ -> phòng lab
    const cabinetToRoom = new Map()
    cabinets.forEach((cab) => {
      const cId = cab.cabinetId || cab.id
      const room = labRooms.find((r) => (r.labRoomId || r.roomId || r.id) === (cab.roomId || cab.labRoomId))
      const roomName = cab.roomName || cab.labRoomName || room?.roomName || room?.name || 'Phòng Lab'
      if (cId) cabinetToRoom.set(cId, roomName)
    })

    const countByRoom = new Map()

    // Đếm thiết bị cá biệt (Component Items)
    const itemsList = getRows(itemsRes)
    itemsList.forEach((item) => {
      const itemCompId = item.componentId || item.ComponentId
      if (!itemCompId || itemCompId === id) {
        if (item.status === 'Available' || !item.status) {
          const roomName = item.roomName || item.labRoomName || cabinetToRoom.get(item.cabinetId) || 'Lab'
          countByRoom.set(roomName, (countByRoom.get(roomName) || 0) + 1)
        }
      }
    })

    // Đếm vật tư tiêu hao (Consumable Stocks)
    const consList = getRows(consumablesRes)
    consList.forEach((item) => {
      const itemCompId = item.componentId || item.ComponentId
      if (!itemCompId || itemCompId === id) {
        const roomName = item.roomName || item.labRoomName || cabinetToRoom.get(item.cabinetId) || 'Lab'
        const qty = Number(item.quantity ?? item.availableQuantity ?? item.stock ?? 0)
        countByRoom.set(roomName, (countByRoom.get(roomName) || 0) + qty)
      }
    })

    if (countByRoom.size > 0) {
      return Array.from(countByRoom.entries()).map(([roomName, quantity]) => ({
        roomName,
        quantity,
      }))
    }
  } catch (err) {
    console.warn('Lỗi lấy tồn theo lab:', err)
  }

  // 3. Fallback: Nếu không phân tách được từng tủ, hiển thị theo số khả dụng hiện có
  const availableQty = Number(component.availableQuantity ?? component.stock ?? 0)
  if (availableQty > 0) {
    return [
      {
        roomName: component.labRoomName || component.roomName || 'Kho trung tâm',
        quantity: availableQty,
      },
    ]
  }

  return []
}
