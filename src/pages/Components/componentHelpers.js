/**
 * Helper hỗ trợ trích xuất hình ảnh, tài liệu và dữ liệu phân bổ kho theo Lab cho linh kiện.
 */

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
