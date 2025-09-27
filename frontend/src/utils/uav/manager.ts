/**
 * 无人机管理工具类
 * 支持多设备连接和操作
 */

export interface UAVData {
  battery?: string
  camera?: string
  location?: {
    latitude: string
    longitude: string
    altitude: string
  }
  attitude?: {
    heading: string
  }
  isFlying?: boolean
  isConnected?: boolean
  isVirtualStick?: boolean
  isVirtualStickAdvanced?: boolean
  temperature?: number
  humidity?: number
  velocity?: string // 风速数据
  mqtt?: any // MQTT传感器数据
  [key: string]: any // 支持动态属性，兼容index.html的数据格式
}

export interface UAVDevice {
  id: string
  name: string
  websocketPort?: number
  isConnected: boolean
  isDefault: boolean
  data: UAVData
}

export type UAVEventType =
  | 'battery'
  | 'camera'
  | 'location'
  | 'attitude'
  | 'isfly'
  | 'isconn'
  | 'isvt'
  | 'isvta'
  | 'hi'
  | 'heart'
  | 'velocity'

export interface UAVEventHandler {
  (deviceId: string, eventType: UAVEventType, data: any): void
}

export class UAVManager {
  private devices: Map<string, UAVDevice> = new Map()
  private connections: Map<string, WebSocket> = new Map()
  private eventHandlers: UAVEventHandler[] = []
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map()

  /**
   * 添加设备
   */
  addDevice(device: Omit<UAVDevice, 'isConnected' | 'data'>): void {
    const newDevice: UAVDevice = {
      ...device,
      isConnected: false,
      data: {
        battery: '',
        camera: '',
        location: {
          latitude: '',
          longitude: '',
          altitude: '',
        },
        attitude: {
          heading: 0,
        },
        isFlying: false,
        isConnected: false,
        isVirtualStick: false,
        isVirtualStickActive: false,
      },
    }
    this.devices.set(device.id, newDevice)
  }

  /**
   * 移除设备
   */
  removeDevice(deviceId: string): void {
    this.disconnect(deviceId)
    this.devices.delete(deviceId)
  }

