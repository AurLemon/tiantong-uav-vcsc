import { UAVData, UAVDevice, UAVEventHandler, UAVEventType } from '../uav/manager'
import { uavAdapter } from './uav-adapter'
import { realtimeManager } from './manager'

/**
 * 增强的UAV管理器 - 使用新的实时数据系统
 */
export class EnhancedUAVManager {
  private devices: Map<string, UAVDevice> = new Map()
  private eventHandlers: UAVEventHandler[] = []
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  /**
   * 初始化管理器
   */
  private async initialize() {
    if (this.isInitialized) return

    // 监听UAV适配器的数据更新
    uavAdapter.addEventListener(this.handleDeviceDataUpdate.bind(this))
    
    this.isInitialized = true
    console.log('Enhanced UAV Manager initialized')
  }

  /**
   * 处理设备数据更新
   */
  private handleDeviceDataUpdate(deviceId: string, data: UAVData) {
    const device = this.devices.get(deviceId)
    if (device) {
      const oldData = { ...device.data }
      device.data = data
      device.isConnected = data.isConnected

      // 检测数据变化并触发相应事件
      this.detectAndTriggerEvents(deviceId, oldData, data)
    }
  }

  /**
   * 检测数据变化并触发事件
   */
  private detectAndTriggerEvents(deviceId: string, oldData: UAVData, newData: UAVData) {
    // 电池变化
    if (oldData.battery !== newData.battery) {
      this.triggerEvent(deviceId, 'battery', newData.battery)
    }

    // 位置变化
    if (JSON.stringify(oldData.location) !== JSON.stringify(newData.location)) {
      this.triggerEvent(deviceId, 'location', newData.location)
    }

    // 姿态变化
    if (oldData.attitude.heading !== newData.attitude.heading) {
      this.triggerEvent(deviceId, 'attitude', newData.attitude)
    }

    // 飞行状态变化
    if (oldData.isFlying !== newData.isFlying) {
      this.triggerEvent(deviceId, 'isfly', newData.isFlying)
    }

    // 连接状态变化
    if (oldData.isConnected !== newData.isConnected) {
      this.triggerEvent(deviceId, 'isconn', newData.isConnected)
    }

    // 虚拟摇杆状态变化
    if (oldData.isVirtualStick !== newData.isVirtualStick) {
      this.triggerEvent(deviceId, 'isvt', newData.isVirtualStick)
    }

    if (oldData.isVirtualStickActive !== newData.isVirtualStickActive) {
      this.triggerEvent(deviceId, 'isvta', newData.isVirtualStickActive)
    }

    // 相机状态变化
    if (oldData.camera !== newData.camera) {
      this.triggerEvent(deviceId, 'camera', newData.camera)
    }
  }

  /**
   * 触发事件
   */
  private triggerEvent(deviceId: string, eventType: UAVEventType, data: any) {
    this.eventHandlers.forEach(handler => {
      try {
        handler(deviceId, eventType, data)
      } catch (error) {
        console.error('Event handler error:', error)
      }
    })
  }

  /**
   * 添加设备
   */
  addDevice(device: Omit<UAVDevice, 'data' | 'isConnected'>): void {
    const uavDevice: UAVDevice = {
      ...device,
      isConnected: false,
      data: {
        battery: '0',
        camera: '',
        location: { latitude: '0', longitude: '0', altitude: '0' },
        attitude: { heading: 0 },
        isFlying: false,
        isConnected: false,
        isVirtualStick: false,
        isVirtualStickActive: false,
        temperature: 0,
        humidity: 0,
        extra: {},
      },
    }

    this.devices.set(device.id, uavDevice)
    console.log(`Added device: ${device.id}`)
  }

  /**
   * 移除设备
   */
  removeDevice(deviceId: string): void {
    if (this.devices.has(deviceId)) {
      this.disconnect(deviceId)
      this.devices.delete(deviceId)
      console.log(`Removed device: ${deviceId}`)
    }
  }

  /**
   * 连接设备
   */
  async connect(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (!device) {
      console.error(`Device ${deviceId} not found`)
      return false
    }

    try {
      // 使用UAV适配器订阅设备数据（连接到后端统一WebSocket）
      const success = await uavAdapter.subscribeToDevice(deviceId)
      if (success) {
        device.isConnected = true
        console.log(`Connected to device ${deviceId} via backend proxy`)
        this.triggerEvent(deviceId, 'isconn', true)
      }
      return success
    } catch (error) {
      console.error(`Failed to connect to device ${deviceId}:`, error)
      return false
    }
  }

  /**
   * 断开设备连接
   */
  disconnect(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (device) {
      device.isConnected = false
      device.data.isConnected = false
      console.log(`Disconnected from device ${deviceId}`)
      this.triggerEvent(deviceId, 'isconn', false)
    }
  }

  /**
   * 发送命令到设备
   */
  async sendCommand(deviceId: string, command: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (!device || !device.isConnected) {
      console.error(`Device ${deviceId} not connected`)
      return false
    }

    try {
      return await uavAdapter.sendCommand(deviceId, command)
    } catch (error) {
      console.error(`Failed to send command to device ${deviceId}:`, error)
      return false
    }
  }

  /**
   * 获取设备数据
   */
  getDeviceData(deviceId: string): UAVData | null {
    const device = this.devices.get(deviceId)
    return device ? device.data : null
  }

  /**
   * 获取设备
   */
  getDevice(deviceId: string): UAVDevice | null {
    return this.devices.get(deviceId) || null
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): UAVDevice[] {
    return Array.from(this.devices.values())
  }

  /**
   * 获取连接的设备
   */
  getConnectedDevices(): UAVDevice[] {
    return Array.from(this.devices.values()).filter(device => device.isConnected)
  }

  /**
   * 设置默认设备
   */
  setDefaultDevice(deviceId: string): void {
    // 清除所有设备的默认状态
    this.devices.forEach(device => {
      device.isDefault = false
    })

    // 设置新的默认设备
    const device = this.devices.get(deviceId)
    if (device) {
      device.isDefault = true
      console.log(`Set default device: ${deviceId}`)
    }
  }

  /**
   * 获取默认设备
   */
  getDefaultDevice(): UAVDevice | null {
    for (const device of this.devices.values()) {
      if (device.isDefault) {
        return device
      }
    }
    return null
  }

  /**
   * 添加事件监听器
   */
  addEventListener(handler: UAVEventHandler): void {
    this.eventHandlers.push(handler)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(handler: UAVEventHandler): void {
    const index = this.eventHandlers.indexOf(handler)
    if (index > -1) {
      this.eventHandlers.splice(index, 1)
    }
  }

  /**
   * 检查实时数据连接状态
   */
  isRealtimeConnected(): boolean {
    return realtimeManager.isConnected()
  }

  /**
   * 获取设备历史数据
   */
  async getDeviceHistory(deviceId: string, limit = 100, offset = 0): Promise<any[]> {
    const numericDeviceId = parseInt(deviceId, 10)
    if (isNaN(numericDeviceId)) {
      console.error('Invalid device ID:', deviceId)
      return []
    }

    return realtimeManager.getDeviceHistory(numericDeviceId, limit, offset)
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 断开所有设备
    this.devices.forEach((_, deviceId) => {
      this.disconnect(deviceId)
    })

    // 清理数据
    this.devices.clear()
    this.eventHandlers = []

    // 断开实时数据连接
    uavAdapter.disconnect()
    realtimeManager.disconnect()

    this.isInitialized = false
    console.log('Enhanced UAV Manager destroyed')
  }
}

// 创建全局实例
export const enhancedUAVManager = new EnhancedUAVManager()
