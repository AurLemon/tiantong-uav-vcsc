import request from '@/utils/api/request'

export interface DashboardStats {
  total_devices: number
  active_devices: number
  connected_devices: number
  total_tasks: number
  running_tasks: number
  completed_tasks: number
  failed_tasks: number
  recent_tasks: RecentTask[]
  device_status_chart: DeviceStatusItem[]
  task_trend_chart: TaskTrendItem[]
  collection_data_count: number
  prediction_data_count: number
  collection_trend: DataTrendItem[]
  prediction_trend: DataTrendItem[]
}

export interface RecentTask {
  id: number
  uuid: string
  name: string
  status: string
  device_name: string
  created_at: string
}

export interface DeviceStatusItem {
  name: string
  value: number
}

export interface TaskTrendItem {
  date: string
  completed: number
  failed: number
}

export interface DataTrendItem {
  date: string
  value: number
}

// 获取仪表盘统计数据
export async function getDashboardStats(): Promise<DashboardStats> {
  return request.get('/admin/dashboard/stats')
}