  /**
   * 连接设备
   */
  async connect(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Device ${deviceId} not found`)
    }

    if (this.connections.has(deviceId)) {
      this.disconnect(deviceId)
    }

    return new Promise((resolve, reject) => {
      try {
        if (!device.websocketPort) {
          reject(new Error('Device WebSocket port not configured'))
          return
        }

        // 连接到后端WebSocket代理，使用设备专用端口
        const proxyUrl = `ws://127.0.0.1:${device.websocketPort}/${deviceId}`
        const socket = new WebSocket(proxyUrl)

        socket.onopen = () => {
          console.log(`Connected to device ${deviceId} via proxy port ${device.websocketPort}`)
          device.isConnected = true
          device.data.isConnected = true
          this.connections.set(deviceId, socket)
          this.startHeartbeat(deviceId)
          resolve(true)
        }

        socket.onmessage = (event) => {
          this.handleMessage(deviceId, event.data)
        }

        socket.onclose = () => {
          console.log(`Disconnected from device ${deviceId}`)
          device.isConnected = false
          device.data.isConnected = false
          this.connections.delete(deviceId)
          this.stopHeartbeat(deviceId)
        }

        socket.onerror = (error) => {
          console.error(`Connection error for device ${deviceId}:`, error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 断开设备连接
   */
  disconnect(deviceId: string): void {
    const socket = this.connections.get(deviceId)
    if (socket) {
      socket.close()
    }
    this.stopHeartbeat(deviceId)

    const device = this.devices.get(deviceId)
    if (device) {
      device.isConnected = false
      device.data.isConnected = false
    }
  }

  /**
   * 发送命令到设备
   */
  sendCommand(deviceId: string, command: string): boolean {
    const socket = this.connections.get(deviceId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error(`Device ${deviceId} is not connected`)
      return false
    }

    try {
      socket.send(command)
      return true
    } catch (error) {
      console.error(`Failed to send command to device ${deviceId}:`, error)
      return false
    }
  }

  /**
   * 设置设备为默认连接
   */
  setDefaultDevice(deviceId: string): void {
    // 清除其他设备的默认状态
    this.devices.forEach((device) => {
      device.isDefault = false
    })

    // 设置指定设备为默认
    const device = this.devices.get(deviceId)
    if (device) {
      device.isDefault = true
    }
  }

  /**
   * 获取默认设备
   */
  getDefaultDevice(): UAVDevice | undefined {
    for (const device of this.devices.values()) {
      if (device.isDefault) {
        return device
      }
    }
    return undefined
  }

  /**
   * 获取设备信息
   */
  getDevice(deviceId: string): UAVDevice | undefined {
    return this.devices.get(deviceId)
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): UAVDevice[] {
    return Array.from(this.devices.values())
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
   * 处理WebSocket消息
   */
  private handleMessage(deviceId: string, message: string): void {
    console.log(`Received from device ${deviceId}:`, message)

    const device = this.devices.get(deviceId)
    if (!device) return

    const parts = message.split(':')
    if (parts.length < 2) return

    const eventType = parts[0] as UAVEventType
    const data = parts[1]

    // 更新设备数据
    this.updateDeviceData(device, eventType, data)

    // 触发事件处理器
    this.eventHandlers.forEach((handler) => {
      try {
        handler(deviceId, eventType, data)
      } catch (error) {
        console.error('Event handler error:', error)
      }
    })
  }

  /**
   * 更新设备数据
   */
  private updateDeviceData(device: UAVDevice, eventType: UAVEventType, data: string): void {
    switch (eventType) {
      case 'battery':
        device.data.battery = data
        break
      case 'camera':
        device.data.camera = data
        break
      case 'location':
        const locationParts = data.split(' ')
        if (locationParts.length >= 3) {
          device.data.location = {
            latitude: locationParts[0],
            longitude: locationParts[1],
            altitude: locationParts[2],
          }
        }
        break
      case 'attitude':
        const attitudeParts = data.split(' ')
        if (attitudeParts.length >= 3) {
          device.data.attitude.heading = parseFloat(attitudeParts[2]) || 0
        }
        break
      case 'isfly':
        device.data.isFlying = parseInt(data) === 1
        break
      case 'isconn':
        device.data.isConnected = parseInt(data) > 0
        if (parseInt(data) > 0 && !device.data.isVirtualStick) {
          // 自动获取状态
          this.sendCommand(device.id, 'get status')
          this.sendCommand(device.id, 'vstick')
          setTimeout(() => {
            this.sendCommand(device.id, 'vastick')
          }, 2000)
        }
        break
      case 'isvt':
        device.data.isVirtualStick = parseInt(data) === 1
        break
      case 'isvta':
        device.data.isVirtualStickActive = parseInt(data) === 1
        break
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(deviceId: string): void {
    this.stopHeartbeat(deviceId)

    const interval = setInterval(() => {
      this.sendCommand(deviceId, 'heart')
    }, 15000)

    this.heartbeatIntervals.set(deviceId, interval)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(deviceId: string): void {
    const interval = this.heartbeatIntervals.get(deviceId)
    if (interval) {
      clearInterval(interval)
      this.heartbeatIntervals.delete(deviceId)
    }
  }

  // 任务执行相关
  private runningTasks = new Map<string, boolean>()
  private taskSteps = new Map<string, any[]>()
  private currentStepIndex = new Map<string, number>()

  /**
   * 执行任务步骤
   */
  async executeTaskSteps(steps: any[], deviceId?: string): Promise<void> {
    // 如果没有指定设备ID，使用默认设备
    const targetDeviceId = deviceId || this.getDefaultDeviceId()
    if (!targetDeviceId) {
      throw new Error('没有可用的设备')
    }

    if (this.runningTasks.get(targetDeviceId)) {
      throw new Error('设备已有任务在执行中')
    }

    const device = this.devices.get(targetDeviceId)
    if (!device || !device.isConnected) {
      throw new Error('设备未连接')
    }

    this.runningTasks.set(targetDeviceId, true)
    this.taskSteps.set(targetDeviceId, steps)
    this.currentStepIndex.set(targetDeviceId, 0)

    try {
      for (let i = 0; i < steps.length; i++) {
        if (!this.runningTasks.get(targetDeviceId)) {
          throw new Error('任务已被停止')
        }

        this.currentStepIndex.set(targetDeviceId, i)
        const step = steps[i]
        await this.executeStep(step, targetDeviceId)
      }
    } finally {
      this.runningTasks.set(targetDeviceId, false)
      this.taskSteps.delete(targetDeviceId)
      this.currentStepIndex.delete(targetDeviceId)
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: any, deviceId: string): Promise<void> {
    const { step_type, parameters, timeout = 30 } = step

    switch (step_type) {
      case 'takeoff':
        await this.executeCommand('up', deviceId, timeout)
        break

      case 'landing':
        await this.executeCommand('down', deviceId, timeout)
        break

      case 'move_to_height':
        await this.moveToHeight(parameters.height, deviceId, timeout)
        break

      case 'move_to_heading':
        await this.moveToHeading(parameters.heading, deviceId, timeout)
        break

      case 'wait':
        await this.wait(parameters.duration * 1000) // 转换为毫秒
        break

      case 'photo':
        await this.executeCommand('photo', deviceId, timeout)
        break

      default:
        console.warn(`未知的步骤类型: ${step_type}`)
    }
  }

  /**
   * 执行命令并等待完成
   */
  private async executeCommand(
    command: string,
    deviceId: string,
    timeoutSeconds: number = 30
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.connections.get(deviceId)
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket未连接'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error(`命令执行超时: ${command}`))
      }, timeoutSeconds * 1000)

      // 发送命令
      socket.send(command)

      // 简单的完成检测（实际项目中可能需要更复杂的逻辑）
      setTimeout(() => {
        clearTimeout(timeout)
        resolve()
      }, 2000) // 假设命令需要2秒执行
    })
  }

  /**
   * 移动到指定高度
   */
  private async moveToHeight(
    targetHeight: number,
    deviceId: string,
    timeoutSeconds: number = 30
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.connections.get(deviceId)
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket未连接'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error(`移动到高度超时: ${targetHeight}米`))
      }, timeoutSeconds * 1000)

      const checkHeight = () => {
        if (!this.runningTasks.get(deviceId)) {
          clearTimeout(timeout)
          reject(new Error('任务已停止'))
          return
        }

        const device = this.devices.get(deviceId)
        const currentHeight = parseFloat(device?.data.location.altitude || '0')
        if (Math.abs(currentHeight - targetHeight) < 0.1) {
          clearTimeout(timeout)
          resolve()
          return
        }

        // 发送高度调整命令
        socket.send(`height:${targetHeight}`)

        // 1秒后再次检查
        setTimeout(checkHeight, 1000)
      }

      checkHeight()
    })
  }

