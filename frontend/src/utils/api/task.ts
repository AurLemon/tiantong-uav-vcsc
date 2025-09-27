import request from '@/utils/api/request'

export interface Task {
  id: number
  uuid: string
  name: string
  description?: string
  task_type: string
  status: string
  device_id: number
  user_id: number
  parameters?: any
  start_time?: string
  end_time?: string
  created_at: string
  updated_at: string
  device_name?: string
}

export interface CreateTaskParams {
  name: string
  description?: string
  task_type: string
  device_id: number
  parameters?: any
}

export interface UpdateTaskParams {
  name?: string
  description?: string
  status?: string
  parameters?: any
  start_time?: string
  end_time?: string
}

// 获取任务列表
export const getTasks = () => {
  return request.get<Task[]>('/tasks')
}

// 创建任务
export const createTask = (params: CreateTaskParams) => {
  return request.post<Task>('/tasks', params)
}

// 获取单个任务
export const getTask = (taskUuid: string) => {
  return request.get<Task>(`/tasks/${taskUuid}`)
}

// 更新任务
export const updateTask = (taskUuid: string, params: UpdateTaskParams) => {
  return request.put<Task>(`/tasks/${taskUuid}`, params)
}

// 删除任务
export const deleteTask = (taskUuid: string) => {
  return request.delete(`/tasks/${taskUuid}`)
}

// 创建一键任务
export const createOneClickTask = (deviceId: number) => {
  return request.post<Task>('/tasks/one-click', { device_id: deviceId })
}

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// 任务类型枚举
export enum TaskType {
  MANUAL = 'manual',
  AUTO = 'auto',
  SCHEDULED = 'scheduled',
}

// 任务状态显示映射
export const TaskStatusMap = {
  [TaskStatus.PENDING]: { text: '等待中', color: 'default' },
  [TaskStatus.RUNNING]: { text: '执行中', color: 'processing' },
  [TaskStatus.COMPLETED]: { text: '已完成', color: 'success' },
  [TaskStatus.FAILED]: { text: '失败', color: 'error' },
  [TaskStatus.CANCELLED]: { text: '已取消', color: 'warning' },
}

// 任务类型显示映射
export const TaskTypeMap = {
  [TaskType.MANUAL]: { text: '手动任务', color: 'blue' },
  [TaskType.AUTO]: { text: '自动任务', color: 'green' },
  [TaskType.SCHEDULED]: { text: '定时任务', color: 'orange' },
}
