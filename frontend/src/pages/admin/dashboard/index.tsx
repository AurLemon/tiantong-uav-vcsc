import React, { useEffect, useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { Card, Row, Col, Statistic, Space, theme, List, Tag, Spin, Empty, Progress } from 'antd'
import { Column, Pie } from '@ant-design/plots'
import {
  RadarChartOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WifiOutlined,
  DatabaseOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as dashboardService from '@/utils/api/dashboard'
import * as collectionDataService from '@/utils/api/collection-data'
import * as predictionDataService from '@/utils/api/prediction-data'
import { formatToLocal } from '@/utils/time'

const Dashboard: React.FC = () => {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<dashboardService.DashboardStats | null>(null)
  const [collectionDataTrend, setCollectionDataTrend] = useState<any[]>([])  
  const [predictionDataTrend, setPredictionDataTrend] = useState<any[]>([])
  const [dataTypeDistribution, setDataTypeDistribution] = useState<any[]>([])
  const [collectionDataCount, setCollectionDataCount] = useState(0)
  const [predictionDataCount, setPredictionDataCount] = useState(0)

  // 获取仪表盘数据
  const fetchDashboardStats = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }

      // 获取仪表盘数据（包含所有统计信息）
      const dashboardData = await dashboardService.getDashboardStats()

      setStats(dashboardData)
      setCollectionDataCount(dashboardData.collection_data_count || 0)
      setPredictionDataCount(dashboardData.prediction_data_count || 0)

      // 使用后端提供的趋势数据
      const collectionTrendData = (dashboardData.collection_trend || []).map(item => ({
        date: item.date,
        value: item.value ?? 0, // 处理null值，转换为0
        type: '采集数据'
      }))
      setCollectionDataTrend(collectionTrendData)

      const predictionTrendData = (dashboardData.prediction_trend || []).map(item => ({
        date: item.date,
        value: item.value ?? 0, // 处理null值，转换为0
        type: '预报数据'
      }))
      setPredictionDataTrend(predictionTrendData)

      // 生成数据类型分布饼图数据
      const distributionData = [
        { type: '采集数据', value: dashboardData.collection_data_count || 0 },
        { type: '预报数据', value: dashboardData.prediction_data_count || 0 },
        { type: '完成任务', value: dashboardData.completed_tasks },
        { type: '运行任务', value: dashboardData.running_tasks }
      ]
      setDataTypeDistribution(distributionData)
    } catch (error: any) {
      console.error('获取仪表盘数据失败:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchDashboardStats()

    // 每30秒刷新一次数据（无感刷新）
    const interval = setInterval(() => fetchDashboardStats(false), 30000)

    return () => clearInterval(interval)
  }, [])

  // 任务状态颜色映射
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'running':
        return 'processing'
      case 'failed':
        return 'error'
      case 'pending':
        return 'default'
      default:
        return 'default'
    }
  }

  // 任务状态文本映射
  const getTaskStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'running':
        return '运行中'
      case 'failed':
        return '失败'
      case 'pending':
        return '等待中'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <PageContainer header={{ title: null }}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size='large' />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer header={{ title: null }}>
      <Space direction='vertical' size={24} style={{ width: '100%' }}>
        {/* 欢迎卡片 */}
        <Card
          style={{
            borderRadius: 8,
            background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryBorder} 100%)`,
            color: '#fff',
          }}
        >
          <div>
            <p className='text-white text-2xl font-medium'>实时监控设备状态，管理飞行任务，数据分析一目了然</p>
          </div>
        </Card>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='设备总数'
                value={stats?.total_devices || 0}
                prefix={<RadarChartOutlined style={{ color: token.colorPrimary }} />}
                suffix='台'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='在线设备'
                value={stats?.connected_devices || 0}
                prefix={<WifiOutlined style={{ color: '#52c41a' }} />}
                suffix='台'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='任务总数'
                value={stats?.total_tasks || 0}
                prefix={<RocketOutlined style={{ color: token.colorWarning }} />}
                suffix='个'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='运行中任务'
                value={stats?.running_tasks || 0}
                prefix={<SyncOutlined style={{ color: token.colorInfo }} />}
                suffix='个'
              />
            </Card>
          </Col>
        </Row>

        {/* 数据统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='采集数据总量'
                value={collectionDataCount}
                prefix={<DatabaseOutlined style={{ color: token.colorPrimary }} />}
                suffix='条'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='预报数据总量'
                value={predictionDataCount}
                prefix={<CloudOutlined style={{ color: token.colorSuccess }} />}
                suffix='条'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='今日采集'
                value={collectionDataTrend.length > 0 ? (collectionDataTrend[collectionDataTrend.length - 1]?.value ?? 0) : 0}
                prefix={<ThunderboltOutlined style={{ color: token.colorWarning }} />}
                suffix='条'
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title='今日预报'
                value={predictionDataTrend.length > 0 ? (predictionDataTrend[predictionDataTrend.length - 1]?.value ?? 0) : 0}
                prefix={<CloudOutlined style={{ color: token.colorInfo }} />}
                suffix='条'
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* 设备状态 */}
          <Col xs={24} lg={12}>
            <Card title='设备状态' size='small' className='h-full'>
              {stats?.device_status_chart && stats.device_status_chart.length > 0 ? (
                <Space direction='vertical' style={{ width: '100%' }}>
                  {stats.device_status_chart.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{item.name}</span>
                      <div style={{ flex: 1, margin: '0 16px' }}>
                        <Progress
                          percent={
                            stats.total_devices > 0 ? (item.value / stats.total_devices) * 100 : 0
                          }
                          showInfo={false}
                          strokeColor={index === 0 ? token.colorSuccess : token.colorWarning}
                        />
                      </div>
                      <span style={{ fontWeight: 'bold' }}>{item.value}</span>
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty description='暂无数据' />
              )}
            </Card>
          </Col>

          {/* 任务统计 */}
          <Col xs={24} lg={12}>
            <Card title='任务统计' size='small' className='h-full'>
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <Card size='small' style={{ textAlign: 'center' }}>
                    <Statistic
                      title='已完成'
                      value={stats?.completed_tasks || 0}
                      prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size='small' style={{ textAlign: 'center' }}>
                    <Statistic
                      title='运行中'
                      value={stats?.running_tasks || 0}
                      prefix={<SyncOutlined style={{ color: token.colorInfo }} />}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size='small' style={{ textAlign: 'center' }}>
                    <Statistic
                      title='失败'
                      value={stats?.failed_tasks || 0}
                      prefix={<CloseCircleOutlined style={{ color: token.colorError }} />}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* 最近任务 */}
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card
              title='最近任务'
              size='small'
              extra={<a onClick={() => navigate('/admin/tasks')}>查看全部</a>}
            >
              {stats?.recent_tasks && stats.recent_tasks.length > 0 ? (
                <List
                  dataSource={stats.recent_tasks}
                  renderItem={(task) => (
                    <List.Item
                      actions={[
                        <Tag color={getTaskStatusColor(task.status)} key='status'>
                          {getTaskStatusText(task.status)}
                        </Tag>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<a onClick={() => navigate('/admin/tasks')}>{task.name}</a>}
                        description={
                          <Space>
                            <span>设备: {task.device_name}</span>
                            <span>创建时间: {formatToLocal(task.created_at)}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description='暂无任务' />
              )}
            </Card>
          </Col>
        </Row>

        {/* 数据图表 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title='采集数据趋势' size='small'>
              {collectionDataTrend.length > 0 ? (
                <Column
                  data={collectionDataTrend}
                  xField='date'
                  yField='value'
                  height={300}
                  columnStyle={{
                    fill: token.colorPrimary,
                    fillOpacity: 0.8,
                  }}
                  label={{
                    position: 'top',
                    style: {
                      fill: token.colorText,
                      opacity: 0.8,
                    },
                    formatter: (value) => (value ?? 0).toString(),
                  }}
                  meta={{
                    date: { alias: '日期' },
                    value: { alias: '采集数量' },
                  }}
                  tooltip={{
                    formatter: (datum) => {
                      return { name: '采集数量', value: (datum.value ?? 0) + ' 条' }
                    }
                  }}
                />
              ) : (
                <Empty description='暂无采集数据' style={{ padding: '50px 0' }} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title='预报数据趋势' size='small'>
              {predictionDataTrend.length > 0 ? (
                <Column
                  data={predictionDataTrend}
                  xField='date'
                  yField='value'
                  height={300}
                  columnStyle={{
                    fill: token.colorSuccess,
                    fillOpacity: 0.8,
                  }}
                  label={{
                    position: 'top',
                    style: {
                      fill: token.colorText,
                      opacity: 0.8,
                    },
                    formatter: (value) => (value ?? 0).toString(),
                  }}
                  meta={{
                    date: { alias: '日期' },
                    value: { alias: '预报数量' },
                  }}
                  tooltip={{
                    formatter: (datum) => {
                      return { name: '预报数量', value: (datum.value ?? 0) + ' 条' }
                    }
                  }}
                />
              ) : (
                <Empty description='暂无预报数据' style={{ padding: '50px 0' }} />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  )
}

export default Dashboard
