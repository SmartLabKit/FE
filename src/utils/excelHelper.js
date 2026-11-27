import * as XLSX from 'xlsx'
import {
  generateComponentShortCode,
  getDisplayCode,
  getComponentLatestPrice,
  normalizeSearchText,
} from '../pages/Components/componentHelpers'
import { parseFlexibleDateToYmd } from './dateFormatting'
import { trackingTypeLabel } from './trackingTypeLabel'

/**
 * Chuẩn hóa tên cột để đọc linh hoạt cả tiêu đề tiếng Việt có dấu, không dấu và tiếng Anh.
 */
function pickCell(row, aliases = []) {
  const keys = Object.keys(row || {})
  for (const alias of aliases) {
    const normAlias = normalizeSearchText(alias)
    const matchedKey = keys.find((k) => normalizeSearchText(k) === normAlias)
    if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey]
    }
  }
  for (const alias of aliases) {
    const normAlias = normalizeSearchText(alias)
    const matchedKey = keys.find((k) => normalizeSearchText(k).includes(normAlias))
    if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey]
    }
  }
  return ''
}

function parseBoolFlag(value) {
  if (typeof value === 'boolean') return value
  const text = normalizeSearchText(String(value || ''))
  return ['co', 'yes', 'true', '1', 'x', 'tang', 'cho tang', 'mien phi', 'gift'].includes(text)
}

/**
 * Đọc số từ ô Excel, chấp nhận cách viết Việt Nam: "1.500.000", "1.500.000 đ", "1,500,000", "2,5", "10 cái".
 * Không đọc được thì trả fallback (không tự đoán).
 */
function parseNumberStrict(value, fallback = '') {
  if (value === '' || value === null || value === undefined) return fallback
  if (typeof value === 'number') return value
  let text = String(value).trim().replace(/\s+/g, '').replace(/[^\d.,-]+$/u, '')
  if (!text) return fallback
  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  else if (/^-?\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, '')
  else if (/^-?\d+,\d+$/.test(text)) text = text.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(text)) return fallback
  const num = Number(text)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Loại quản lý ghi trong Excel (mã hoặc tiếng Việt). Không nhận ra thì trả '' để dòng báo lỗi, không tự đoán.
 */
export function parseTrackingType(value) {
  const text = normalizeSearchText(value)
  if (text.includes('high') || text.includes('gia thanh cao') || text.includes('gia tri cao')) return 'HIGH_VALUE'
  if (text.includes('reus') || text.includes('tai su dung')) return 'REUSABLE'
  if (text.includes('consum') || text.includes('tieu hao')) return 'CONSUMABLE'
  return ''
}

/**
 * Trạng thái kiểm kê của thiết bị ghi trong Excel: 'present' | 'pending' | 'lost', không nhận ra thì trả ''.
 * Phải xét "Có mặt" trước chữ "mất" đứng riêng: bỏ dấu thì "mặt" và "mất" đều thành "mat".
 */
export function parseAuditState(value) {
  const text = normalizeSearchText(value)
  if (/that lac|khong thay|khong co|bi mat|lost|missing/.test(text)) return 'lost'
  if (/xac minh|kiem tra|pending|chua/.test(text) || text === 'cho') return 'pending'
  if (/co mat|present/.test(text) || ['co', 'du', 'ok', 'x'].includes(text)) return 'present'
  if (text === 'mat') return 'lost'
  return ''
}

// ============================================================================
// 1. TEMPLATE & PARSER: NHẬP HÀNG LOẠT LINH KIỆN KHO (100% DỮ LIỆU THAM CHIẾU TỪ API)
// ============================================================================

/**
 * Tải file Excel mẫu (.xlsx) khai báo linh kiện kho:
 * - Sheet DanhSachLinhKien: bảng trống chuẩn cột để người dùng điền dữ liệu thật (không chèn mock data).
 * - Sheet DanhMucHeThong & LinhKienHienCo: trích xuất 100% từ API backend hiện tại để đối chiếu.
 */
