import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Chip,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  CheckCircle as CheckIcon,
  Group as GroupIcon,
  ViewModule as ModuleIcon,
  Key as KeyIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { rolePermissionService } from '../../services/rolePermissionService'

// Màu nhận diện cho các vai trò
const ROLE_COLORS = {
  Admin: '#0058be',
  LabStaff: '#7c3aed',
  InventoryManager: '#0d9488',
  Lecturer: '#0284c7',
  Student: '#059669',
}

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [roleDetail, setRoleDetail] = useState(null)

  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [togglingCode, setTogglingCode] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModule, setSelectedModule] = useState('ALL')

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  // Tải danh sách roles và danh mục permissions
  const loadInitialData = () => {
    setLoadingRoles(true)
    Promise.all([
      rolePermissionService.getRoles(),
      rolePermissionService.getPermissions(),
    ])
      .then(([rolesData, permsData]) => {
        setRoles(rolesData || [])
        setPermissions(permsData || [])
        if (rolesData && rolesData.length > 0 && !selectedRoleId) {
          setSelectedRoleId(rolesData[0].roleId)
        }
      })
      .catch((err) => {
        showToast(err.message, 'error')
      })
      .finally(() => {
        setLoadingRoles(false)
      })
  }

  useEffect(() => {
    let ignore = false
    setLoadingRoles(true)
    Promise.all([
      rolePermissionService.getRoles(),
      rolePermissionService.getPermissions(),
    ])
      .then(([rolesData, permsData]) => {
        if (!ignore) {
          setRoles(rolesData || [])
          setPermissions(permsData || [])
          if (rolesData && rolesData.length > 0) {
            setSelectedRoleId((prev) => prev || rolesData[0].roleId)
          }
        }
      })
      .catch((err) => {
        if (!ignore) showToast(err.message, 'error')
      })
      .finally(() => {
        if (!ignore) setLoadingRoles(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Tải chi tiết role khi thay đổi vai trò được chọn
  useEffect(() => {
    if (!selectedRoleId) return

    let isMounted = true
    setLoadingDetail(true)

    rolePermissionService
      .getRoleById(selectedRoleId)
      .then((detail) => {
        if (isMounted) setRoleDetail(detail)
      })
      .catch((err) => {
        if (isMounted) showToast(err.message, 'error')
      })
      .finally(() => {
        if (isMounted) setLoadingDetail(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedRoleId])

  // Xử lý bật / tắt permission cho vai trò
  const handleTogglePermission = async (permCode, currentAssigned) => {
    if (!selectedRoleId) return

    setTogglingCode(permCode)
    try {
      let updatedRole
      if (currentAssigned) {
        // Gỡ bỏ quyền: DELETE /api/roles/{id}/permissions/{code}
        updatedRole = await rolePermissionService.removePermission(selectedRoleId, permCode)
        showToast(`Đã gỡ quyền ${permCode} khỏi vai trò`, 'info')
      } else {
        // Thêm quyền: POST /api/roles/{id}/permissions/{code}
        updatedRole = await rolePermissionService.addPermission(selectedRoleId, permCode)
        showToast(`Đã cấp quyền ${permCode} cho vai trò`, 'success')
      }

      setRoleDetail(updatedRole)

      // Cập nhật lại số lượng permission ở danh sách roles bên trái
      setRoles((prev) =>
        prev.map((r) =>
          r.roleId === selectedRoleId
            ? { ...r, permissionCount: updatedRole.permissions?.length || r.permissionCount }
            : r
        )
      )
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setTogglingCode(null)
    }
  }

  // Danh sách các Module duy nhất
  const modules = useMemo(() => {
    const set = new Set(permissions.map((p) => p.module || 'Khác'))
    return ['ALL', ...Array.from(set)]
  }, [permissions])

  // Lọc quyền theo từ khóa tìm kiếm và module
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchModule = selectedModule === 'ALL' || p.module === selectedModule
      const matchSearch =
        !searchTerm ||
        p.permissionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.permissionName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchModule && matchSearch
    })
  }, [permissions, selectedModule, searchTerm])

  // Gom nhóm quyền theo Module
  const groupedPermissions = useMemo(() => {
    const groups = {}
    filteredPermissions.forEach((p) => {
      const m = p.module || 'Hệ thống'
      if (!groups[m]) groups[m] = []
      groups[m].push(p)
    })
    return groups
  }, [filteredPermissions])

  // Tập hợp mã quyền đã gán cho role hiện tại
  const assignedCodes = useMemo(() => {
    if (!roleDetail || !roleDetail.permissions) return new Set()
    return new Set(roleDetail.permissions.map((p) => p.permissionCode))
  }, [roleDetail])

  const selectedRole = roles.find((r) => r.roleId === selectedRoleId) || roleDetail
  const activeColor = selectedRole ? ROLE_COLORS[selectedRole.roleName] || '#0058be' : '#0058be'

  return (
    <PortalLayout
      headerTitle="Phân quyền & Vai trò hệ thống"
      headerSubtitle="Cấu hình danh mục quyền hạn chi tiết cho từng nhóm vai trò trong SmartLabKit"
    >
      <Container maxWidth="xl" disableGutters sx={{ py: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' }, gap: 3 }}>
          {/* CỘT BÊN TRÁI: DANH SÁCH CÁC VAI TRÒ */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e4e6ef',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldIcon sx={{ color: '#0058be', fontSize: 22 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e' }}>
                    Nhóm vai trò ({roles.length})
                  </Typography>
                </Box>
                <IconButton size="small" onClick={loadInitialData} disabled={loadingRoles}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Box>

              <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
                Chọn một vai trò để xem và điều chỉnh các quyền hạn tương ứng
              </Typography>

              {loadingRoles ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {roles.map((role) => {
                    const isSelected = role.roleId === selectedRoleId
                    const color = ROLE_COLORS[role.roleName] || '#0058be'
                    return (
                      <Paper
                        key={role.roleId}
                        elevation={0}
                        onClick={() => setSelectedRoleId(role.roleId)}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          borderRadius: 2,
                          border: `1.5px solid ${isSelected ? color : '#e4e6ef'}`,
                          bgcolor: isSelected ? `${color}08` : '#ffffff',
                          transition: 'all 0.18s ease',
                          '&:hover': {
                            borderColor: color,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 800,
                              color: isSelected ? color : '#131b2e',
                              fontSize: 14,
                            }}
                          >
                            {role.roleName}
                          </Typography>
                          <Chip
                            label={role.roleName}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: 9,
                              fontWeight: 800,
                              bgcolor: `${color}18`,
                              color: color,
                            }}
                          />
                        </Box>

                        <Typography
                          variant="caption"
                          sx={{
                            color: '#6b7280',
                            fontSize: 11,
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 1.2,
                          }}
                        >
                          {role.description || 'Chưa có mô tả chi tiết'}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <GroupIcon sx={{ fontSize: 14, color: '#81899a' }} />
                            <Typography variant="caption" sx={{ color: '#424754', fontWeight: 600 }}>
                              {role.userCount || 0} người dùng
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <KeyIcon sx={{ fontSize: 14, color: color }} />
                            <Typography variant="caption" sx={{ color: color, fontWeight: 700 }}>
                              {role.permissionCount || (role.permissions ? role.permissions.length : 0)} quyền
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )
                  })}
                </Box>
              )}
            </Paper>
          </Box>

          {/* CỘT BÊN PHẢI: MA TRẬN QUYỀN HẠN CỦA VAI TRÒ ĐƯỢC CHỌN */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: '#ffffff',
                border: '1px solid #e4e6ef',
                borderRadius: 2,
                minHeight: 520,
              }}
            >
              {/* Header của vai trò đang cấu hình */}
              {selectedRole && (
                <Box
                  sx={{
                    pb: 2.5,
                    mb: 2.5,
                    borderBottom: '1px solid #f0f2f5',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 18 }}>
                        Vai trò: {selectedRole.roleName}
                      </Typography>
                      <Chip
                        label={`${assignedCodes.size} quyền kích hoạt`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: 11,
                          bgcolor: `${activeColor}15`,
                          color: activeColor,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: 12, mt: 0.4 }}>
                      {selectedRole.description}
                    </Typography>
                  </Box>

                  {/* Thanh tìm kiếm quyền */}
                  <TextField
                    size="small"
                    placeholder="Tìm mã hoặc tên quyền..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      width: { xs: '100%', sm: 260 },
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 },
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: '#81899a', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>
              )}

              {/* Bộ lọc Module Pills */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 3 }}>
                {modules.map((mod) => {
                  const isModActive = selectedModule === mod
                  return (
                    <Chip
                      key={mod}
                      label={mod === 'ALL' ? 'Tất cả module' : `Module ${mod}`}
                      onClick={() => setSelectedModule(mod)}
                      clickable
                      sx={{
                        fontSize: 11,
                        fontWeight: isModActive ? 700 : 500,
                        bgcolor: isModActive ? activeColor : '#f4f6fa',
                        color: isModActive ? '#ffffff' : '#424754',
                        '&:hover': {
                          bgcolor: isModActive ? activeColor : '#eaedff',
                        },
                      }}
                    />
                  )
                })}
              </Box>

              {/* Danh sách quyền theo từng Module */}
              {loadingDetail ? (
                <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <CircularProgress size={32} sx={{ color: activeColor }} />
                  <Typography variant="body2" sx={{ mt: 1.5, color: '#6b7280' }}>
                    Đang tải danh sách quyền của vai trò...
                  </Typography>
                </Box>
              ) : Object.keys(groupedPermissions).length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ color: '#131b2e', fontWeight: 700 }}>
                    Không tìm thấy quyền nào phù hợp với bộ lọc
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {Object.entries(groupedPermissions).map(([modName, perms]) => (
                    <Box key={modName}>
                      {/* Tiêu đề nhóm Module */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <ModuleIcon sx={{ color: '#6b7280', fontSize: 18 }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: '#424754',
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                            fontSize: 11,
                          }}
                        >
                          Phân hệ {modName} ({perms.length})
                        </Typography>
                        <Divider sx={{ flexGrow: 1, ml: 1 }} />
                      </Box>

                      {/* Lưới các quyền trong module */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                        {perms.map((p) => {
                          const isAssigned = assignedCodes.has(p.permissionCode)
                          const isProcessing = togglingCode === p.permissionCode

                          return (
                            <Paper
                              key={p.permissionId || p.permissionCode}
                              elevation={0}
                              sx={{
                                p: 1.8,
                                borderRadius: 1.8,
                                border: `1px solid ${isAssigned ? `${activeColor}40` : '#e4e6ef'}`,
                                bgcolor: isAssigned ? `${activeColor}05` : '#fafbff',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 1.5,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  borderColor: activeColor,
                                },
                              }}
                            >
                              <Box sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontWeight: 800,
                                      fontSize: 12,
                                      color: isAssigned ? activeColor : '#131b2e',
                                    }}
                                  >
                                    {p.permissionCode}
                                  </Typography>
                                  {isAssigned && (
                                    <CheckIcon sx={{ fontSize: 14, color: activeColor }} />
                                  )}
                                </Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#424754',
                                    fontSize: 11,
                                    lineHeight: 1.4,
                                    display: 'block',
                                  }}
                                >
                                  {p.permissionName}
                                </Typography>
                              </Box>

                              {/* Công tắc Bật/Tắt quyền */}
                              <Box sx={{ display: 'flex', alignItems: 'center', pt: 0.2 }}>
                                {isProcessing ? (
                                  <CircularProgress size={20} sx={{ color: activeColor }} />
                                ) : (
                                  <Tooltip title={isAssigned ? 'Gỡ bỏ quyền này' : 'Cấp quyền này'}>
                                    <Switch
                                      size="small"
                                      checked={isAssigned}
                                      onChange={() => handleTogglePermission(p.permissionCode, isAssigned)}
                                      sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                          color: activeColor,
                                        },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                          backgroundColor: activeColor,
                                        },
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            </Paper>
                          )
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        </Box>

        {/* Thông báo Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={3500}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setToast({ ...toast, open: false })}
            severity={toast.severity}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Container>
    </PortalLayout>
  )
}
