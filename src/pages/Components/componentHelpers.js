/**
 * Helper hỗ trợ trích xuất hình ảnh, tài liệu, mã viết tắt tra cứu nhanh, giá nhập gần nhất,
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

/** Mã viết tắt tra cứu nhanh do API trả về (để trống nếu linh kiện chưa có). */
export function getComponentShortCode(component) {
  if (!component) return ''
  return String(component.shortCode || component.ShortCode || '').trim()
}

/** Đơn giá trên phiếu nhập gần nhất (API latestUnitPrice); 0 nếu linh kiện chưa nhập lần nào. */
export function getComponentLatestPrice(component) {
  const price = Number(component?.latestUnitPrice ?? component?.LatestUnitPrice)
  return Number.isFinite(price) && price > 0 ? price : 0
}

/**
 * Đổi ô "Thông số kỹ thuật" dạng chữ thành danh sách { specKey, specValue } theo đúng API.
 * Mỗi thông số cách nhau bằng dấu ; hoặc xuống dòng, tên và giá trị cách nhau bằng dấu :
 * VD: "Điện áp: 3.3V; Giao tiếp: I2C". Thông số không có dấu : sẽ lấy tên "Thông số 1", "Thông số 2"...
 */
export function parseSpecsText(text = '') {
  const parts = String(text || '')
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const specs = []
  parts.forEach((part, index) => {
    const colon = part.indexOf(':')
    let specKey = `Thông số ${index + 1}`
    let specValue = part
    if (colon > 0) {
      specKey = part.slice(0, colon).trim()
      specValue = part.slice(colon + 1).trim()
    }
    if (specKey && specValue) specs.push({ specKey, specValue })
  })
  return specs
}

/** Tên thông số bị lặp (không phân biệt hoa thường); API sẽ từ chối nếu có. */
export function findDuplicateSpecKeys(specs = []) {
  const seen = new Set()
  const duplicates = new Set()
  for (const spec of specs) {
    const key = spec.specKey.trim().toLowerCase()
    if (seen.has(key)) duplicates.add(spec.specKey.trim())
    seen.add(key)
  }
  return [...duplicates]
}

/** Ngược lại với parseSpecsText: danh sách thông số từ API thành chữ "Tên: giá trị; ..." để sửa. */
export function formatSpecsText(specs) {
  if (!Array.isArray(specs)) return ''
  return specs
    .map((spec) => {
      if (typeof spec === 'string') return spec
      const key = spec?.specKey || spec?.SpecKey || ''
      const value = spec?.specValue || spec?.SpecValue || ''
      const unit = spec?.unit || spec?.Unit || ''
      const fullValue = unit ? `${value} ${unit}` : value
      return key ? `${key}: ${fullValue}` : fullValue
    })
    .filter(Boolean)
    .join('; ')
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

// Lấy URL ảnh đại diện chính của linh kiện từ API
export function getComponentImage(component) {
  if (!component) return ''

  // API danh sách trả ảnh đại diện qua primaryImageUrl.
  const primaryImageUrl = component.primaryImageUrl || component.PrimaryImageUrl
  if (typeof primaryImageUrl === 'string' && primaryImageUrl.trim()) {
    return primaryImageUrl.trim()
  }

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

  return ''
}

// Lấy danh sách toàn bộ ảnh của linh kiện (dùng cho album ảnh / chi tiết)
export function getComponentImages(component) {
  if (!component) return []
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

  // 2. Thêm từ single image property nếu chưa có
  const single = component.imageUrl || component.ImageUrl || component.image || component.Image
  if (typeof single === 'string' && single.trim()) {
    addImg({ imageUrl: single.trim(), fileName: 'Ảnh đại diện' })
  }

  return result
}

// Lấy thông tin tài liệu Datasheet từ API (link dán hoặc file đã tải lên)
export function getDatasheetInfo(component) {
  if (!component) return { url: '', name: '' }
  const url = component.datasheetUrl || component.DatasheetUrl || ''

  let fileName = 'Tài liệu kỹ thuật (Datasheet)'
  if (url) {
    try {
      const lastSegment = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      if (lastSegment) fileName = lastSegment
    } catch {
      fileName = 'Tài liệu kỹ thuật (Datasheet)'
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
