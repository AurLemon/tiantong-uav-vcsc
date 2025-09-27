import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Tag, Progress, Typography, Space, Button } from 'antd'
import {
  ThunderboltTwoTone,
  EnvironmentTwoTone,
  CompassTwoTone,
  RocketTwoTone,
  WifiOutlined,
  HistoryOutlined,
  FireOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

interface RealtimeDataPanelProps {
  deviceId: string
  showHistory?: boolean
}

interface DeviceRealtimeData {
  // 基础无人机数据 (来自WebSocket)
  battery?: string
  location?: {
    latitude: string
    longitude: string
    altitude: string
  }
  attitude?: {
    heading: number
  }
  isfly?: string | boolean
  isconn?: string | boolean
  isvt?: string | boolean  // 虚拟摇杆
  isvta?: string | boolean // 虚拟摇杆高级模式
  camera?: string

  // MQTT传感器数据
  mqtt?: {
    temperature_c?: number
    temperature_f?: number
    temperature_k?: number
    humidity?: number
  }

  // 扩展数据
  [key: string]: any
}

export const RealtimeDataPanel: React.FC<RealtimeDataPanelProps> = ({
  deviceId,
  showHistory = false
}) => {
  const [deviceData, setDeviceData] = useState<DeviceRealtimeData>({})
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [history, setHistory] = useState<any[]>([])

  // 获取设备状态
  const fetchDeviceStatus = async () => {
    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/status`)
      if (response.ok) {
        const result = await response.json()
        setDeviceData(result.data || {})
        setIsConnected(result.status === 'connected')
        setLastUpdate(new Date())
      } else {
        console.warn('Failed to fetch device status:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch device status:', error)
    }
  }

  useEffect(() => {
    // 初始加载
    fetchDeviceStatus()

    // 定期刷新数据
    const interval = setInterval(fetchDeviceStatus, 2000) // 每2秒刷新一次

    return () => {
      clearInterval(interval)
    }
  }, [deviceId])

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/history?limit=50`)
      if (response.ok) {
        const result = await response.json()
        setHistory(result.data || [])
      }
    } catch (error) {
      console.error('Failed to load device history:', error)
    }
  }

  const getBatteryColor = (battery: string): string => {
    const level = parseInt(battery) || 0
    if (level > 60) return '#52c41a'
    if (level > 30) return '#faad14'
    return '#ff4d4f'
  }

  const formatLocation = (location: { latitude: string; longitude: string; altitude: string }) => {
    return `${parseFloat(location.latitude).toFixed(6)}, ${parseFloat(location.longitude).toFixed(6)}`
  }

  const hasData = Object.keys(deviceData).length > 0

  return (
    <div>
      {/* 连接状态 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }} />
          <Text strong>连接状态: </Text>
          <Tag color={isConnected ? 'green' : 'red'}>
            {isConnected ? '已连接' : '未连接'}
          </Tag>
          {lastUpdate && (
            <Text type="secondary">
              最后更新: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </Space>
      </Card>

      {/* 设备状态卡片 - 两行三列布局 */}
      <Row gutter={[16, 16]}>
        {/* 第一行 */}
        {/* 电池信息 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <Statistic
                title="电池电量"
                value={parseInt(deviceData.battery || '0') || 0}
                suffix="%"
                prefix={<ThunderboltTwoTone twoToneColor={getBatteryColor(deviceData.battery || '0')} />}
              />
            </div>
            <Progress
              percent={parseInt(deviceData.battery || '0') || 0}
              strokeColor={getBatteryColor(deviceData.battery || '0')}
              size="small"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        {/* 位置信息 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <Statistic
                title="位置"
                value={deviceData.location ? formatLocation(deviceData.location) : '-'}
                prefix={<EnvironmentTwoTone />}
              />
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
              高度: {deviceData.location ? parseFloat(deviceData.location.altitude).toFixed(2) + 'm' : '-'}
            </Text>
          </Card>
        </Col>

        {/* 航向角 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Statistic
              title="航向角"
              value={deviceData.attitude?.heading !== undefined ? deviceData.attitude.heading.toFixed(1) : '-'}
              suffix={deviceData.attitude?.heading !== undefined ? "°" : ""}
              prefix={<CompassTwoTone />}
            />
          </Card>
        </Col>

        {/* 第二行 */}
        {/* 飞行状态 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <Statistic
                title="飞行状态"
                value={(deviceData.isfly === '1' || deviceData.isfly === true) ? '飞行中' : '着陆'}
                prefix={
                  <RocketTwoTone
                    twoToneColor={(deviceData.isfly === '1' || deviceData.isfly === true) ? '#52c41a' : '#d9d9d9'}
                  />
                }
              />
            </div>
            <div style={{ fontSize: '11px', lineHeight: '16px', marginTop: 8 }}>
              <div style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>虚拟摇杆:</Text>
                <Tag size="small" color={(deviceData.isvt === '1' || deviceData.isvt === true) ? 'blue' : 'default'}>
                  {(deviceData.isvt === '1' || deviceData.isvt === true) ? '启用' : '禁用'}
                </Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>指令模式:</Text>
                <Tag size="small" color={(deviceData.isvta === '1' || deviceData.isvta === true) ? 'purple' : 'default'}>
                  {(deviceData.isvta === '1' || deviceData.isvta === true) ? '启用' : '禁用'}
                </Tag>
              </div>
            </div>
          </Card>
        </Col>

        {/* 温度 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Statistic
              title="温度"
              value={deviceData.mqtt?.temperature_c !== undefined ? deviceData.mqtt.temperature_c : '-'}
              suffix={deviceData.mqtt?.temperature_c !== undefined ? "°C" : ""}
              precision={deviceData.mqtt?.temperature_c !== undefined ? 1 : 0}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>

        {/* 湿度 */}
        <Col xs={24} sm={12} md={8}>
          <Card style={{ height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Statistic
              title="湿度"
              value={deviceData.mqtt?.humidity !== undefined ? deviceData.mqtt.humidity : '-'}
              suffix={deviceData.mqtt?.humidity !== undefined ? "%" : ""}
              precision={deviceData.mqtt?.humidity !== undefined ? 1 : 0}
              prefix={<EnvironmentTwoTone />}
            />
          </Card>
        </Col>
      </Row>



      {/* 历史数据 */}
      {showHistory && (
        <Card 
          title="历史数据" 
          style={{ marginTop: 16 }}
          extra={
            <Button 
              icon={<HistoryOutlined />} 
              onClick={loadHistory}
              size="small"
            >
              刷新
            </Button>
          }
        >
          {history.length > 0 ? (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {history.map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                  <Space direction="vertical" size="small">
                    <Text strong>
                      {item.data_type === 'mqtt' ? 'MQTT数据' : 'WebSocket数据'} - 
                      {new Date(item.received_at).toLocaleString()}
                    </Text>
                    <Text code>{JSON.stringify(item.data, null, 2)}</Text>
                  </Space>
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">暂无历史数据</Text>
          )}
        </Card>
      )}
    </div>
  )
}

export default RealtimeDataPanel
