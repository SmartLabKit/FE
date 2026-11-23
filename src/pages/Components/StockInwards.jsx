import { useEffect, useMemo, useState } from 'react'
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  CancelOutlined as CancelIcon,
  CardGiftcard as GiftIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  InfoOutlined as InfoIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import {
  formatVietnamDate,
  getDefaultWarrantyDateVn,
  getVietnamDateInputValue,
  isValidYmdDate,
  toReceiptReceivedAtIso,
  toSafeInvoiceDateIso,
  toSafeWarrantyDateIso,
} from '../../utils/dateFormatting'
import {
  downloadStockReceiptTemplate,
  parseStockReceiptExcel,
} from '../../utils/excelHelper'
import {
  getComponentLatestPrice,
  getComponentShortCode,
  normalizeSearchText,
} from './componentHelpers'

const MAX_DROPDOWN_OPTIONS = 50

const newLine = () => ({
  key: `${Date.now()}-${Math.random()}`,
  componentId: '',
  quantity: '1',
  unitPrice: '',
  isGift: false,
  cabinetId: '',
  serialsText: '',
  version: '1.0',
  warrantyExpiresAt: getDefaultWarrantyDateVn(1),
  importError: '',
})

const lineArray = (receipt) => receipt?.items || receipt?.lines || receipt?.receiptLines || []
const serialList = (value) => (Array.isArray(value) ? value : [])

// Chặn nhập các ký tự âm, thập phân, ký hiệu khoa học vào ô số nguyên dương
const blockNonIntegerKey = (event) => {
  if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
    event.preventDefault()
  }
}