  /**
   * 移动到指定方向
   */
  private async moveToHeading(
    targetHeading: number,
    deviceId: string,
    timeoutSeconds: number = 30
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.connections.get(deviceId)
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket未连接'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error(`转向超时: ${targetHeading}度`))
      }, timeoutSeconds * 1000)

      const checkHeading = () => {
        if (!this.runningTasks.get(deviceId)) {
          clearTimeout(timeout)
          reject(new Error('任务已停止'))
          return
        }

        const device = this.devices.get(deviceId)
        const currentHeading = device?.data.attitude.heading || 0
        if (Math.abs(currentHeading - targetHeading) < 3) {
          clearTimeout(timeout)
          resolve()
          return
        }

        // 发送方向调整命令
        socket.send(`heading:${targetHeading}`)

        // 1秒后再次检查
        setTimeout(checkHeading, 1000)
      }

      checkHeading()
    })
  }

  /**
   * 等待指定时间
   */
  private async wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, milliseconds)
    })
  }

  /**
   * 停止设备任务
   */
  stopTask(deviceId?: string): void {
    if (deviceId) {
      this.runningTasks.set(deviceId, false)
    } else {
      // 停止所有任务
      this.runningTasks.forEach((_, id) => {
        this.runningTasks.set(id, false)
      })
    }
  }

  /**
   * 获取任务执行状态
   */
  getTaskStatus(deviceId: string) {
    const isRunning = this.runningTasks.get(deviceId) || false
    const steps = this.taskSteps.get(deviceId) || []
    const currentStep = this.currentStepIndex.get(deviceId) || 0

    return {
      isRunning,
      currentStep,
      totalSteps: steps.length,
      currentStepInfo: steps[currentStep] || null,
    }
  }

  /**
   * 获取默认设备ID
   */
  private getDefaultDeviceId(): string | null {
    for (const [id, device] of this.devices) {
      if (device.isDefault && device.isConnected) {
        return id
      }
    }

    // 如果没有默认设备，返回第一个连接的设备
    for (const [id, device] of this.devices) {
      if (device.isConnected) {
        return id
      }
    }

    return null
  }

  /**
   * 清理所有连接
   */
  cleanup(): void {
    this.devices.forEach((_, deviceId) => {
      this.disconnect(deviceId)
    })
    this.devices.clear()
    this.connections.clear()
    this.eventHandlers.length = 0
  }
}

// 全局实例
export const uavManager = new UAVManager()

// 工具函数
export const sleep = (time: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, time))
}
