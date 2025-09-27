import React, { useEffect, useState, useRef } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  message,
  Descriptions,
  Tag
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons'
import { UAVData } from '@/utils/uav/manager'
import * as deviceService from '@/utils/api/device'
import AMapComponent from '@/components/features/map/AMapComponent'
import RTMPPlayer from '@/components/features/video/RTMPPlayer'

type Device = deviceService.Device

const DeviceLive: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceStatus, setDeviceStatus] = useState<any>(null)
  const [uavData, setUavData] = useState<UAVData>({
    battery: '未知',
    location: {
      latitude: '',
      longitude: '',
      altitude: ''
    },
    attitude: {
      heading: '0'
    },
    isFlying: false,
    isConnected: false,
    isVirtualStick: false,
    isVirtualStickAdvanced: false
  })
  const [executingTask, setExecutingTask] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // 获取设备信息
  const fetchDevice = async () => {
    if (!deviceId) return

    try {
      setLoading(true)
      const deviceData = await deviceService.getDevice(deviceId)
      setDevice(deviceData)
    } catch (error: any) {
      message.error(`获取设备信息失败: ${error.message}`)
      navigate('/admin/devices')
    } finally {
      setLoading(false)
    }
  }

  // 获取设备状态
  const fetchDeviceStatus = async () => {
    if (!deviceId) return

    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch device status')
      }
      const statusData = await response.json()
      console.log('设备状态:', statusData)
      setDeviceStatus(statusData)
    } catch (error: any) {
      console.error('获取设备状态失败:', error)
    }
  }



  // 连接设备
  const handleConnect = async () => {
    if (!device) return

    try {
      // 1. 连接后端WebSocket代理
      const response = await fetch(`/api/realtime/devices/${device.uuid}/websocket/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          port: device.websocket_port,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      message.success(`设备 ${device.name} 连接成功`)

      // 重新获取设备状态
      await fetchDeviceStatus()

      // 自动初始化设备状态（参考index.html的逻辑）
      setTimeout(async () => {
        await sendCommand('get status')
        await sendCommand('vstick')
        setTimeout(async () => {
          await sendCommand('vastick')
        }, 2000)
      }, 1000)

    } catch (error: any) {
      message.error(`设备连接失败: ${error.message}`)
    }
  }

  // 断开连接
  const handleDisconnect = async () => {
    if (!device) return

    try {
      // 1. 断开后端WebSocket代理连接
      await fetch(`/api/realtime/devices/${device.uuid}/websocket/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      setUavData({
        battery: '未知',
        location: { latitude: '', longitude: '', altitude: '' },
        attitude: { heading: '0' },
        isFlying: false,
        isConnected: false,
        isVirtualStick: false,
        isVirtualStickAdvanced: false
      })
      message.success(`设备 ${device.name} 已断开连接`)
      // 重新获取设备状态
      await fetchDeviceStatus()
    } catch (error: any) {
      console.error('断开连接错误:', error)
      // 即使后端断开失败，也要更新前端状态
      setUavData({
        battery: '未知',
        location: { latitude: '', longitude: '', altitude: '' },
        attitude: { heading: '0' },
        isFlying: false,
        isConnected: false,
        isVirtualStick: false,
        isVirtualStickAdvanced: false
      })
      message.success(`设备 ${device.name} 已断开连接`)
      // 重新获取设备状态
      await fetchDeviceStatus()
    }
  }

  // 发送控制命令
  const sendCommand = (command: string) => {
    if (!device || deviceStatus?.status !== 'connected') {
      message.warning('后端服务未启动')
      return
    }

    // 检查WebSocket连接状态
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      message.warning('WebSocket连接未建立')
      return
    }

    console.log(`通过WebSocket发送命令: ${command}`)

    try {
      // 直接通过WebSocket发送命令
      wsRef.current.send(command)
      message.success(`命令已发送: ${command}`)
    } catch (error) {
      console.error('命令发送异常:', error)
      message.error(`命令发送失败: ${error}`)
    }
  }



  // 一键任务
  const handleOneClickTask = async () => {
    if (!device || deviceStatus?.status !== 'connected') {
      message.warning('设备未连接')
      return
    }

    try {
      setExecutingTask(true)
      message.info('开始执行一键任务...')

      // 发送任务开始信号
      await sendCommand('task start')

      // 执行任务序列（根据index.html的任务逻辑）
      await sendCommand('up') // 起飞
      await new Promise(resolve => setTimeout(resolve, 10000)) // 等待10秒

      await sendCommand('heading:0') // 朝北
      await new Promise(resolve => setTimeout(resolve, 10000)) // 静止10秒

      await sendCommand('height:1.5') // 飞到1.5米
      await sendCommand('heading:0') // 朝北
      await new Promise(resolve => setTimeout(resolve, 10000)) // 静止10秒

      await sendCommand('height:2') // 飞到2米
      await sendCommand('heading:0') // 朝北
      await new Promise(resolve => setTimeout(resolve, 10000)) // 静止10秒

      await sendCommand('down') // 降落
      await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒

      // 发送任务完成信号
      await sendCommand('task finish')

      message.success('一键任务执行完成')
    } catch (error: any) {
      message.error(`一键任务执行失败: ${error.message}`)
    } finally {
      setExecutingTask(false)
    }
  }



  // 连接到后端WebSocket获取实时数据
  useEffect(() => {
    if (!deviceId || !device || deviceStatus?.status !== 'connected') return

    // 连接到设备专用WebSocket代理
    const proxyPort = 2333 + device.id
    const wsUrl = `ws://127.0.0.1:${proxyPort}/${deviceId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`Connected to device ${deviceId} WebSocket proxy`)
    }

    ws.onmessage = (event) => {
      console.log(`Received from device ${deviceId}:`, event.data)

      // 解析数据并更新状态（兼容index.html的数据格式）
      if (event.data.startsWith('mqtt:')) {
        // MQTT温湿度数据
        try {
          const mqttData = JSON.parse(event.data.substring(5))
          // 解析raw_message中的实际传感器数据
          if (mqttData.raw_message) {
            // 提取JSON部分（去掉前面的控制字符和topic）
            const jsonMatch = mqttData.raw_message.match(/\{.*\}/)
            if (jsonMatch) {
              const sensorData = JSON.parse(jsonMatch[0])
              setUavData(prev => ({ ...prev, mqtt: sensorData }))
            }
          }
        } catch (e) {
          console.error('Failed to parse MQTT data:', e)
        }
      } else {
        // 无人机WebSocket数据 - 按照index.html的格式解析
        let cleanData = event.data
        // 移除可能的引号
        if (cleanData.startsWith('"') && cleanData.endsWith('"')) {
          cleanData = cleanData.slice(1, -1)
        }

        const colonIndex = cleanData.indexOf(':')
        if (colonIndex === -1) return

        const key = cleanData.substring(0, colonIndex)
        const value = cleanData.substring(colonIndex + 1)

        // 记录消息（排除心跳消息）
        if (key !== 'heart') {
          setMessages(prev => [cleanData, ...prev.slice(0, 49)]) // 保留最新50条消息
        }

        // 添加调试日志
        console.log(`解析数据: key="${key}", value="${value}"`)

        setUavData(prev => {
          const newData = { ...prev }

          switch (key) {
            case 'battery':
              newData.battery = value
              console.log('更新电池:', value)
              break
            case 'location':
              const coords = value.split(' ')
              newData.location = {
                latitude: coords[0],
                longitude: coords[1],
                altitude: coords[2]
              }
              console.log('更新位置:', newData.location)
              break
            case 'attitude':
              const attitudeValues = value.split(' ')
              if (attitudeValues.length >= 3) {
                newData.attitude = {
                  ...newData.attitude,
                  heading: parseFloat(attitudeValues[2] || '0').toFixed(2)
                }
                console.log('更新航向:', newData.attitude.heading)
              }
              break
            case 'isfly':
              newData.isFlying = value === '1'
              console.log('更新飞行状态:', newData.isFlying)
              break
            case 'isconn':
              newData.isConnected = value === '1'
              console.log('更新连接状态:', newData.isConnected)
              break
            case 'isvt':
              newData.isVirtualStick = value === '1'
              console.log('更新虚拟摇杆状态:', newData.isVirtualStick)
              break
            case 'isvta':
              newData.isVirtualStickAdvanced = value === '1'
              console.log('更新指令模式状态:', newData.isVirtualStickAdvanced)
              break
            default:
              newData[key] = value
              console.log('其他数据:', key, value)
          }

          return newData
        })
      }
    }

    ws.onclose = () => {
      console.log(`Disconnected from device ${deviceId} WebSocket proxy`)
      wsRef.current = null
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for device ${deviceId}:`, error)
      wsRef.current = null
    }

    return () => {
      ws.close()
    }
  }, [deviceId, device, deviceStatus?.status])

  useEffect(() => {
    fetchDevice()
    fetchDeviceStatus()

    // 定期获取设备状态
    const statusInterval = setInterval(fetchDeviceStatus, 3000)

    return () => {
      clearInterval(statusInterval)
    }
  }, [deviceId])





  if (loading) {
    return <PageContainer loading />
  }

  if (!device) {
    return <PageContainer>设备不存在</PageContainer>
  }

  return (
    <PageContainer
      header={{
        title: `设备实况 - ${device.name}`,
        breadcrumb: {
          items: [
            {
              title: <a onClick={() => navigate('/admin/devices')}>设备管理</a>,
            },
            {
              title: device.name,
            },
            {
              title: '实况',
            },
          ],
        },
      }}
    >
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        {/* 设备连接状态 */}
        <Card size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Tag color={deviceStatus?.status === 'connected' ? 'green' : 'red'}>
                {deviceStatus?.status === 'connected' ? <WifiOutlined /> : <DisconnectOutlined />}
                后端服务: {deviceStatus?.status === 'connected' ? '已启动' : '未启动'}
              </Tag>
              <Tag color={uavData.isConnected ? 'green' : 'orange'}>
                {uavData.isConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                设备连接: {uavData.isConnected ? '已连接' : '未连接'}
              </Tag>
            </Space>
            <Space>
              {deviceStatus?.status !== 'connected' ? (
                <Button type="primary" size="small" onClick={handleConnect}>
                  启动服务
                </Button>
              ) : (
                <Button size="small" onClick={handleDisconnect}>
                  关闭服务
                </Button>
              )}
              <Button
                size="small"
                disabled={deviceStatus?.status !== 'connected'}
                onClick={() => sendCommand('get status')}
              >
                获取设备状态
              </Button>
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {/* 左侧：地图和视频 */}
          <Col xs={24} lg={16}>
            <Space direction='vertical' size='middle' style={{ width: '100%' }}>
              {/* 实时视频流 */}
              <Card title="实时视频" size="small">
                <RTMPPlayer
                  rtmpUrl={device.easynvr_url}
                  deviceId={device.id}
                  style={{ height: '300px', width: '100%' }}
                  autoPlay={false}
                />
              </Card>
            </Space>
          </Col>

          {/* 右侧：控制面板 */}
          <Col xs={24} lg={8}>
            <Space direction='vertical' size='middle' style={{ width: '100%' }}>
              {/* 设备状态信息 */}
              {deviceStatus?.status === 'connected' && (
                <Card title="设备状态" size="small">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="设备">大疆M3E</Descriptions.Item>
                    <Descriptions.Item label="电池电量">
                      <Space>
                        <ThunderboltOutlined />
                        {uavData.battery || '未知'}%
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="连接状态">
                      <Tag color={uavData.isConnected ? 'green' : 'red'}>
                        {uavData.isConnected ? '已连接' : '未连接'}
                      </Tag>
                      <Tag color={uavData.isFlying ? 'red' : 'green'}>
                        {uavData.isFlying ? '飞行' : '未起飞'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="坐标">
                      {uavData.location?.latitude || '未知'} {uavData.location?.longitude || '未知'}
                    </Descriptions.Item>
                    <Descriptions.Item label="高度">
                      {uavData.location?.altitude || '未知'} 米
                    </Descriptions.Item>
                    <Descriptions.Item label="方向">
                      {uavData.attitude?.heading || '未知'}°
                      <br />
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        （正北0 正东90 正南180 正西-90）
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="模式状态">
                      <Tag color={uavData.isVirtualStick ? 'blue' : 'default'}>
                        {uavData.isVirtualStick ? '虚拟摇杆开启' : '虚拟摇杆未开启'}
                      </Tag>
                      <br />
                      <Tag color={uavData.isVirtualStickAdvanced ? 'purple' : 'default'}>
                        {uavData.isVirtualStickAdvanced ? '指令模式开启' : '指令模式未开启'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* 基础控制 */}
              <Card title="基础控制" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      icon={<ArrowUpOutlined />}
                      disabled={deviceStatus?.status !== 'connected'}
                      onClick={() => sendCommand('up')}
                    >
                      起飞
                    </Button>
                    <Button
                      icon={<ArrowDownOutlined />}
                      disabled={deviceStatus?.status !== 'connected'}
                      onClick={() => sendCommand('down')}
                    >
                      降落
                    </Button>
                  </Space>
                  <Space style={{ width: '100%' }}>
                    <Button
                      size="small"
                      disabled={deviceStatus?.status !== 'connected'}
                      onClick={() => sendCommand('vstick')}
                    >
                      开启虚拟摇杆
                    </Button>
                    <Button
                      size="small"
                      disabled={deviceStatus?.status !== 'connected'}
                      onClick={() => sendCommand('vastick')}
                    >
                      开启指令模式
                    </Button>
                  </Space>
                  <Button
                    size="small"
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={() => sendCommand('get status')}
                    block
                  >
                    获取状态
                  </Button>
                </Space>
              </Card>

              {/* 方向控制 */}
              <Card title="方向控制" size="small">
                <Space style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={() => sendCommand('heading:0')}
                  >
                    朝正北
                  </Button>
                  <Button
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={() => sendCommand('heading:180')}
                  >
                    朝正南
                  </Button>
                </Space>
              </Card>

              {/* 高度控制 */}
              <Card title="高度控制" size="small">
                <Space style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={() => sendCommand('height:1.5')}
                  >
                    飞到1.5米
                  </Button>
                  <Button
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={() => sendCommand('height:2')}
                  >
                    飞到2米
                  </Button>
                </Space>
              </Card>

              {/* 功能按钮 */}
              <Card title="功能操作" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    block
                    disabled={deviceStatus?.status !== 'connected'}
                    onClick={handleOneClickTask}
                    loading={executingTask}
                  >
                    一键任务
                  </Button>
                  <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '8px' }}>
                    （起飞-悬停-朝北-静止10秒<br />
                    -飞到1.5米-悬停-朝北-静止10秒<br />
                    -飞到2米-悬停-朝北-静止10秒-降落）
                  </div>
                </Space>
              </Card>

              {/* 实时消息 */}
              <Card title="实时消息" size="small">
                <div style={{ height: '200px', overflow: 'auto', backgroundColor: '#f5f5f5', padding: '8px', fontSize: '12px' }}>
                  {messages.length === 0 ? (
                    <div style={{ color: '#999', textAlign: 'center', paddingTop: '80px' }}>
                      等待消息...
                    </div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {messages.map((msg, index) => (
                        <li key={index} style={{ marginBottom: '4px', color: '#333' }}>
                          {msg}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>


    </PageContainer>
  )
}

export default DeviceLive
