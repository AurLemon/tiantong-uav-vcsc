import request from './request'

export interface User {
  id: number
  pid: string
  email: string
  name: string
  created_at: string
  updated_at: string
}

export interface UserWithRoles extends User {
  roles: Array<{
    id: number
    name: string
    description?: string
  }>
}

export interface CreateUserParams {
  email: string
  password: string
  name: string
  role_ids?: number[]
}

export interface UpdateUserParams {
  email?: string
  name?: string
  password?: string
}

export interface AssignRolesParams {
  role_ids: number[]
}

// 获取用户列表
export async function getUsers(): Promise<UserWithRoles[]> {
  return request.get('/users')
}

// 创建用户
export async function createUser(params: CreateUserParams): Promise<User> {
  return request.post('/users', params)
}

// 更新用户
export async function updateUser(userId: number, params: UpdateUserParams): Promise<User> {
  return request.put(`/users/${userId}`, params)
}

// 删除用户
export async function deleteUser(userId: number): Promise<void> {
  return request.delete(`/users/${userId}`)
}

// 为用户分配角色
export async function assignUserRoles(userId: number, params: AssignRolesParams): Promise<void> {
  return request.post(`/users/${userId}/roles`, params)
}
