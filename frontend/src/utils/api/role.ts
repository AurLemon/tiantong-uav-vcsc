import request from './request'

export interface Role {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoleWithPermissions extends Role {
  permissions: Array<{
    id: number
    name: string
    description?: string
    resource?: string
    action?: string
  }>
}

export interface CreateRoleParams {
  name: string
  description?: string
  is_active?: boolean
}

export interface UpdateRoleParams {
  name?: string
  description?: string
  is_active?: boolean
}

export interface AssignPermissionsParams {
  permission_ids: number[]
}

// 获取角色列表
export async function getRoles(): Promise<RoleWithPermissions[]> {
  return request.get('/roles')
}

// 创建角色
export async function createRole(params: CreateRoleParams): Promise<Role> {
  return request.post('/roles', params)
}

// 更新角色
export async function updateRole(roleId: number, params: UpdateRoleParams): Promise<Role> {
  return request.put(`/roles/${roleId}`, params)
}

// 删除角色
export async function deleteRole(roleId: number): Promise<void> {
  return request.delete(`/roles/${roleId}`)
}

// 为角色分配权限
export async function assignRolePermissions(roleId: number, params: AssignPermissionsParams): Promise<void> {
  return request.post(`/roles/${roleId}/permissions`, params)
}
