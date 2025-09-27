import { request } from './request'

export interface Permission {
  id: number
  name: string
  description?: string
  resource?: string
  action?: string
  created_at: string
  updated_at: string
}

export interface CreatePermissionParams {
  name: string
  description?: string
  resource?: string
  action?: string
}

export interface UpdatePermissionParams {
  name?: string
  description?: string
  resource?: string
  action?: string
}

// 获取权限列表
export async function getPermissions(): Promise<Permission[]> {
  return request('/permissions', {
    method: 'GET',
  })
}

// 创建权限
export async function createPermission(params: CreatePermissionParams): Promise<Permission> {
  return request('/permissions', {
    method: 'POST',
    data: params,
  })
}
