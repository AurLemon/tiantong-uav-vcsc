export interface RealtimeMessage {
  type: 'realtime_data' | 'welcome' | 'pong'
  device_id?: number
  message_type?: 'mqtt' | 'websocket'
  data?: any
  timestamp?: string
  client_id?: string
  message?: string
}

export interface DeviceState {
  device_id: number
  data: any
  last_update: string
  mqtt_data?: any
  websocket_data?: any
}

export type RealtimeEventHandler = (message: RealtimeMessage) => void

export class RealtimeManager {
  private socket: WebSocket | null = null
  private eventHandlers: RealtimeEventHandler[] = []
  private deviceStates: Map<number, DeviceState> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private deviceId: number | null = null // 当前关注的设备ID

  constructor() {
    this.connect()
  }

  /**
   * 连接到后端实时数据WebSocket
   */
  private connect(deviceId?: number): Promise<boolean> {
    if (this.isConnecting) {
      return Promise.resolve(false)
    }

    this.isConnecting = true
    this.deviceId = deviceId || null

    return new Promise((resolve, reject) => {
      try {
        // 连接到后端统一WebSocket接口，接收所有设备的数据
        const wsUrl = `ws://localhost:8086/api/realtime/ws`
        console.log(`Connecting to backend unified WebSocket: ${wsUrl}`)
        this.socket = new WebSocket(wsUrl)

        this.socket.onopen = () => {
          console.log('Connected to realtime data stream')
          this.isConnecting = false
          this.reconnectAttempts = 0
          resolve(true)
        }

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.socket.onclose = () => {
          console.log('Disconnected from realtime data stream')
          this.isConnecting = false
          this.socket = null
          this.attemptReconnect()
        }

        this.socket.onerror = (error) => {
          console.error('Realtime WebSocket error:', error)
          this.isConnecting = false
          reject(error)
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * 尝试重连
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.connect(this.deviceId || undefined)
    }, delay)
  }

  /**
   * 处理WebSocket消息
   */
  private handleMessage(messageData: string) {
    try {
      const message: RealtimeMessage = JSON.parse(messageData)
      console.log('Received realtime message:', message)

      // 更新设备状态
      if (message.type === 'realtime_data' && message.device_id) {
        this.updateDeviceState(message)
      }

      // 触发事件处理器
      this.eventHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Event handler error:', error)
        }
      })
    } catch (error) {
      console.error('Failed to parse realtime message:', error)
    }
  }

  /**
   * 更新设备状态
   */
  private updateDeviceState(message: RealtimeMessage) {
    if (!message.device_id) return

    const deviceId = message.device_id
    const currentState = this.deviceStates.get(deviceId) || {
      device_id: deviceId,
      data: {},
      last_update: new Date().toISOString(),
    }

    // 合并新数据
    if (message.data) {
      if (message.message_type === 'mqtt') {
        currentState.mqtt_data = { ...currentState.mqtt_data, ...message.data }
      } else if (message.message_type === 'websocket') {
        currentState.websocket_data = { ...currentState.websocket_data, ...message.data }
      }
      
      // 合并到总数据中
      currentState.data = {
        ...currentState.data,
        ...message.data
      }
    }

    currentState.last_update = message.timestamp || new Date().toISOString()
    this.deviceStates.set(deviceId, currentState)
  }

  /**
   * 订阅特定设备
   */
  async subscribeToDevice(deviceId: number): Promise<boolean> {
    this.deviceId = deviceId
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // 发送订阅消息
      this.socket.send(JSON.stringify({
        type: 'subscribe_device',
        device_id: deviceId
      }))
      return true
    } else {
      // 重新连接并订阅
      return this.connect(deviceId)
    }
  }

  /**
   * 获取设备状态
   */
  getDeviceState(deviceId: number): DeviceState | null {
    return this.deviceStates.get(deviceId) || null
  }

  /**
   * 获取所有设备状态
   */
  getAllDeviceStates(): Map<number, DeviceState> {
    return new Map(this.deviceStates)
  }

  /**
   * 添加事件监听器
   */
  addEventListener(handler: RealtimeEventHandler): void {
    this.eventHandlers.push(handler)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(handler: RealtimeEventHandler): void {
    const index = this.eventHandlers.indexOf(handler)
    if (index > -1) {
      this.eventHandlers.splice(index, 1)
    }
  }

  /**
   * 发送ping消息
   */
  ping(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }))
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.deviceStates.clear()
    this.eventHandlers = []
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }

  /**
   * 向设备发送命令
   */
  async sendDeviceCommand(deviceId: number, command: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      })

      if (response.ok) {
        const result = await response.json()
        return result.command_sent || false
      }
      return false
    } catch (error) {
      console.error('Failed to send device command:', error)
      return false
    }
  }

  /**
   * 获取设备历史数据
   */
  async getDeviceHistory(deviceId: number, limit = 100, offset = 0): Promise<any[]> {
    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/history?limit=${limit}&offset=${offset}`)
      
      if (response.ok) {
        const result = await response.json()
        return result.data || []
      }
      return []
    } catch (error) {
      console.error('Failed to get device history:', error)
      return []
    }
  }
}

// 创建全局实例
export const realtimeManager = new RealtimeManager()
