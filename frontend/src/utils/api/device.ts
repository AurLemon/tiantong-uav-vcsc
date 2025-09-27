import request from '@/utils/api/request'

export interface Device {
  id: number
  uuid: string
  name: string
  websocket_port?: number
  easynvr_url?: string
  http_api_url?: string
  description?: string
  drone_model?: string
  drone_brand?: string
  is_default: boolean
  is_active: boolean
  mqtt_port?: number
  mqtt_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateDeviceParams {
  name: string
  websocket_port?: number
  easynvr_url?: string
  http_api_url?: string
  description?: string
  drone_model?: string
  drone_brand?: string
  mqtt_port?: number
  mqtt_enabled?: boolean
}

export interface UpdateDeviceParams {
  name?: string
  websocket_port?: number
  easynvr_url?: string
  http_api_url?: string
  description?: string
  drone_model?: string
  drone_brand?: string
  is_default?: boolean
  is_active?: boolean
  mqtt_port?: number
  mqtt_enabled?: boolean
}

// 获取设备列表
export async function getDevices(): Promise<Device[]> {
  return request.get('/devices')
}

// 创建设备
export async function createDevice(params: CreateDeviceParams): Promise<Device> {
  return request.post('/devices', params)
}

// 获取单个设备
export async function getDevice(deviceUuid: string): Promise<Device> {
  return request.get(`/devices/${deviceUuid}`)
}

// 更新设备
export async function updateDevice(
  deviceUuid: string,
  params: UpdateDeviceParams
): Promise<Device> {
  return request.put(`/devices/${deviceUuid}`, params)
}

// 删除设备
export async function deleteDevice(deviceUuid: string): Promise<{ message: string }> {
  return request.delete(`/devices/${deviceUuid}`)
}

// 设置默认设备
export async function setDefaultDevice(deviceUuid: string): Promise<Device> {
  return request.post(`/devices/${deviceUuid}/default`)
}
