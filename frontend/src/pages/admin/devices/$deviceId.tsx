import React, { useEffect, useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { Card, Tag, Button, Space, message, Descriptions } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import {
  WifiOutlined,
  DisconnectOutlined,
  VideoCameraOutlined,
  EditOutlined,
  BugOutlined,
} from '@ant-design/icons'
import { UAVData } from '@/utils/uav/manager'
import RealtimeDataPanel from '@/components/features/devices/RealtimeDataPanel'
import HistoryDataPanel from '@/components/features/devices/HistoryDataPanel'
import * as deviceService from '@/utils/api/device'
import { formatToLocal } from '@/utils/time'

type Device = deviceService.Device

const DeviceDetail: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [uavData, setUavData] = useState<UAVData | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [debugMessages, setDebugMessages] = useState<string[]>([])


  // 获取设备信息
  const fetchDevice = async () => {
    if (!deviceId) return

    try {
      const response = await deviceService.getDevice(deviceId)
      setDevice(response)
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
      setDeviceStatus(statusData)
    } catch (error: any) {
      console.error('获取设备状态失败:', error)
    }
  }

  // 连接设备
  const handleConnect = async () => {
    if (!device) return

    try {
      if (!device.websocket_port) {
        message.error('设备未配置WebSocket端口')
        return
      }

      // 1. 创建后端WebSocket服务器
      try {
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
        message.success(`设备WebSocket服务器已启动，端口: ${device.websocket_port}`)
      } catch (wsError) {
        console.error('WebSocket服务器启动错误:', wsError)
        message.error(`WebSocket服务器启动失败: ${wsError.message}`)
        return
      }

      // 2. 连接成功，后端已创建WebSocket代理

      // 4. 如果设备启用了MQTT，启动MQTT Broker
      if (device.mqtt_enabled && device.mqtt_port) {
        try {
          const response = await fetch(`/api/realtime/devices/${device.uuid}/mqtt/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              port: device.mqtt_port,
              enabled: device.mqtt_enabled,
            }),
          })

          const result = await response.json()
          if (result.success) {
            message.success(`MQTT Broker已启动，端口: ${device.mqtt_port}`)
          } else {
            message.warning(`MQTT Broker启动失败: ${result.message}`)
          }
        } catch (mqttError) {
          console.error('MQTT Broker启动错误:', mqttError)
          message.error('MQTT Broker启动请求失败')
        }
      } else {
        message.info('设备未启用MQTT，仅启动WebSocket连接')
      }

      message.success(`设备 ${device.name} 连接成功`)
      // 重新获取设备状态，稍等一下让后端服务完全启动
      setTimeout(async () => {
        await fetchDeviceStatus()
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

      // 2. 更新前端状态
      setUavData(null)
      message.success(`设备 ${device.name} 已断开连接`)
      // 重新获取设备状态
      await fetchDeviceStatus()
    } catch (error: any) {
      console.error('断开连接错误:', error)
      // 即使后端断开失败，也要更新前端状态
      setUavData(null)
      message.success(`设备 ${device.name} 已断开连接`)
      // 重新获取设备状态
      await fetchDeviceStatus()
    }
  }

  // 连接到后端WebSocket获取实时数据
  useEffect(() => {
    if (!deviceId || !device || deviceStatus?.status !== 'connected') {
      console.log('WebSocket connection conditions not met:', {
        deviceId,
        device: !!device,
        deviceStatus: deviceStatus?.status
      })
      return
    }

    // 连接到设备专用WebSocket代理
    const proxyPort = 2333 + device.id
    const wsUrl = `ws://127.0.0.1:${proxyPort}/${deviceId}`

    console.log('Attempting WebSocket connection:', {
      deviceId,
      deviceDbId: device.id,
      proxyPort,
      wsUrl
    })

    let ws: WebSocket | null = null

    // 添加延迟确保代理服务器已启动
    const connectTimeout = setTimeout(() => {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        const msg = `Connected to device ${deviceId} WebSocket proxy`
        console.log(msg)
        setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
      }

      ws.onmessage = (event) => {
        const msg = `Received: ${event.data}`
        console.log(`Received from device ${deviceId}:`, event.data)
        setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])

        // 解析数据并更新状态
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
                setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] MQTT sensor data: ${JSON.stringify(sensorData)}`])
              }
            }
          } catch (e) {
            console.error('Failed to parse MQTT data:', e)
            setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] Error parsing MQTT data: ${e}`])
          }
        } else {
          // 无人机WebSocket数据
          let cleanData = event.data
          // 移除可能的外层引号
          if (cleanData.startsWith('"') && cleanData.endsWith('"')) {
            cleanData = cleanData.slice(1, -1)
          }

          const colonIndex = cleanData.indexOf(':')
          if (colonIndex !== -1) {
            let key = cleanData.substring(0, colonIndex)
            let value = cleanData.substring(colonIndex + 1)

            // 移除键和值中的引号
            key = key.replace(/['"]/g, '')
            value = value.replace(/['"]/g, '')

            console.log(`解析WebSocket数据: key="${key}", value="${value}"`)
            setUavData(prev => ({ ...prev, [key]: value }))
          }
        }
      }

      ws.onclose = () => {
        const msg = `Disconnected from device ${deviceId} WebSocket proxy`
        console.log(msg)
        setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
      }

      ws.onerror = (error) => {
        const msg = `WebSocket error: ${error}`
        console.error(`WebSocket error for device ${deviceId}:`, error)
        setDebugMessages(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
      }
    }, 1000) // 1秒延迟

    return () => {
      clearTimeout(connectTimeout)
      if (ws) {
        ws.close()
      }
    }
  }, [deviceId, device, deviceStatus?.status])

  useEffect(() => {
    const initializeData = async () => {
      await fetchDevice()
      await fetchDeviceStatus()
    }

    initializeData()

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
        title: device.name,
        breadcrumb: {
          items: [
            {
              title: '设备管理',
              onClick: () => navigate('/admin/devices'),
            },
            {
              title: device.name,
            },
          ],
        },
        extra: [
          <Button
            key='debug'
            icon={<BugOutlined />}
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            type={showDebugInfo ? 'primary' : 'default'}
          >
            调试信息
          </Button>,
          <Button
            key='edit'
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/devices/edit/${device.uuid}`)}
          >
            编辑设备
          </Button>,
          <Button
            key='live'
            type='primary'
            icon={<VideoCameraOutlined />}
            onClick={() => navigate(`/admin/devices/live/${device.uuid}`)}
          >
            设备实况
          </Button>,
          <Button
            key='connect'
            type={deviceStatus?.status === 'connected' ? 'default' : 'primary'}
            icon={deviceStatus?.status === 'connected' ? <DisconnectOutlined /> : <WifiOutlined />}
            onClick={deviceStatus?.status === 'connected' ? handleDisconnect : handleConnect}
          >
            {deviceStatus?.status === 'connected' ? '断开连接' : '连接设备'}
          </Button>,
        ],
      }}
    >
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        {/* 设备基本信息 */}
        <Card title='设备信息'>
          <Descriptions column={2}>
            <Descriptions.Item label='设备名称'>{device.name}</Descriptions.Item>
            <Descriptions.Item label='连接状态'>
              <Tag color={deviceStatus?.status === 'connected' ? 'green' : 'red'}>
                {deviceStatus?.status === 'connected' ? '已连接' : '未连接'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label='WebSocket端口'>{device.websocket_port || '未配置'}</Descriptions.Item>
            <Descriptions.Item label='默认设备'>
              <Tag color={device.is_default ? 'gold' : 'default'}>
                {device.is_default ? '是' : '否'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label='RTMP视频流地址'>
              {device.rtmp_url || '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label='HTTP API地址'>
              {device.http_api_url || '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label='无人机品牌'>
              {device.drone_brand || '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label='无人机型号'>
              {device.drone_model || '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label='创建时间'>
              {formatToLocal(device.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label='更新时间'>
              {formatToLocal(device.updated_at)}
            </Descriptions.Item>
            <Descriptions.Item label='MQTT Broker' span={2}>
              {device.mqtt_enabled ? (
                <Tag color={deviceStatus?.mqtt_running ? 'green' : 'orange'}>
                  {deviceStatus?.mqtt_running ? '运行中' : '未启动'} (端口: {device.mqtt_port})
                </Tag>
              ) : (
                <Tag color='default'>未启用</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label='设备描述' span={2}>
              {device.description || '无描述'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* MQTT连接信息 */}
        {device.mqtt_enabled && device.mqtt_port && (
          <Card title='MQTT Broker信息'>
            <Descriptions column={2}>
              <Descriptions.Item label='Broker状态'>
                <Tag color={deviceStatus?.mqtt_running ? 'green' : 'orange'}>
                  {deviceStatus?.mqtt_running ? '运行中' : '未启动'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label='监听端口'>
                {device.mqtt_port}
              </Descriptions.Item>
              <Descriptions.Item label='连接地址' span={2}>
                <code>mqtt://localhost:{device.mqtt_port}</code>
              </Descriptions.Item>
            </Descriptions>
            <Descriptions column={1} style={{ marginTop: 16 }}>
              <Descriptions.Item label='使用说明'>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <p>温湿度传感器等设备可以连接到此MQTT Broker发送数据：</p>
                  <ul style={{ marginLeft: '20px' }}>
                    <li>服务器地址: <code>localhost</code> 或本机IP地址</li>
                    <li>端口: <code>{device.mqtt_port}</code></li>
                    <li>主题: 任意主题名称（如 <code>sensor/data</code>）</li>
                    <li>数据格式: JSON格式，如 <code>{`{"temperature": 25.5, "humidity": 60.2}`}</code></li>
                  </ul>
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 调试信息面板 */}
        {showDebugInfo && (
          <Card title="WebSocket调试信息">
            <div style={{
              height: 300,
              overflowY: 'auto',
              backgroundColor: '#f5f5f5',
              padding: 12,
              fontFamily: 'monospace',
              fontSize: '12px',
              border: '1px solid #d9d9d9',
              borderRadius: 4
            }}>
              {debugMessages.length > 0 ? (
                debugMessages.map((msg, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    {msg}
                  </div>
                ))
              ) : (
                <div style={{ color: '#999' }}>暂无调试信息</div>
              )}
            </div>
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button
                size="small"
                onClick={() => setDebugMessages([])}
              >
                清空日志
              </Button>
            </div>
          </Card>
        )}

        {/* 实时数据面板 */}
        {deviceId && (
          <RealtimeDataPanel deviceId={deviceId} showHistory={false} />
        )}

        {/* 历史数据面板 */}
        {deviceId && (
          <HistoryDataPanel deviceId={deviceId} realtimeData={uavData} />
        )}
      </Space>
    </PageContainer>
  )
}

export default DeviceDetail