export function downloadComponentsTemplate(categories = [], existingComponents = []) {
  const headers = [
    'Tên linh kiện (*)',
    'Mã viết tắt (tự sinh nếu trống)',
    'Danh mục (*)',
    'Đơn vị (*)',
    'Loại quản lý (*)',
    'Tồn tối thiểu (*)',
    'Thuộc lab (*)',
    'Hãng sản xuất',
    'Mô tả',
    'Thông số kỹ thuật',
    'Link Datasheet (NSX)',
    'Link YouTube hướng dẫn',
    'Link PDF hướng dẫn',
  ]

  const guideRows = [
    {
      'Cột dữ liệu': 'Tên linh kiện (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định': 'Tên đầy đủ của linh kiện thực tế cần khai báo vào kho.',
    },
    {
      'Cột dữ liệu': 'Mã viết tắt (tự sinh nếu trống)',
      'Bắt buộc': 'Không',
      'Ghi chú / Quy định': 'Mã viết tắt để tìm kiếm nhanh. Nếu để trống hệ thống sẽ tự sinh từ tên linh kiện.',
    },
    {
      'Cột dữ liệu': 'Danh mục (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định':
        categories.length > 0
          ? `Chọn đúng tên từ sheet DanhMucHeThong: ${categories.map((c) => c.categoryName).join(', ')}`
          : 'Nhập tên danh mục đang có trong hệ thống.',
    },
    {
      'Cột dữ liệu': 'Đơn vị (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định': 'Đơn vị tính của linh kiện (cái, chiếc, bộ, gói, cuộn, hộp...).',
    },
    {
      'Cột dữ liệu': 'Loại quản lý (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định': 'Một trong 3 giá trị: Tiêu hao, Tái sử dụng, Giá trị cao (có Serial).',
    },
    {
      'Cột dữ liệu': 'Tồn tối thiểu (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định':
        'Số nguyên >= 0. Tồn kho dưới mức này sẽ báo "Sắp hết", nhập 0 nếu không cần giữ sẵn. Đơn giá không khai báo ở đây: giá lấy theo phiếu nhập kho.',
    },
    {
      'Cột dữ liệu': 'Thuộc lab (*)',
      'Bắt buộc': 'Có',
      'Ghi chú / Quy định':
        'Mã lab nhận linh kiện này, nhiều lab thì cách nhau dấu phẩy. VD: LAB-01 hoặc LAB-01, LAB-03. Linh kiện chưa thuộc lab nào thì chưa nhập kho được.',
    },
    {
      'Cột dữ liệu': 'Thông số kỹ thuật',
      'Bắt buộc': 'Không',
      'Ghi chú / Quy định':
        'Ghi dạng "Tên: giá trị", các thông số cách nhau bằng dấu chấm phẩy. VD: Điện áp: 3.3V; Giao tiếp: I2C',
    },
    {
      'Cột dữ liệu': 'Link Datasheet (NSX)',
      'Bắt buộc': 'Không',
      'Ghi chú / Quy định': 'Tài liệu kỹ thuật từ nhà sản xuất (pinout, điện áp, kích thước).',
    },
    {
      'Cột dữ liệu': 'Link YouTube hướng dẫn',
      'Bắt buộc': 'Không',
      'Ghi chú / Quy định': 'Video YouTube hướng dẫn sử dụng / đấu nối.',
    },
    {
      'Cột dữ liệu': 'Link PDF hướng dẫn',
      'Bắt buộc': 'Không',
      'Ghi chú / Quy định': 'Đường dẫn tài liệu PDF bài thực hành / hướng dẫn sử dụng.',
    },
  ]

  const wb = XLSX.utils.book_new()
  const wsData = XLSX.utils.aoa_to_sheet([headers])
  wsData['!cols'] = [
    { wch: 36 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
    { wch: 20 }, { wch: 22 }, { wch: 36 }, { wch: 36 }, { wch: 32 }, { wch: 30 }, { wch: 30 },
  ]
  const wsGuide = XLSX.utils.json_to_sheet(guideRows)
  wsGuide['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 80 }]

  XLSX.utils.book_append_sheet(wb, wsData, 'DanhSachLinhKien')
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan')

  if (categories.length > 0) {
    const wsCat = XLSX.utils.json_to_sheet(
      categories.map((c, idx) => ({
        STT: idx + 1,
        'Tên danh mục': c.categoryName,
        'Số linh kiện hiện có': c.componentCount ?? 0,
      }))
    )
    wsCat['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsCat, 'DanhMucHeThong')
  }

  if (existingComponents.length > 0) {
    const wsExisting = XLSX.utils.json_to_sheet(
      existingComponents.map((c) => ({
        'Mã linh kiện': getDisplayCode(c),
        'Tên linh kiện': c.componentName || '',
        'Danh mục': c.categoryName || '',
        'Đơn vị': c.unit || '',
        'Loại quản lý': trackingTypeLabel(c.trackingType),
        'Thuộc lab': (c.roomCodes || []).join(', '),
        'Giá nhập gần nhất (VNĐ)': c.latestUnitPrice ?? '',
      }))
    )
    wsExisting['!cols'] = [{ wch: 20 }, { wch: 38 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsExisting, 'LinhKienHienCo')
  }

  XLSX.writeFile(wb, 'SmartLabKit_Template_LinhKien.xlsx')
}

/**
 * Đọc file Excel (.xlsx, .xls, .csv) danh sách linh kiện cần tạo hàng loạt.
 */
export async function parseComponentsExcel(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find((n) => normalizeSearchText(n).includes('linhkien')) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  return rawRows
    .map((row, idx) => {
      const componentName = String(
        pickCell(row, ['Tên linh kiện', 'componentName', 'ten linh kien', 'name'])
      ).trim()
      const categoryName = String(
        pickCell(row, ['Danh mục', 'categoryName', 'category', 'danh muc'])
      ).trim()
      const rawShortCode = String(
        pickCell(row, ['Mã viết tắt', 'shortCode', 'componentCode', 'ma viet tat', 'ma linh kien', 'code'])
      )
        .trim()
        .toUpperCase()
      const unit = String(pickCell(row, ['Đơn vị', 'unit', 'don vi'])).trim() || 'cái'
      const rawTracking = String(
        pickCell(row, ['Loại quản lý', 'trackingType', 'loai quan ly', 'type'])
      )
      const trackingType = parseTrackingType(rawTracking)

      const minStockRaw = pickCell(row, ['Tồn tối thiểu', 'minStock', 'ton toi thieu'])
      const minStock = parseNumberStrict(minStockRaw, '')
      const labCodes = String(pickCell(row, ['Thuộc lab', 'roomCodes', 'thuoc lab', 'lab']))
        .split(/[,;]/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean)
      const manufacturer = String(pickCell(row, ['Hãng sản xuất', 'manufacturer', 'hang san xuat'])).trim()
      const description = String(pickCell(row, ['Mô tả', 'description', 'mo ta'])).trim()
      const specifications = String(pickCell(row, ['Thông số kỹ thuật', 'specifications', 'thong so'])).trim()
      const datasheetUrl = String(pickCell(row, ['Link Datasheet', 'datasheetUrl', 'datasheet'])).trim()
      const youtubeUrl = String(pickCell(row, ['Link YouTube', 'youtubeUrl', 'youtube', 'video'])).trim()
      const pdfGuideUrl = String(pickCell(row, ['Link PDF hướng dẫn', 'pdfGuideUrl', 'pdf huong dan', 'tutorial pdf'])).trim()

      return {
        rowNumber: idx + 2,
        componentName,
        shortCode: rawShortCode || generateComponentShortCode(componentName, categoryName),
        categoryName,
        unit,
        trackingType,
        rawTracking: rawTracking.trim(),
        minStock: minStock === '' ? '' : String(minStock),
        labCodes,
        manufacturer,
        description,
        specifications,
        datasheetUrl,
        youtubeUrl,
        pdfGuideUrl,
      }
    })
    .filter((r) => r.componentName || r.categoryName || r.shortCode)
}

// ============================================================================
// 2. TEMPLATE & PARSER: LẬP PHIẾU NHẬP KHO TỪ EXCEL (100% TỪ API)
// ============================================================================

/**
 * Tải file Excel mẫu (.xlsx) lập phiếu nhập kho:
 * - Sheet PhieuNhapKho: bảng trống chuẩn cột để nhập dòng hàng thực tế (không chèn giá/linh kiện giả).
 * - Sheet DanhSachLinhKien & DanhSachTu: lấy trực tiếp từ API để người dùng copy đúng mã.
 */
export function downloadStockReceiptTemplate(components = [], cabinets = []) {
  const activeCabinets = cabinets.filter((c) => c.isActive !== false)
  const headers = [
    'Mã linh kiện (*)',
    'Tên linh kiện (tham khảo)',
    'Số lượng (*)',
    'Đơn giá (VNĐ) (*)',
    'Hàng cho tặng (Có/Không)',
    'Mã tủ lưu trữ (không bắt buộc)',
    'Serial (Giá trị cao, ngăn cách dấu phẩy)',
    'Version (Giá trị cao)',
    'Bảo hành đến (YYYY-MM-DD)',
  ]

  const guideRows = [
    { 'Cột dữ liệu': 'Mã linh kiện (*)', 'Bắt buộc': 'Có', 'Ghi chú': 'Lấy đúng Mã linh kiện từ sheet DanhSachLinhKien (dữ liệu trực tiếp từ API hệ thống).' },
    { 'Cột dữ liệu': 'Số lượng (*)', 'Bắt buộc': 'Có', 'Ghi chú': 'Số nguyên dương >= 1.' },
    { 'Cột dữ liệu': 'Đơn giá (VNĐ) (*)', 'Bắt buộc': 'Có', 'Ghi chú': 'Linh kiện mua thường bắt buộc > 0. Nếu là hàng cho tặng/tài trợ, nhập 0 và điền "Có" ở cột Hàng cho tặng.' },
    { 'Cột dữ liệu': 'Hàng cho tặng (Có/Không)', 'Bắt buộc': 'Không', 'Ghi chú': 'Điền "Có" nếu là hàng tài trợ/cho tặng (đơn giá = 0₫), mặc định là "Không".' },
    { 'Cột dữ liệu': 'Mã tủ lưu trữ (không bắt buộc)', 'Bắt buộc': 'Không', 'Ghi chú': 'Để trống: hệ thống tự chọn tủ của lab nhận hàng theo loại linh kiện. Nếu điền, lấy đúng Mã tủ từ sheet DanhSachTu.' },
    { 'Cột dữ liệu': 'Serial (Giá trị cao, ngăn cách dấu phẩy)', 'Bắt buộc': 'Nếu Giá trị cao', 'Ghi chú': 'Nhập đủ số lượng serial tương ứng số lượng máy, ngăn cách bằng dấu phẩy.' },
    { 'Cột dữ liệu': 'Version (Giá trị cao)', 'Bắt buộc': 'Nếu Giá trị cao', 'Ghi chú': 'Phiên bản phần cứng của thiết bị (VD: 1.0).' },
    { 'Cột dữ liệu': 'Bảo hành đến (YYYY-MM-DD)', 'Bắt buộc': 'Nếu Giá trị cao', 'Ghi chú': 'Định dạng YYYY-MM-DD hoặc DD/MM/YYYY, phải >= ngày nhập kho.' },
  ]

  const wb = XLSX.utils.book_new()
  const wsMain = XLSX.utils.aoa_to_sheet([headers])
  wsMain['!cols'] = [
    { wch: 22 }, { wch: 36 }, { wch: 14 }, { wch: 18 },
    { wch: 24 }, { wch: 18 }, { wch: 36 }, { wch: 20 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, wsMain, 'PhieuNhapKho')

  const wsGuide = XLSX.utils.json_to_sheet(guideRows)
  wsGuide['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 76 }]
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan')

  if (components.length > 0) {
    const refComps = components.map((c) => ({
      'Mã linh kiện': getDisplayCode(c),
      'Tên linh kiện': c.componentName || '',
      'Danh mục': c.categoryName || '',
      'Loại quản lý': trackingTypeLabel(c.trackingType),
      'Giá nhập gần nhất (VNĐ)': getComponentLatestPrice(c) || '',
    }))
    const wsRefComp = XLSX.utils.json_to_sheet(refComps)
    wsRefComp['!cols'] = [{ wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 16 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsRefComp, 'DanhSachLinhKien')
  }

  if (activeCabinets.length > 0) {
    const refCabs = activeCabinets.map((cab) => ({
      'Mã tủ': cab.cabinetCode || '',
      'Tên tủ': cab.cabinetName || cab.name || '',
      'Phòng Lab': cab.labRoomName || cab.roomName || cab.roomCode || '',
    }))
    const wsRefCab = XLSX.utils.json_to_sheet(refCabs)
    wsRefCab['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, wsRefCab, 'DanhSachTu')
  }

  XLSX.writeFile(wb, 'SmartLabKit_Template_PhieuNhapKho.xlsx')
}

/**
 * Đọc file Excel (.xlsx, .xls, .csv) danh sách dòng hàng phiếu nhập kho.
 */
export async function parseStockReceiptExcel(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find((n) => normalizeSearchText(n).includes('phieunhap')) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  return rawRows
    .map((row, idx) => {
      const componentCode = String(
        pickCell(row, ['Mã linh kiện', 'componentCode', 'ma linh kien', 'code'])
      ).trim()
      const componentName = String(
        pickCell(row, ['Tên linh kiện', 'componentName', 'ten linh kien', 'name'])
      ).trim()
      const quantity = parseNumberStrict(pickCell(row, ['Số lượng', 'quantity', 'so luong', 'sl']), '')
      const unitPrice = parseNumberStrict(pickCell(row, ['Đơn giá', 'unitPrice', 'don gia', 'price']), '')
      const isGift = parseBoolFlag(pickCell(row, ['Hàng cho tặng', 'Cho tặng', 'isGift', 'gift', 'cho tang']))
      const cabinetCode = String(
        pickCell(row, ['Mã tủ lưu trữ', 'Mã tủ', 'Tủ lưu trữ', 'cabinetCode', 'cabinet', 'ma tu'])
      ).trim()
      const serialRaw = String(pickCell(row, ['Serial', 'serialNumbers', 'so serial'])).trim()
      const serialsText = serialRaw
        ? serialRaw
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .join('\n')
        : ''
      const version = String(pickCell(row, ['Version', 'Phiên bản', 'hardwareVersion'])).trim()
      const rawWarranty = pickCell(row, ['Bảo hành đến', 'warrantyExpiresAt', 'bao hanh'])
      const warrantyExpiresAt = parseFlexibleDateToYmd(rawWarranty) || ''

      return {
        rowNumber: idx + 2,
        componentCode,
        componentName,
        quantity: quantity === '' ? '' : String(quantity),
        unitPrice: isGift ? '0' : unitPrice === '' ? '' : String(unitPrice),
        isGift,
        cabinetCode,
        serialsText,
        version,
        warrantyExpiresAt,
      }
    })
    .filter((r) => r.componentCode || r.componentName || r.quantity !== '')
}

// ============================================================================
// 3. TEMPLATE & PARSER: KIỂM KÊ KHO BẰNG EXCEL (100% TỪ API)
// ============================================================================

/**
 * Xuất file mẫu kiểm kê tủ (.xlsx) dựa trên dữ liệu thực tế từ API phiên kiểm kê & tồn tủ.
 */
export function downloadInventoryAuditTemplate(audit, liveStockMap = new Map()) {
  const consumables = (audit?.consumables || []).map((line) => {
    const liveQty = liveStockMap.has(line.componentId) ? liveStockMap.get(line.componentId) : line.systemQuantity
    return {
      'Mã linh kiện': line.componentCode || '',
      'Tên linh kiện': line.componentName || '',
      'Tồn hệ thống (lúc mở phiên)': line.systemQuantity,
      'Tồn tủ hiện tại (Realtime)': liveQty,
      'Đếm thực tế (*)': liveQty,
    }
  })

  const items = (audit?.items || []).map((item) => ({
    'Mã thiết bị': item.itemCode || '',
    'Tên linh kiện': item.componentName || '',
    Serial: item.serialNumber || '',
    'Trạng thái kiểm kê (Có mặt / Chờ xác minh / Thất lạc)': 'Có mặt',
  }))

  const wb = XLSX.utils.book_new()
  const wsCons =
    consumables.length > 0
      ? XLSX.utils.json_to_sheet(consumables)
      : XLSX.utils.aoa_to_sheet([['Mã linh kiện', 'Tên linh kiện', 'Tồn hệ thống (lúc mở phiên)', 'Tồn tủ hiện tại (Realtime)', 'Đếm thực tế (*)']])
  wsCons['!cols'] = [{ wch: 20 }, { wch: 38 }, { wch: 24 }, { wch: 24 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsCons, 'VatTuTieuHao')

  const wsItems =
    items.length > 0
      ? XLSX.utils.json_to_sheet(items)
      : XLSX.utils.aoa_to_sheet([['Mã thiết bị', 'Tên linh kiện', 'Serial', 'Trạng thái kiểm kê (Có mặt / Chờ xác minh / Thất lạc)']])
  wsItems['!cols'] = [{ wch: 22 }, { wch: 36 }, { wch: 22 }, { wch: 44 }]
  XLSX.utils.book_append_sheet(wb, wsItems, 'ThietBiCaBiet')

  const safeCode = String(audit?.cabinetCode || 'Cabinet').replace(/[^a-zA-Z0-9_-]/g, '_')
  XLSX.writeFile(wb, `SmartLabKit_KiemKe_${safeCode}.xlsx`)
}

/**
 * Đọc kết quả kiểm kê từ file Excel (.xlsx/.csv) đã điền.
 */
export async function parseInventoryAuditExcel(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const consSheetName =
    wb.SheetNames.find((n) => normalizeSearchText(n).includes('vattu')) || wb.SheetNames[0]
  const itemSheetName = wb.SheetNames.find((n) => normalizeSearchText(n).includes('thietbi'))

  const consRows = consSheetName ? XLSX.utils.sheet_to_json(wb.Sheets[consSheetName], { defval: '' }) : []
  const itemRows = itemSheetName ? XLSX.utils.sheet_to_json(wb.Sheets[itemSheetName], { defval: '' }) : []

  const consumables = consRows
    .map((row) => ({
      componentCode: String(pickCell(row, ['Mã linh kiện', 'componentCode', 'ma linh kien'])).trim(),
      componentName: String(pickCell(row, ['Tên linh kiện', 'componentName', 'ten linh kien'])).trim(),
      countedQuantity: parseNumberStrict(pickCell(row, ['Đếm thực tế', 'Thực tế', 'countedQuantity', 'dem thuc te']), ''),
    }))
    .filter((r) => (r.componentCode || r.componentName) && r.countedQuantity !== '')

  const items = itemRows
    .map((row) => {
      const itemCode = String(pickCell(row, ['Mã thiết bị', 'itemCode', 'ma thiet bi'])).trim()
      const auditState = parseAuditState(
        pickCell(row, ['Trạng thái kiểm kê', 'Trạng thái', 'status', 'trang thai'])
      )
      return { itemCode, auditState }
    })
    .filter((r) => r.itemCode)

  return { consumables, items }
}
