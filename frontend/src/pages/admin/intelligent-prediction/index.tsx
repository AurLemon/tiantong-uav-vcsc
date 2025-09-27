import React, { useEffect, useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import {
  Card,
  Row,
  Col,
  Spin,
  Timeline,
  Descriptions,
  Typography,
  Space,
  theme,
  DatePicker
} from 'antd'
import {
  RadarChartOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import radarGif from '@/assets/resources/radar_pre.gif'

const { Paragraph } = Typography

const IntelligentPrediction: React.FC = () => {
  const { token } = theme.useToken()
  const [loading, setLoading] = useState(true)
  const [selectedTime, setSelectedTime] = useState(dayjs('2025-09-03 10:00:00'))

  // 模拟加载过程
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500) // 500ms加载时间

    return () => clearTimeout(timer)
  }, [])

  // 传感器数据
  const sensorData = [
    { label: '温度', value: '22°C' },
    { label: '湿度', value: '80%' },
    { label: '风速', value: '2.3 m/s' },
  ]

  // 时间轴数据
  const timelineData = [
    {
      color: 'blue',
      children: (
        <div>
          <p><strong>2025-09-03 10:00</strong></p>
          <p>当前时间 - 实时数据采集中</p>
        </div>
      ),
    },
    {
      color: 'green',
      children: (
        <div>
          <p><strong>2025-09-03 10:02</strong></p>
          <p>预测数据更新</p>
        </div>
      ),
    },
    {
      color: 'orange',
      children: (
        <div>
          <p><strong>2025-09-03 10:02</strong></p>
          <p>短临预报生成</p>
        </div>
      ),
    },
    {
      color: 'red',
      children: (
        <div>
          <p><strong>2025-09-03 10:03</strong></p>
          <p>预警信息发布</p>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <PageContainer header={{ title: '智能预测' }}>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size='large' />
          <p style={{ marginTop: 16, color: token.colorTextSecondary }}>
            正在加载智能预测数据...
          </p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer header={{ title: '智能预测' }}>
      <Space direction='vertical' size={24} style={{ width: '100%' }}>
        {/* 上方三个卡片在一行 */}
        <Row gutter={[16, 16]}>
          {/* 左侧：国家气象大数据平台实时雷达数据 */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <RadarChartOutlined style={{ color: token.colorPrimary }} />
                  国家气象大数据平台实时雷达数据
                </Space>
              }
              style={{ height: 400 }}
            >
              <div style={{ textAlign: 'center', height: '100%' }}>
                <img
                  src={radarGif}
                  alt="实时雷达数据"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </Card>
          </Col>

          {/* 中间：无人机采集的温湿度、风速 */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <ThunderboltOutlined style={{ color: token.colorWarning }} />
                  无人机采集的温湿度、风速
                </Space>
              }
              style={{ height: 400 }}
            >
              <Descriptions
                column={1}
                size="middle"
                labelStyle={{ fontWeight: 'bold', width: '120px' }}
                contentStyle={{ fontSize: '18px', fontWeight: 'bold' }}
              >
                {sensorData.map((item, index) => (
                  <Descriptions.Item
                    key={index}
                    label={item.label}
                    labelStyle={{
                      color: token.colorText,
                      fontSize: '16px'
                    }}
                    contentStyle={{
                      color: token.colorPrimary,
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}
                  >
                    {item.value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
              <div style={{ marginTop: 24, padding: 16, backgroundColor: token.colorBgContainer, borderRadius: 8 }}>
                <p style={{ margin: 0, color: token.colorTextSecondary }}>
                  数据更新时间：2025-09-03 10:00:00
                </p>
                <p style={{ margin: 0, color: token.colorTextSecondary }}>
                  无人机设备：UAV
                </p>
              </div>
            </Card>
          </Col>

          {/* 右侧：预测雷达图 */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <CloudOutlined style={{ color: token.colorSuccess }} />
                  预测雷达图
                </Space>
              }
              style={{ height: 400 }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '300px'
              }}>
                <img
                  src="/src/assets/resources/radar_pre.png"
                  alt="预测雷达图"
                  style={{
                    width: 'auto',
                    height: '100%',
                    maxWidth: '200px',
                    aspectRatio: '1/1',
                    objectFit: 'contain',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 下方：事件时间轴、短临预测天气和时间选择器 */}
        <Row gutter={[16, 16]}>
          {/* 事件时间轴 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: token.colorPrimary }} />
                  事件时间轴
                  <DatePicker
                    showTime
                    value={selectedTime}
                    onChange={(value) => setSelectedTime(value)}
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder="选择时间"
                    style={{ marginLeft: 16 }}
                  />
                </Space>
              }
            >
              <Timeline
                items={timelineData}
                style={{ padding: '20px 0' }}
              />
            </Card>
          </Col>

          {/* 短临预测天气 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <CloudOutlined style={{ color: token.colorInfo }} />
                  短临预测天气
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Paragraph style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                根据最新气象数据分析，当前雷达图显示本区域正在经历降水过程，但未来2-6小时内雨势将逐渐减弱并停止。
                气温稳定在20-24℃之间，东南风2-3级，相对湿度75-85%。预计11:00-13:00时段降水将完全停止，
                转为多云天气，适宜无人机作业恢复进行。
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  )
}

export default IntelligentPrediction