export default function StockInwards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [components, setComponents] = useState([])
  const [confirmRequest, setConfirmRequest] = useState(null)
  const [categories, setCategories] = useState([])
  const [cabinets, setCabinets] = useState([])
  const [labRooms, setLabRooms] = useState([])
  const [roomId, setRoomId] = useState('')
  const [apiSuppliers, setApiSuppliers] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => getVietnamDateInputValue())
  const [invoiceDate, setInvoiceDate] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [excelNotice, setExcelNotice] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const todayVn = getVietnamDateInputValue()

  const componentMap = useMemo(
    () => new Map(components.map((item) => [item.componentId, item])),
    [components]
  )

  const activeCabinets = useMemo(
    () => cabinets.filter((cabinet) => (cabinet.status ? cabinet.status === 'Active' : cabinet.isActive !== false)),
    [cabinets]
  )

  // Lab nhận hàng: chỉ các lab đang hoạt động và có ít nhất một tủ đang dùng
  const receivingLabs = useMemo(
    () =>
      labRooms
        .filter((room) => (room.status ? room.status === 'Active' : true))
        .filter((room) => activeCabinets.some((cabinet) => cabinet.roomId === room.roomId))
        .sort((a, b) => String(a.roomCode).localeCompare(String(b.roomCode), 'vi')),
    [labRooms, activeCabinets]
  )

  // Tủ của lab nhận hàng: ô "Tủ cất" ở mỗi dòng chỉ chọn trong danh sách này
  const roomCabinets = useMemo(
    () => activeCabinets.filter((cabinet) => cabinet.roomId === roomId),
    [activeCabinets, roomId]
  )

  // Tủ cho một linh kiện trong lab: tủ dành cho đúng loại linh kiện (tiêu hao / dùng lại / giá trị cao),
  // không có thì tủ không gắn loại, lab chỉ có 1 tủ thì lấy tủ đó
  const cabinetFor = (labCabinets, comp) => {
    if (comp) {
      const typed = labCabinets.find((cabinet) => cabinet.trackingType === comp.trackingType)
      if (typed) return typed.cabinetId
      const untyped = labCabinets.filter((cabinet) => !cabinet.trackingType)
      if (untyped.length === 1) return untyped[0].cabinetId
    }
    if (labCabinets.length === 1) return labCabinets[0].cabinetId
    return ''
  }

  // Tủ chọn được cho một dòng: chỉ tủ cùng loại với linh kiện (hoặc tủ không gắn loại)
  const cabinetOptionsFor = (comp) => {
    if (!comp) return roomCabinets
    return roomCabinets.filter((cabinet) => !cabinet.trackingType || cabinet.trackingType === comp.trackingType)
  }

  // Tủ tự điền cho dòng mới: lab chỉ có 1 tủ thì lấy tủ đó, không thì lấy tủ của dòng ngay trên
  const defaultCabinetId = (currentLines) => {
    if (roomCabinets.length === 1) return roomCabinets[0].cabinetId
    const last = [...currentLines].reverse().find((line) => line.cabinetId)
    return last ? last.cabinetId : ''
  }

  const handleRoomChange = (nextRoomId) => {
    setRoomId(nextRoomId)
    const nextCabinets = activeCabinets.filter((cabinet) => cabinet.roomId === nextRoomId)
    setLines((current) =>
      current.map((line) => ({ ...line, cabinetId: cabinetFor(nextCabinets, componentMap.get(line.componentId)) }))
    )
  }

  // Danh mục linh kiện dùng cho bộ lọc thu hẹp danh sách chọn linh kiện
  const categoryOptions = useMemo(() => {
    const map = new Map()
    categories.forEach((c) => {
      const id = c.categoryId || c.id
      const name = c.categoryName || c.name
      if (id && name) map.set(id, name)
    })
    components.forEach((c) => {
      const id = c.categoryId || c.CategoryId
      const name = c.categoryName
      if (id && name && !map.has(id)) map.set(id, name)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [categories, components])

  // Danh sách linh kiện sau khi lọc theo danh mục (không load scroll toàn bộ hàng ngàn linh kiện)
  const filteredComponentsByCategory = useMemo(() => {
    if (!categoryFilter) return components
    return components.filter(
      (c) => (c.categoryId || c.CategoryId) === categoryFilter || c.categoryName === categoryFilter
    )
  }, [components, categoryFilter])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [componentList, cabinetList, categoryList, receiptList, roomList] = await Promise.all([
          inventoryService.getComponents(),
          inventoryService.getCabinets({ size: 100 }),
          inventoryService.getCategories().catch(() => []),
          inventoryService.getStockReceipts().catch(() => []),
          inventoryService.getLabRooms().catch(() => []),
        ])
        if (!active) return
        setComponents(componentList)
        setCabinets(cabinetList)
        setLabRooms(Array.isArray(roomList) ? roomList : [])
        setCategories(Array.isArray(categoryList) ? categoryList : [])
        // Trích xuất danh sách nhà cung cấp đã có từ API phiếu nhập (không dùng mock data)
        const supplierSet = new Set()
        ;(Array.isArray(receiptList) ? receiptList : []).forEach((r) => {
          if (r?.supplierName?.trim()) supplierSet.add(r.supplierName.trim())
        })
        setApiSuppliers(Array.from(supplierSet).sort((a, b) => a.localeCompare(b, 'vi')))

        if (editId) {
          const receipt = await inventoryService.getStockReceipt(editId)
          if (!active) return
          setSupplier(receipt.supplierName || '')
          setInvoiceNumber(receipt.invoiceNumber || '')
          setReceivedAt(getVietnamDateInputValue(receipt.receivedAt) || getVietnamDateInputValue())
          setInvoiceDate(receipt.invoiceDate ? getVietnamDateInputValue(receipt.invoiceDate) : '')
          setNote(receipt.note || '')
          setLines(
            lineArray(receipt).map((line) => {
              const units = line.units || line.Units || []
              const firstUnit = units[0] || {}
              return {
                ...newLine(),
                componentId: line.componentId || '',
                componentName: line.componentName || line.componentCode || '',
                cabinetName: line.cabinetName || line.cabinetCode || '',
                quantity: String(line.quantity ?? ''),
                unitPrice: String(line.unitPrice ?? ''),
                isGift: Number(line.unitPrice ?? 0) === 0,
                cabinetId: line.cabinetId || '',
                serialsText:
                  units.length > 0
                    ? units.map((u) => u.serialNumber || u.SerialNumber || '').filter(Boolean).join('\n')
                    : serialList(line.serialNumbers || line.serials)
                        .map((serial) => (typeof serial === 'string' ? serial : serial.serialNumber))
                        .join('\n'),
                version: firstUnit.hardwareVersion || firstUnit.HardwareVersion || line.version || '1.0',
                warrantyExpiresAt: firstUnit.warrantyExpiresAt
                  ? getVietnamDateInputValue(firstUnit.warrantyExpiresAt)
                  : getDefaultWarrantyDateVn(1),
              }
            })
          )
        }
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu nhập kho.'))
      } finally {
        if (active) setInitialLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [editId])

  const updateLine = (key, patch) =>
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if ('componentId' in patch) return { ...line, ...patch, importError: '' }
        return { ...line, ...patch }
      })
    )

  const selectedComponent = (line) => componentMap.get(line.componentId)

  // Khi chọn linh kiện trên dòng: tự động điền giá nhập gần nhất (nếu có và không phải hàng cho tặng)
  const handleSelectComponent = (line, comp) => {
    if (!comp) {
      updateLine(line.key, { componentId: '' })
      return
    }
    const refPrice = getComponentLatestPrice(comp)
    const patch = { componentId: comp.componentId }
    if (roomId) {
      const autoCabinet = cabinetFor(roomCabinets, comp)
      if (autoCabinet) patch.cabinetId = autoCabinet
    }
    if (!line.isGift && (!line.unitPrice || Number(line.unitPrice) <= 0) && refPrice > 0) {
      patch.unitPrice = String(refPrice)
    }
    updateLine(line.key, patch)
  }

  // Bật/tắt chế độ hàng cho tặng (đơn giá = 0₫)
  const handleToggleGift = (line, checked) => {
    if (checked) {
      updateLine(line.key, { isGift: true, unitPrice: '0' })
    } else {
      const comp = selectedComponent(line)
      const refPrice = comp ? getComponentLatestPrice(comp) : 0
      updateLine(line.key, {
        isGift: false,
        unitPrice: refPrice > 0 ? String(refPrice) : '',
      })
    }
  }

  // Nhập nhanh danh sách dòng hàng từ file Excel template (.xlsx / .xls / .csv)
  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!roomId) {
      setError('Vui lòng chọn lab nhận hàng trước khi đọc file Excel.')
      return
    }

    setError('')
    setExcelNotice(null)

    try {
      const parsedRows = await parseStockReceiptExcel(file)
      if (parsedRows.length === 0) {
        setError('File Excel không có dòng hàng nào. Vui lòng kiểm tra lại theo file mẫu.')
        return
      }

      const unmatchedWarnings = []
      const importedLines = parsedRows.map((row) => {
        // Tìm linh kiện theo Mã hệ thống, Mã viết tắt hoặc Tên linh kiện
        const normCode = normalizeSearchText(row.componentCode)
        const normName = normalizeSearchText(row.componentName)
        const matchedComp = components.find((c) => {
          const cCode = normalizeSearchText(c.componentCode)
          const cShort = normalizeSearchText(getComponentShortCode(c))
          const cName = normalizeSearchText(c.componentName)
          return (
            (normCode && (cCode === normCode || cShort === normCode)) ||
            (normName && cName === normName)
          )
        })

        // Tìm tủ lưu trữ theo Mã tủ hoặc Tên tủ
        const normCab = normalizeSearchText(row.cabinetCode)
        const matchedCab = roomCabinets.find((cab) => {
          const cabCode = normalizeSearchText(cab.cabinetCode)
          const cabName = normalizeSearchText(cab.cabinetName || cab.name)
          return normCab && (cabCode === normCab || cabName === normCab)
        })

        const importError = matchedComp
          ? ''
          : `Dòng #${row.rowNumber} trong file: không tìm thấy "${row.componentCode || row.componentName}", chọn lại linh kiện`
        if (!matchedComp) {
          unmatchedWarnings.push(`Dòng #${row.rowNumber}: không tìm thấy linh kiện "${row.componentCode || row.componentName}"`)
        }
        if (!matchedCab && row.cabinetCode) {
          unmatchedWarnings.push(`Dòng #${row.rowNumber}: tủ "${row.cabinetCode}" không thuộc lab nhận hàng, đã đổi sang tủ mặc định`)
        }

        const refPrice = matchedComp ? getComponentLatestPrice(matchedComp) : 0
        const rawQty = Number(row.quantity)
        const safeQty = Number.isInteger(rawQty) && rawQty > 0 ? String(rawQty) : '1'
        const rawPrice = Number(row.unitPrice)
        const safePrice = row.isGift
          ? '0'
          : row.unitPrice !== '' && !Number.isNaN(rawPrice) && rawPrice >= 0
            ? String(rawPrice)
            : refPrice > 0
              ? String(refPrice)
              : ''

        return {
          ...newLine(),
          componentId: matchedComp?.componentId || '',
          quantity: safeQty,
          unitPrice: safePrice,
          isGift: Boolean(row.isGift),
          cabinetId:
            matchedCab && (!matchedCab.trackingType || matchedCab.trackingType === matchedComp?.trackingType)
              ? matchedCab.cabinetId
              : cabinetFor(roomCabinets, matchedComp) || roomCabinets[0]?.cabinetId || '',
          serialsText: row.serialsText || '',
          version: row.version || '1.0',
          warrantyExpiresAt: row.warrantyExpiresAt || getDefaultWarrantyDateVn(1),
          importError,
        }
      })

      setLines(importedLines)
      setExcelNotice({
        severity: unmatchedWarnings.length > 0 ? 'warning' : 'success',
        message:
          `Đã đọc ${importedLines.length} dòng hàng từ file "${file.name}".` +
          (unmatchedWarnings.length > 0
            ? ` Cần chọn lại thủ công (dòng tô đỏ bên dưới, chưa tính vào tổng): ${unmatchedWarnings.slice(0, 3).join('; ')}${unmatchedWarnings.length > 3 ? ` (+${unmatchedWarnings.length - 3} cảnh báo khác)` : ''}.`
            : ' Vui lòng kiểm tra thông tin phiếu và bấm "Lưu phiếu và nhập kho".'),
      })
    } catch (parseErr) {
      setError(`Không thể đọc file Excel: ${parseErr.message || 'Định dạng không hợp lệ.'}`)
    }
  }

  // Tổng số lượng và tổng tiền dự kiến của phiếu nhập
  const summary = useMemo(() => {
    let totalQty = 0
    let totalAmount = 0
    let giftLines = 0
    lines.forEach((line) => {
      if (!line.componentId) return
      const q = Number(line.quantity)
      const p = Number(line.unitPrice)
      if (Number.isInteger(q) && q > 0) {
        totalQty += q
        if (!Number.isNaN(p) && p >= 0) {
          totalAmount += q * p
        }
      }
      if (line.isGift) giftLines += 1
    })
    return { totalQty, totalAmount, giftLines }
  }, [lines])

  // Hủy phiếu hiện tại và tạo phiếu mới khi có sai sót về mặt hàng
  const handleCancelAndRecreate = () => {
    if (!editId) return
    setConfirmRequest({
      title: 'Hủy phiếu nhập?',
      message: 'Số hàng của phiếu sẽ bị trừ khỏi tồn kho. Sau khi hủy, hệ thống mở form tạo phiếu mới.',
      confirmText: 'Hủy phiếu',
      reasonLabel: 'Lý do hủy phiếu',
      onConfirm: doCancelAndRecreate,
    })
  }

  const doCancelAndRecreate = async (reason) => {
    setLoading(true)
    try {
      await inventoryService.cancelStockReceipt(editId, reason)
      navigate('/class-setup/admin/stock-inwards')
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiếu nhập.'))
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitAttempted(true)
    const currentTodayVn = getVietnamDateInputValue()

    if (!supplier.trim()) return setError('Vui lòng nhập hoặc chọn nhà cung cấp (VD: HShop.vn).')
    if (!receivedAt || !isValidYmdDate(receivedAt)) {
      return setError('Ngày nhập kho không hợp lệ. Vui lòng chọn ngày đúng định dạng.')
    }
    if (receivedAt > currentTodayVn) {
      return setError('Ngày nhập kho không được lớn hơn ngày hiện tại.')
    }
    if (invoiceDate) {
      if (!isValidYmdDate(invoiceDate)) {
        return setError('Ngày hóa đơn không hợp lệ.')
      }
      if (invoiceDate > currentTodayVn) {
        return setError('Ngày hóa đơn không được ở tương lai.')
      }
      if (invoiceDate > receivedAt) {
        return setError('Ngày hóa đơn (trên chứng từ NCC) không được sau ngày nhập kho thực tế.')
      }
    }

    const noteVal = note.trim() || null
    const isoReceivedAt = toReceiptReceivedAtIso(receivedAt)
    const isoInvoiceDate = toSafeInvoiceDateIso(invoiceDate)

    // TRƯỜNG HỢP SỬA PHIẾU: Chỉ được sửa Nhà cung cấp, Số hóa đơn, Ngày nhập kho, Ngày hóa đơn, Ghi chú
    if (editId) {
      setLoading(true)
      try {
        const payload = {
          supplierName: supplier.trim(),
          invoiceNumber: invoiceNumber.trim() || null,
          receivedAt: isoReceivedAt,
          invoiceDate: isoInvoiceDate,
          note: noteVal,
        }

        await inventoryService.updateStockReceipt(editId, payload)
        navigate(`/class-setup/admin/stock-receipts/${editId}`)
      } catch (saveError) {
        setError(extractErrorMessage(saveError, 'Không thể cập nhật phiếu nhập.'))
      } finally {
        setLoading(false)
      }
      return
    }

    // TRƯỜNG HỢP TẠO MỚI PHIẾU NHẬP
    if (!roomId) return setError('Vui lòng chọn lab nhận hàng.')
    if (lines.length === 0) return setError('Cần ít nhất một dòng hàng.')
    for (const [index, line] of lines.entries()) {
      const comp = selectedComponent(line)
      const compName = comp ? `${comp.componentCode} - ${comp.componentName}` : `Dòng #${index + 1}`
      if (!line.componentId) return setError(`Vui lòng chọn linh kiện ở dòng #${index + 1}.`)
      if (!line.cabinetId) return setError(`Vui lòng chọn tủ cất cho ${compName}.`)

      const q = Number(line.quantity)
      if (line.quantity === '' || !Number.isInteger(q) || q <= 0) {
        return setError(`Số lượng của ${compName} phải là số nguyên dương (>= 1), không được âm hoặc bằng 0.`)
      }

      const p = line.isGift ? 0 : Number(line.unitPrice)
      if (!line.isGift) {
        if (line.unitPrice === '' || Number.isNaN(p) || p <= 0) {
          return setError(
            `Đơn giá của ${compName} bắt buộc phải > 0 ₫. Nếu đây là hàng cho tặng/tài trợ, hãy tích chọn "Cho tặng (0₫)".`
          )
        }
      } else if (Number.isNaN(p) || p !== 0) {
        return setError(`Hàng cho tặng ${compName} phải có đơn giá bằng 0 ₫.`)
      }

      if (comp?.trackingType === 'HIGH_VALUE') {
        const serials = line.serialsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (serials.length !== q) {
          return setError(
            `Linh kiện giá trị cao "${comp.componentName}" yêu cầu đúng ${q} số serial (hiện có ${serials.length}).`
          )
        }
        const set = new Set(serials)
        if (set.size !== serials.length) {
          return setError(`Danh sách serial của "${comp.componentName}" bị trùng lặp. Mỗi máy phải có serial riêng.`)
        }
        if (!line.warrantyExpiresAt || !isValidYmdDate(line.warrantyExpiresAt)) {
          return setError(`Vui lòng chọn ngày "Bảo hành đến" hợp lệ cho ${compName}.`)
        }
        if (line.warrantyExpiresAt < receivedAt) {
          return setError(`Ngày hết hạn bảo hành của ${compName} không được trước ngày nhập kho (${formatVietnamDate(receivedAt)}).`)
        }
      }
    }

    const payload = {
      supplierName: supplier.trim(),
      invoiceNumber: invoiceNumber.trim() || null,
      receivedAt: isoReceivedAt,
      invoiceDate: isoInvoiceDate,
      note: noteVal,
      items: lines.map((line) => {
        const comp = selectedComponent(line)
        const isHighValue = comp?.trackingType === 'HIGH_VALUE'
        const finalUnitPrice = line.isGift ? 0 : Number(line.unitPrice)
        const serialNumbers = isHighValue
          ? line.serialsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined
        return {
          componentId: line.componentId,
          cabinetId: line.cabinetId,
          quantity: Number(line.quantity),
          unitPrice: finalUnitPrice,
          isGift: Boolean(line.isGift),
          ...(isHighValue
            ? {
                warrantyExpiresAt: toSafeWarrantyDateIso(line.warrantyExpiresAt),
                serialNumbers,
                version: (line.version || '1.0').trim(),
              }
            : {}),
        }
      }),
    }

    setLoading(true)
    try {
      const receipt = await inventoryService.createStockReceipt(payload)
      const id = receipt?.receiptId || receipt?.id
      if (!id) throw new Error('Phiếu đã gửi nhưng API không trả receiptId.')
      navigate(`/class-setup/admin/stock-receipts/${id}`)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu phiếu nhập.'))
    } finally {
      setLoading(false)
    }
  }

  // Filter nhanh danh sách linh kiện trong Autocomplete (không dấu, giới hạn 50 dòng để không lag với hàng ngàn linh kiện)
  const filterComponentOptions = (options, { inputValue }) => {
    const q = normalizeSearchText(inputValue)
    const matched = !q
      ? options
      : options.filter((item) => {
          const target = normalizeSearchText(
            `${item.componentCode || ''} ${getComponentShortCode(item)} ${item.componentName || ''} ${item.categoryName || ''} ${item.manufacturer || ''}`
          )
          return target.includes(q)
        })
    return matched.slice(0, MAX_DROPDOWN_OPTIONS)
  }

  return (
    <PortalLayout
      headerTitle={editId ? 'Sửa thông tin phiếu nhập' : 'Lập phiếu nhập kho'}
      headerSubtitle={
        editId
          ? 'Chỉ được sửa Nhà cung cấp, Số hóa đơn, Ngày nhập kho, Ngày hóa đơn và Ghi chú. Không được sửa mặt hàng.'
          : 'Nhập hàng từ Excel Template hoặc chọn linh kiện theo danh mục; lưu phiếu là hàng vào kho ngay'
      }
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() =>
              navigate(editId ? `/class-setup/admin/stock-receipts/${editId}` : '/class-setup/admin/stock-receipts')
            }
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {editId ? 'Chi tiết phiếu nhập' : 'Danh sách phiếu nhập'}
          </Button>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {!editId && (
              <Button
                variant="outlined"
                startIcon={<ExcelIcon />}
                onClick={() => navigate('/class-setup/admin/components/import')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: '#16a34a',
                  color: '#15803d',
                  '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' },
                }}
              >
                Khai báo linh kiện mới từ Excel
              </Button>
            )}
            <Button onClick={() => navigate('/class-setup/admin/components')} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Danh sách linh kiện
            </Button>
          </Box>
        </Box>

        <Card
          component="form"
          onSubmit={handleSubmit}
          variant="outlined"
          sx={{ borderColor: '#d8dced', boxShadow: 'none' }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Box>
                <Typography sx={{ mb: 0.5, fontWeight: 800, color: '#182238' }}>Thông tin chứng từ &amp; nhập kho</Typography>
                <Typography sx={{ color: '#697386', fontSize: 12 }}>
                  {editId
                    ? 'Chỉ chỉnh sửa thông tin chứng từ. Hàng hóa đã vào kho không thể sửa trực tiếp.'
                    : 'Phân biệt rõ Ngày hóa đơn (ngày trên chứng từ mua hàng từ nhà cung cấp) và Ngày nhập kho (ngày thực tế hàng vào Lab).'}
                </Typography>
              </Box>
              {!editId && (
                <Chip
                  size="small"
                  icon={<InfoIcon />}
                  label={`Ngày tạo phiếu (hệ thống): ${formatVietnamDate(todayVn)}`}
                  sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 600, fontSize: 12 }}
                />
              )}
            </Box>

            {editId && (
              <Alert severity="warning" sx={{ mb: 2.5 }}>
                <strong>Quy định:</strong> Không sửa được mặt hàng. Nếu sai sót về hàng hóa, vui lòng{' '}
                <strong>Hủy phiếu</strong> và tạo phiếu mới.
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {excelNotice && (
              <Alert severity={excelNotice.severity} sx={{ mb: 2 }} onClose={() => setExcelNotice(null)}>
                {excelNotice.message}
              </Alert>
            )}

            {/* Các trường thông tin phiếu: Nhà cung cấp (gợi ý NCC thực tế), Số hóa đơn, Ngày nhập kho, Ngày hóa đơn, Ghi chú */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {!editId && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="Lab nhận hàng"
                    value={roomId}
                    onChange={(event) => handleRoomChange(event.target.value)}
                    helperText={
                      roomId
                        ? `Hàng của phiếu này cất vào ${roomCabinets.length} tủ của lab này. Nhập cho lab khác thì lập phiếu khác.`
                        : 'Hàng về lab nào thì chọn lab đó, ô Tủ cất bên dưới chỉ hiện tủ của lab này.'
                    }
                  >
                    {receivingLabs.map((room) => (
                      <MenuItem key={room.roomId} value={room.roomId}>
                        {room.roomCode} — {room.roomName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  freeSolo
                  options={apiSuppliers}
                  inputValue={supplier}
                  onInputChange={(_, newValue) => setSupplier(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      required
                      label="Nhà cung cấp"
                      placeholder="Nhập tên nhà cung cấp thực tế..."
                      helperText={
                        apiSuppliers.length > 0
                          ? `Gợi ý từ ${apiSuppliers.length} nhà cung cấp đã có trong hệ thống, hoặc nhập tên mới.`
                          : 'Nhập tên nhà cung cấp thực tế trên chứng từ mua hàng.'
                      }
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Số hóa đơn / Chứng từ"
                  placeholder="VD: HD-HSHOP-20261118"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  helperText="Số hóa đơn VAT hoặc mã đơn hàng từ nhà cung cấp (nếu có)."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  required
                  type="date"
                  label="Ngày nhập kho (thực tế)"
                  value={receivedAt}
                  onChange={(event) => setReceivedAt(event.target.value)}
                  helperText="Ngày thực tế hàng về kho Lab và được cộng vào tồn kho (≤ hôm nay)."
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: todayVn },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày hóa đơn (trên chứng từ NCC)"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  error={Boolean(invoiceDate && receivedAt && invoiceDate > receivedAt)}
                  helperText={
                    invoiceDate && receivedAt && invoiceDate > receivedAt
                      ? 'Lỗi: Ngày hóa đơn không được sau ngày nhập kho!'
                      : 'Ngày phát hành ghi trên hóa đơn thực tế (phải ≤ ngày nhập kho).'
                  }
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: receivedAt || todayVn },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Ghi chú phiếu nhập"
                  placeholder="VD: Nhập bổ sung kit thực hành IoT học kỳ Fall 2026 từ HShop.vn (không bắt buộc)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Grid>
            </Grid>

            {/* DÒNG HÀNG */}
            {editId ? (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    Mặt hàng đã nhập ({lines.length} dòng hàng — Chỉ xem, không thể sửa)
                  </Typography>
                </Box>
                <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9ff' }}>
                        {['Linh kiện', 'Số lượng', 'Đơn giá', 'Tủ lưu trữ', 'Thông tin máy / Serial'].map((head) => (
                          <TableCell key={head} sx={{ fontWeight: 600 }}>{head}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((line) => {
                        const comp = selectedComponent(line)
                        return (
                          <TableRow key={line.key}>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {comp ? `${comp.componentCode} — ${comp.componentName}` : line.componentName || '—'}
                            </TableCell>
                            <TableCell>{line.quantity}</TableCell>
                            <TableCell>
                              {Number(line.unitPrice || 0) === 0 ? (
                                <Chip size="small" label="0 ₫ (Cho tặng)" color="info" variant="outlined" />
                              ) : (
                                `${Number(line.unitPrice || 0).toLocaleString('vi-VN')} ₫`
                              )}
                            </TableCell>
                            <TableCell>
                              {cabinets.find((c) => c.cabinetId === line.cabinetId)?.cabinetName || line.cabinetName || '—'}
                            </TableCell>
                            <TableCell>
                              {line.serialsText ? (
                                <Typography sx={{ fontSize: 12, whiteSpace: 'pre-line' }}>{line.serialsText}</Typography>
                              ) : (
                                line.version ? `Version: ${line.version}` : '—'
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography sx={{ color: '#94a3b8', fontSize: 12.5, mt: 1.5 }}>
                  Không sửa được mặt hàng. Hãy hủy phiếu và tạo phiếu mới nếu thông tin hàng hóa bị sai.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mt: 3 }}>
                {/* Thanh công cụ Template Excel & Bộ lọc phân loại danh mục linh kiện */}
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    bgcolor: '#f8fafc',
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 14.5 }}>
                      Nhập nhanh danh sách hàng từ Template Excel
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                      Tải file mẫu (đã kèm sẵn mã linh kiện &amp; mã tủ trong hệ thống), điền số lượng/đơn giá rồi tải lên thay vì nhập thủ công từng dòng.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      disabled={initialLoading}
                      onClick={() => downloadStockReceiptTemplate(components, roomId ? roomCabinets : activeCabinets)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderColor: '#16a34a',
                        color: '#15803d',
                        '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' },
                      }}
                    >
                      Tải Template Phiếu Nhập (.xlsx)
                    </Button>
                    <Button
                      size="small"
                      component="label"
                      variant="contained"
                      startIcon={<UploadIcon />}
                      disabled={initialLoading}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                    >
                      Đọc từ Excel
                      <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} />
                    </Button>
                  </Stack>
                </Box>

                {/* Header bảng dòng hàng + Filter phân loại danh mục linh kiện */}
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ fontWeight: 800 }}>Dòng hàng ({lines.length})</Typography>
                    <TextField
                      select
                      size="small"
                      label="Lọc linh kiện theo danh mục"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      sx={{ minWidth: 230, bgcolor: '#fff' }}
                      slotProps={{
                        input: {
                          startAdornment: <FilterIcon sx={{ fontSize: 16, color: '#64748b', mr: 0.5 }} />,
                        },
                      }}
                    >
                      <MenuItem value="">
                        Tất cả danh mục ({components.length} linh kiện)
                      </MenuItem>
                      {categoryOptions.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setLines((current) => [...current, { ...newLine(), cabinetId: defaultCabinetId(current) }])}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Thêm dòng
                  </Button>
                </Box>

                <TableContainer sx={{ border: '1px solid #d8dced', borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9ff' }}>
                        {[
                          'Linh kiện (tìm theo tên / mã viết tắt)',
                          'Số lượng',
                          'Đơn giá (VNĐ) & Cho tặng',
                          'Thành tiền',
                          'Tủ cất',
                          'Thông tin máy (Serial / Version / Bảo hành)',
                          '',
                        ].map((head, idx) => (
                          <TableCell key={head || idx} sx={{ fontWeight: 700, color: '#334155' }}>
                            {head}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((line) => {
                        const component = selectedComponent(line)
                        const isHighValue = component?.trackingType === 'HIGH_VALUE'
                        const qtyNum = Number(line.quantity)
                        const qtyInvalid = line.quantity === '' || !Number.isInteger(qtyNum) || qtyNum <= 0
                        const priceNum = line.isGift ? 0 : Number(line.unitPrice)
                        const priceInvalid = !line.isGift && (line.unitPrice === '' || Number.isNaN(priceNum) || priceNum <= 0)
                        const showPriceError = priceInvalid && (submitAttempted || line.unitPrice !== '')
                        const lineTotal = line.componentId && !qtyInvalid && !Number.isNaN(priceNum) && priceNum >= 0 ? qtyNum * priceNum : 0
                        const warrantyInvalid =
                          isHighValue &&
                          (!line.warrantyExpiresAt || !isValidYmdDate(line.warrantyExpiresAt) || line.warrantyExpiresAt < receivedAt)

                        // Đảm bảo linh kiện đang chọn vẫn hiển thị kể cả khi người dùng đổi bộ lọc danh mục
                        const optionsForRow =
                          component && !filteredComponentsByCategory.some((c) => c.componentId === component.componentId)
                            ? [component, ...filteredComponentsByCategory]
                            : filteredComponentsByCategory

                        return (
                          <TableRow key={line.key} sx={{ verticalAlign: 'top' }}>
                            <TableCell sx={{ minWidth: 300 }}>
                              <Autocomplete
                                size="small"
                                options={optionsForRow}
                                value={component || null}
                                onChange={(_, newValue) => handleSelectComponent(line, newValue)}
                                filterOptions={filterComponentOptions}
                                isOptionEqualToValue={(option, value) => option.componentId === value?.componentId}
                                getOptionLabel={(option) => {
                                  if (!option) return ''
                                  const sc = getComponentShortCode(option)
                                  return `${option.componentCode}${sc && sc !== option.componentCode ? ` (${sc})` : ''} — ${option.componentName}`
                                }}
                                noOptionsText="Không tìm thấy linh kiện phù hợp — thử đổi danh mục hoặc từ khóa"
                                renderOption={(props, option) => {
                                  const { key, ...rest } = props
                                  const sc = getComponentShortCode(option)
                                  const refP = getComponentLatestPrice(option)
                                  return (
                                    <Box component="li" key={key} {...rest} sx={{ display: 'block !important', py: 0.75 }}>
                                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                        {option.componentName}
                                      </Typography>
                                      <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                                        {option.componentCode}
                                        {sc && sc !== option.componentCode ? ` · ${sc}` : ''} · {option.categoryName || 'Chưa phân loại'} ·{' '}
                                        {option.trackingType}
                                        {refP > 0 ? ` · Giá chuẩn: ${refP.toLocaleString('vi-VN')} ₫` : ''}
                                      </Typography>
                                    </Box>
                                  )
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    required
                                    label="Tìm & chọn linh kiện"
                                    placeholder="Gõ tên hoặc mã viết tắt..."
                                    error={Boolean(line.importError)}
                                    helperText={
                                      line.importError
                                        ? line.importError
                                        : filteredComponentsByCategory.length > MAX_DROPDOWN_OPTIONS
                                        ? `Đang hiển thị tối đa ${MAX_DROPDOWN_OPTIONS}/${filteredComponentsByCategory.length} linh kiện — gõ từ khóa hoặc lọc danh mục.`
                                        : undefined
                                    }
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 105 }}>
                              <TextField
                                required
                                type="number"
                                size="small"
                                label="SL"
                                value={line.quantity}
                                error={qtyInvalid}
                                helperText={qtyInvalid ? 'Số nguyên ≥ 1' : ''}
                                onKeyDown={blockNonIntegerKey}
                                onChange={(event) => {
                                  const raw = event.target.value
                                  if (raw === '' || /^\d+$/.test(raw)) {
                                    updateLine(line.key, { quantity: raw })
                                  }
                                }}
                                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 185 }}>
                              <TextField
                                required={!line.isGift}
                                disabled={line.isGift}
                                type="number"
                                size="small"
                                fullWidth
                                label={line.isGift ? 'Đơn giá (Cho tặng)' : 'Đơn giá (VNĐ)'}
                                placeholder="VD: 115000"
                                value={line.isGift ? '0' : line.unitPrice}
                                error={showPriceError}
                                helperText={showPriceError ? 'Bắt buộc > 0 (hoặc tích Cho tặng)' : ''}
                                onKeyDown={blockNonIntegerKey}
                                onChange={(event) => {
                                  const raw = event.target.value
                                  if (raw === '' || /^\d+$/.test(raw)) {
                                    updateLine(line.key, { unitPrice: raw })
                                  }
                                }}
                                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                              />
                              <FormControlLabel
                                sx={{ mt: 0.25, ml: -0.5 }}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={Boolean(line.isGift)}
                                    onChange={(e) => handleToggleGift(line, e.target.checked)}
                                  />
                                }
                                label={
                                  <Typography sx={{ fontSize: 11.5, color: line.isGift ? '#0284c7' : '#64748b', fontWeight: line.isGift ? 700 : 500, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <GiftIcon sx={{ fontSize: 13 }} /> Cho tặng / Tài trợ (0₫)
                                  </Typography>
                                }
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 120, pt: 1.5 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 13, color: line.isGift ? '#0284c7' : '#0f172a' }}>
                                {line.isGift ? '0 ₫ (Tặng)' : `${lineTotal.toLocaleString('vi-VN')} ₫`}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 210 }}>
                              <TextField
                                fullWidth
                                required
                                select
                                size="small"
                                label="Tủ cất"
                                value={line.cabinetId}
                                disabled={!roomId}
                                onChange={(event) => updateLine(line.key, { cabinetId: event.target.value })}
                                helperText={
                                  !roomId
                                    ? 'Chọn lab nhận hàng trước'
                                    : line.cabinetId && line.cabinetId === cabinetFor(roomCabinets, selectedComponent(line))
                                      ? 'Tự chọn theo loại linh kiện'
                                      : ''
                                }
                              >
                                {cabinetOptionsFor(selectedComponent(line)).map((cabinet) => (
                                  <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>
                                    {cabinet.cabinetCode} — {cabinet.cabinetName || cabinet.name}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell sx={{ minWidth: 300 }}>
                              {isHighValue ? (
                                <Box sx={{ display: 'grid', gap: 1 }}>
                                  <TextField
                                    required
                                    size="small"
                                    label={
                                      Number(line.quantity) > 1
                                        ? `Serial (${line.quantity} máy, mỗi dòng 1 serial) *`
                                        : 'Số Serial *'
                                    }
                                    placeholder={
                                      Number(line.quantity) > 1
                                        ? 'RIGOL-DS1054Z-001\nRIGOL-DS1054Z-002'
                                        : 'VD: RIGOL-DS1054Z-001'
                                    }
                                    multiline={Number(line.quantity) > 1}
                                    minRows={Number(line.quantity) > 1 ? 2 : 1}
                                    value={line.serialsText}
                                    onChange={(event) => updateLine(line.key, { serialsText: event.target.value })}
                                  />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 1 }}>
                                    <TextField
                                      required
                                      size="small"
                                      label="Version"
                                      value={line.version}
                                      onChange={(event) => updateLine(line.key, { version: event.target.value })}
                                    />
                                    <TextField
                                      required
                                      type="date"
                                      size="small"
                                      label="Bảo hành đến"
                                      value={line.warrantyExpiresAt}
                                      error={warrantyInvalid}
                                      helperText={warrantyInvalid ? 'Phải ≥ ngày nhập' : ''}
                                      onChange={(event) =>
                                        updateLine(line.key, { warrantyExpiresAt: event.target.value })
                                      }
                                      slotProps={{
                                        inputLabel: { shrink: true },
                                        htmlInput: { min: receivedAt || undefined },
                                      }}
                                    />
                                  </Box>
                                </Box>
                              ) : (
                                <Typography color="text.secondary" fontSize={12} sx={{ pt: 1 }}>
                                  {component ? component.trackingType : 'Chọn linh kiện'}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                aria-label="Xóa dòng"
                                color="error"
                                disabled={lines.length <= 1}
                                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                                sx={{ minWidth: 36 }}
                              >
                                <DeleteIcon />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Tóm tắt tổng số lượng & tổng giá trị phiếu nhập */}
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: '#faf9ff',
                    border: '1px solid #d8dced',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                  }}
                >
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <Chip size="small" label={`Số dòng hàng: ${lines.length}`} sx={{ fontWeight: 600 }} />
                    <Chip size="small" label={`Tổng số lượng: ${summary.totalQty.toLocaleString('vi-VN')}`} sx={{ fontWeight: 600 }} />
                    {summary.giftLines > 0 && (
                      <Chip
                        size="small"
                        color="info"
                        variant="outlined"
                        label={`Hàng cho tặng (0₫): ${summary.giftLines} dòng`}
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#0058be' }}>
                    Tổng giá trị phiếu: {summary.totalAmount.toLocaleString('vi-VN')} ₫
                  </Typography>
                </Box>
              </Box>
            )}

            {initialLoading && (
              <Typography sx={{ mt: 1 }} color="text.secondary">
                Đang tải dữ liệu…
              </Typography>
            )}

            {/* Các nút bấm hành động */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                onClick={() =>
                  navigate(editId ? `/class-setup/admin/stock-receipts/${editId}` : '/class-setup/admin/stock-receipts')
                }
                sx={{ textTransform: 'none' }}
              >
                Hủy
              </Button>

              {editId && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  disabled={loading}
                  onClick={handleCancelAndRecreate}
                  sx={{ textTransform: 'none' }}
                >
                  Hủy phiếu và tạo phiếu mới
                </Button>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={loading || initialLoading}
                sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#0058be' }}
              >
                {loading ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Lưu phiếu và nhập kho'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </PortalLayout>
  )
}
