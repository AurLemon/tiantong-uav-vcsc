import { realtimeManager, RealtimeMessage } from './manager'
import { UAVData } from '../uav/types'

/**
 * UAV数据适配器 - 将实时数据转换为UAV格式
 */
export class UAVAdapter {
  private deviceData: Map<string, UAVData> = new Map()
  private eventHandlers: Array<(deviceId: string, data: UAVData) => void> = []

  constructor() {
    // 监听实时数据更新
    realtimeManager.addEventListener(this.handleRealtimeMessage.bind(this))
  }

  /**
   * 处理实时消息
   */
  private handleRealtimeMessage(message: RealtimeMessage) {
    if (message.type === 'realtime_data' && message.device_id && message.data) {
      const deviceId = message.device_id.toString()
      const currentData = this.deviceData.get(deviceId) || this.createDefaultUAVData()

      // 根据消息类型更新数据
      if (message.message_type === 'mqtt') {
        this.updateFromMQTT(currentData, message.data)
      } else if (message.message_type === 'websocket') {
        this.updateFromWebSocket(currentData, message.data)
      }

      // 更新连接状态
      currentData.isConnected = true
      currentData.lastUpdate = new Date()

      this.deviceData.set(deviceId, currentData)

      // 触发事件处理器
      this.eventHandlers.forEach(handler => {
        try {
          handler(deviceId, currentData)
        } catch (error) {
          console.error('UAV adapter event handler error:', error)
        }
      })
    }
  }

  /**
   * 创建默认UAV数据
   */
  private createDefaultUAVData(): UAVData {
    return {
      battery: '0',
      camera: '',
      location: {
        latitude: '0',
        longitude: '0',
        altitude: '0',
      },
      attitude: {
        heading: 0,
      },
      isFlying: false,
      isConnected: false,
      isVirtualStick: false,
      isVirtualStickActive: false,
      temperature: 0,
      humidity: 0,
      extra: {},
    }
  }

  /**
   * 从MQTT数据更新UAV数据
   */
  private updateFromMQTT(uavData: UAVData, mqttData: any) {
    // 处理温湿度传感器数据
    if (mqttData.temperature_c !== undefined) {
      uavData.temperature = parseFloat(mqttData.temperature_c)
    }
    if (mqttData.humidity !== undefined) {
      uavData.humidity = parseFloat(mqttData.humidity)
    }

    // 其他MQTT数据存储在extra中
    if (!uavData.extra) {
      uavData.extra = {}
    }
    uavData.extra.mqtt = mqttData
  }

  /**
   * 从WebSocket数据更新UAV数据
   */
  private updateFromWebSocket(uavData: UAVData, wsData: any) {
    // 处理无人机WebSocket数据
    if (wsData.battery !== undefined) {
      uavData.battery = wsData.battery.toString()
    }

    if (wsData.location !== undefined) {
      const locationParts = wsData.location.split(' ')
      if (locationParts.length >= 3) {
        uavData.location.latitude = locationParts[0]
        uavData.location.longitude = locationParts[1]
        uavData.location.altitude = locationParts[2]
      }
    }

    if (wsData.direction !== undefined) {
      uavData.attitude.heading = parseFloat(wsData.direction) || 0
    }

    if (wsData.flight !== undefined) {
      uavData.isFlying = wsData.flight === '是' || wsData.flight === 'true' || wsData.flight === true
    }

    if (wsData.camera !== undefined) {
      uavData.camera = wsData.camera.toString()
    }

    // 处理其他字段
    Object.keys(wsData).forEach(key => {
      const value = wsData[key]

      switch (key) {
        case 'height':
          uavData.location.altitude = value.toString()
          break
        case 'heading':
          uavData.attitude.heading = parseFloat(value) || 0
          break
        case 'isfly':
          uavData.isFlying = value === 1 || value === '1' || value === true
          break
        case 'isconn':
          uavData.isConnected = value === 1 || value === '1' || value === true
          break
        case 'isvt':
          uavData.isVirtualStick = value === 1 || value === '1' || value === true
          break
        case 'isvta':
          uavData.isVirtualStickActive = value === 1 || value === '1' || value === true
          break
        default:
          // 其他未知字段可以存储在扩展属性中
          if (!uavData.extra) {
            uavData.extra = {}
          }
          uavData.extra[key] = value
          break
      }
    })
  }

  /**
   * 订阅设备数据
   */
  async subscribeToDevice(deviceId: string): Promise<boolean> {
    const numericDeviceId = parseInt(deviceId, 10)
    if (isNaN(numericDeviceId)) {
      console.error('Invalid device ID:', deviceId)
      return false
    }

    return realtimeManager.subscribeToDevice(numericDeviceId)
  }

  /**
   * 获取设备数据
   */
  getDeviceData(deviceId: string): UAVData | null {
    return this.deviceData.get(deviceId) || null
  }

  /**
   * 获取所有设备数据
   */
  getAllDeviceData(): Map<string, UAVData> {
    return new Map(this.deviceData)
  }

  /**
   * 添加事件监听器
   */
  addEventListener(handler: (deviceId: string, data: UAVData) => void): void {
    this.eventHandlers.push(handler)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(handler: (deviceId: string, data: UAVData) => void): void {
    const index = this.eventHandlers.indexOf(handler)
    if (index > -1) {
      this.eventHandlers.splice(index, 1)
    }
  }

  /**
   * 向设备发送命令
   */
  async sendCommand(deviceId: string, command: string): Promise<boolean> {
    const numericDeviceId = parseInt(deviceId, 10)
    if (isNaN(numericDeviceId)) {
      console.error('Invalid device ID:', deviceId)
      return false
    }

    return realtimeManager.sendDeviceCommand(numericDeviceId, command)
  }

  /**
   * 检查设备是否连接
   */
  isDeviceConnected(deviceId: string): boolean {
    const data = this.deviceData.get(deviceId)
    return data?.isConnected || false
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.deviceData.clear()
    this.eventHandlers = []
  }
}

// 创建全局实例
export const uavAdapter = new UAVAdapter()
