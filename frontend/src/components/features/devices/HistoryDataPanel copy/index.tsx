import React, { useEffect, useState } from 'react'
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, message, Checkbox, Popconfirm } from 'antd'
import { Line } from '@ant-design/plots'
import {
  HistoryOutlined,
  BarChartOutlined,
  TableOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { TabPane } = Tabs
const { Option } = Select

interface HistoryDataPanelProps {
  deviceId: string
  realtimeData?: any
  mqttServices?: any
}

interface HistoryDataEntry {
  id: number
  device_id: number
  data_type: string
  data_content: any
  received_at: string
  created_at: string
  updated_at: string
  todayIs?: string
}

interface ChartDataPoint {
  time: string
  value: number
  type: string
}

export const HistoryDataPanel: React.FC<HistoryDataPanelProps> = ({ deviceId, realtimeData }) => {
  const [historyData, setHistoryData] = useState<HistoryDataEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(['temperature_c', 'humidity', 'velocity'])
  const [temperatureData, setTemperatureData] = useState<ChartDataPoint[]>([])
  const [humidityData, setHumidityData] = useState<ChartDataPoint[]>([])
  const [batteryData, setBatteryData] = useState<ChartDataPoint[]>([])
  const [velocityData, setVelocityData] = useState<ChartDataPoint[]>([])
  const [altitudeData, setAltitudeData] = useState<ChartDataPoint[]>([])
  const [headingData, setHeadingData] = useState<ChartDataPoint[]>([])
  const [manageModalVisible, setManageModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<HistoryDataEntry | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm()

  // 可选择的数据类型
  const availableDataTypes = [
    { key: 'battery', label: '电池电量', unit: '%', color: '#1890ff' },
    { key: 'temperature_c', label: '温度', unit: '°C', color: '#ff4d4f' },
    { key: 'humidity', label: '湿度', unit: '%', color: '#52c41a' },
    { key: 'velocity', label: '风速', unit: 'm/s', color: '#722ed1' },
    { key: 'altitude', label: '高度', unit: 'm', color: '#eb2f96' },
    { key: 'heading', label: '航向角', unit: '°', color: '#13c2c2' },
  ]

  // 分组数据类型
  const temperatureTypes = ['temperature_c']
  const humidityTypes = ['humidity']
  const batteryTypes = ['battery']
  const velocityTypes = ['velocity']
  const altitudeTypes = ['altitude']
  const headingTypes = ['heading']

  // 加载历史数据
  const loadHistoryData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/history?limit=100`)
      if (response.ok) {
        const result = await response.json()
        const historyDataArray = result.data || []
        setHistoryData(historyDataArray)
        processChartData(historyDataArray)
      } else {
        console.error('Failed to load history data: HTTP', response.status)
        setHistoryData([])
        processChartData([])
      }
    } catch (error) {
      console.error('Failed to load history data:', error)
      setHistoryData([])
      processChartData([])
    } finally {
      setLoading(false)
    }
  }

  // 处理图表数据
  const processChartData = (data: HistoryDataEntry[]) => {
    const temperaturePoints: ChartDataPoint[] = []
    const humidityPoints: ChartDataPoint[] = []
    const batteryPoints: ChartDataPoint[] = []
    const velocityPoints: ChartDataPoint[] = []
    const altitudePoints: ChartDataPoint[] = []
    const headingPoints: ChartDataPoint[] = []

    if (!data || !Array.isArray(data)) {
      setTemperatureData([])
      setHumidityData([])
      setBatteryData([])
      setVelocityData([])
      setAltitudeData([])
      setHeadingData([])
      return
    }

    data.forEach(entry => {
      if (!entry || !entry.data_content) {
        return
      }
      
      const time = new Date(entry.received_at).toLocaleTimeString()

      // 处理所有数据类型，不仅仅是选中的
      availableDataTypes.forEach(({ key: dataType }) => {
        let value: number | undefined

        // 安全地访问数据内容
        if (entry.data_type === 'websocket' && entry.data_content && typeof entry.data_content === 'object') {
          const dataValue = entry.data_content[dataType]
          if (dataValue !== undefined && dataValue !== null) {
            value = parseFloat(String(dataValue))
          }
        } else if (entry.data_type === 'mqtt' && entry.data_content && typeof entry.data_content === 'object') {
          const dataValue = entry.data_content[dataType]
          if (dataValue !== undefined && dataValue !== null) {
            value = parseFloat(String(dataValue))
          }
        }

        if (value !== undefined && !isNaN(value)) {
          const typeInfo = availableDataTypes.find(t => t.key === dataType)
          const chartPoint = {
            time,
            value,
            type: typeInfo?.label || dataType
          }

          // 根据数据类型分组到不同的数组
          if (temperatureTypes.includes(dataType)) {
            temperaturePoints.push(chartPoint)
          } else if (humidityTypes.includes(dataType)) {
            humidityPoints.push(chartPoint)
          } else if (batteryTypes.includes(dataType)) {
            batteryPoints.push(chartPoint)
          } else if (velocityTypes.includes(dataType)) {
            velocityPoints.push(chartPoint)
          } else if (altitudeTypes.includes(dataType)) {
            altitudePoints.push(chartPoint)
          } else if (headingTypes.includes(dataType)) {
            headingPoints.push(chartPoint)
          }
        }
      })
    })

    // 保持最多10个时间点，按时间排序
    const allPoints = [...temperaturePoints, ...humidityPoints, ...batteryPoints, ...velocityPoints, ...altitudePoints, ...headingPoints]

    // 按时间排序并获取最近的10个时间点
    const sortedTimes = [...new Set(allPoints.map(p => p.time))]
      .sort((a, b) => {
        // 将时间字符串转换为可比较的格式
        const timeA = new Date(`1970-01-01 ${a}`).getTime()
        const timeB = new Date(`1970-01-01 ${b}`).getTime()
        return timeA - timeB
      })
      .slice(-10)

    setTemperatureData(temperaturePoints.filter(p => sortedTimes.includes(p.time)))
    setHumidityData(humidityPoints.filter(p => sortedTimes.includes(p.time)))
    setBatteryData(batteryPoints.filter(p => sortedTimes.includes(p.time)))
    setVelocityData(velocityPoints.filter(p => sortedTimes.includes(p.time)))
    setAltitudeData(altitudePoints.filter(p => sortedTimes.includes(p.time)))
    setHeadingData(headingPoints.filter(p => sortedTimes.includes(p.time)))
  }

  // 删除选中的记录
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录')
      return
    }

    try {
      const response = await fetch(`/api/realtime/devices/${deviceId}/history/batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedRowKeys }),
      })

      if (response.ok) {
        message.success('删除成功')
        setSelectedRowKeys([])
        loadHistoryData()
      } else {
        message.error('删除失败')
      }
    } catch (error) {
      console.error('Failed to delete records:', error)
      message.error('删除失败')
    }
  }

  // 编辑记录
  const handleEdit = (record: HistoryDataEntry) => {
    setEditingRecord(record)
    form.setFieldsValue({
      data_type: record.data_type,
      data_content: JSON.stringify(record.data_content, null, 2),
    })
    setEditModalVisible(true)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields()
      const dataContent = JSON.parse(values.data_content)

      const response = await fetch(`/api/realtime/devices/${deviceId}/history/${editingRecord?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_type: values.data_type,
          data_content: dataContent,
        }),
      })

      if (response.ok) {
        message.success('保存成功')
        setEditModalVisible(false)
        setEditingRecord(null)
        form.resetFields()
        loadHistoryData()
      } else {
        message.error('保存失败')
      }
    } catch (error) {
      console.error('Failed to save edit:', error)
      message.error('保存失败')
    }
  }

  useEffect(() => {
    loadHistoryData()
  }, [deviceId])

  useEffect(() => {
    processChartData(historyData)
  }, [selectedDataTypes, historyData])

  // 处理实时数据更新
  useEffect(() => {
    if (!realtimeData) return

    // 添加调试信息
    console.log('HistoryDataPanel - 接收到实时数据:', realtimeData)

    // 创建实时数据点
    const now = new Date()
    const time = now.toLocaleTimeString()

    // 分别为每个数据类型创建数据点
    const newTemperaturePoints: ChartDataPoint[] = []
    const newHumidityPoints: ChartDataPoint[] = []
    const newBatteryPoints: ChartDataPoint[] = []
    const newVelocityPoints: ChartDataPoint[] = []
    const newAltitudePoints: ChartDataPoint[] = []
    const newHeadingPoints: ChartDataPoint[] = []

    // 处理所有数据类型，不仅仅是选中的
    availableDataTypes.forEach(({ key: dataType }) => {
      let value: number | undefined

      console.log(`检查${dataType}数据:`, {
        mqtt: realtimeData.mqtt?.[dataType],
        websocket: realtimeData[dataType],
        allKeys: Object.keys(realtimeData)
      })

      // 处理MQTT数据
      if (realtimeData.mqtt && realtimeData.mqtt[dataType] !== undefined) {
        value = parseFloat(String(realtimeData.mqtt[dataType]))
        console.log(`从MQTT获取${dataType}数据:`, value)
      }
      // 处理WebSocket数据
      else if (realtimeData[dataType] !== undefined) {
        value = parseFloat(String(realtimeData[dataType]))
        console.log(`从WebSocket获取${dataType}数据:`, value)
      }

      if (value !== undefined && !isNaN(value)) {
        const typeInfo = availableDataTypes.find(t => t.key === dataType)
        const chartPoint = {
          time,
          value,
          type: typeInfo?.label || dataType
        }

        console.log(`创建图表数据点: ${dataType} = ${value}`)

        // 根据数据类型分组
        if (temperatureTypes.includes(dataType)) {
          newTemperaturePoints.push(chartPoint)
          console.log('添加到温度数据')
        } else if (humidityTypes.includes(dataType)) {
          newHumidityPoints.push(chartPoint)
          console.log('添加到湿度数据')
        } else if (batteryTypes.includes(dataType)) {
          newBatteryPoints.push(chartPoint)
          console.log('添加到电池数据')
        } else if (velocityTypes.includes(dataType)) {
          newVelocityPoints.push(chartPoint)
          console.log('添加到风速数据')
        } else if (altitudeTypes.includes(dataType)) {
          newAltitudePoints.push(chartPoint)
          console.log('添加到高度数据')
        } else if (headingTypes.includes(dataType)) {
          newHeadingPoints.push(chartPoint)
          console.log('添加到航向角数据')
        }
      } else {
        console.log(`${dataType}数据无效: value=${value}, isNaN=${isNaN(value)}`)
      }
    })

    // 更新各个状态
    const updateChartData = (setter: any, newPoints: ChartDataPoint[]) => {
      if (newPoints.length > 0) {
        setter((prev: ChartDataPoint[]) => {
          const combined = [...prev, ...newPoints]

          // 按时间排序并获取最近的10个时间点
          const sortedTimes = [...new Set(combined.map(p => p.time))]
            .sort((a, b) => {
              const timeA = new Date(`1970-01-01 ${a}`).getTime()
              const timeB = new Date(`1970-01-01 ${b}`).getTime()
              return timeA - timeB
            })
            .slice(-10)

          return combined.filter(p => sortedTimes.includes(p.time))
            .sort((a, b) => {
              const timeA = new Date(`1970-01-01 ${a.time}`).getTime()
              const timeB = new Date(`1970-01-01 ${b.time}`).getTime()
              return timeA - timeB
            })
        })
      }
    }

    updateChartData(setTemperatureData, newTemperaturePoints)
    updateChartData(setHumidityData, newHumidityPoints)
    updateChartData(setBatteryData, newBatteryPoints)
    updateChartData(setVelocityData, newVelocityPoints)
    updateChartData(setAltitudeData, newAltitudePoints)
    updateChartData(setHeadingData, newHeadingPoints)
  }, [realtimeData])

  // 表格列定义
  const columns: ColumnsType<HistoryDataEntry> = [
    {
      title: '时间',
      dataIndex: 'received_at',
      key: 'received_at',
      render: (text) => new Date(text).toLocaleString(),
      width: 180,
    },
    {
      title: '数据类型',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 100,
    },
    {
      title: '数据内容',
      dataIndex: 'data_content',
      key: 'data_content',
      render: (content) => (
        <pre style={{ margin: 0, fontSize: '12px', maxWidth: '300px', overflow: 'auto' }}>
          {JSON.stringify(content, null, 2)}
        </pre>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条记录吗？"
            onConfirm={() => handleDeleteSelected()}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 创建图表配置的通用函数
  const createChartConfig = (data: ChartDataPoint[], fixedYAxis?: { min: number; max: number }) => {
    // 获取数据中的所有类型
    const types = Array.from(new Set(data.map(d => d.type)))

    // 为每个类型创建颜色映射
    const colorMap: { [key: string]: string } = {}
    types.forEach(type => {
      const typeInfo = availableDataTypes.find(t => t.label === type)
      colorMap[type] = typeInfo?.color || '#1890ff'
    })

    return {
      data: data.sort((a, b) => {
        // 确保数据按时间正序排列
        const timeA = new Date(`1970-01-01 ${a.time}`).getTime()
        const timeB = new Date(`1970-01-01 ${b.time}`).getTime()
        return timeA - timeB
      }),
      xField: 'time',
      yField: 'value',
      seriesField: 'type',
      smooth: true,
      color: types.map(type => colorMap[type]),
      legend: {
        position: 'bottom' as const,
      },
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
      xAxis: {
        type: 'cat',
        tickCount: 5,
      },
      yAxis: fixedYAxis ? {
        min: fixedYAxis.min,
        max: fixedYAxis.max,
      } : undefined,
    }
  }

  // 各个图表配置
  const temperatureChartConfig = createChartConfig(temperatureData, { min: 0, max: 100 })
  const humidityChartConfig = createChartConfig(humidityData, { min: 0, max: 100 })
  const batteryChartConfig = createChartConfig(batteryData)
  const velocityChartConfig = createChartConfig(velocityData)
  const altitudeChartConfig = createChartConfig(altitudeData)
  const headingChartConfig = createChartConfig(headingData)

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined />
          历史数据
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setManageModalVisible(true)}
          >
            管理历史记录
          </Button>
          <Button onClick={loadHistoryData} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={viewMode}
        onChange={(key) => setViewMode(key as 'chart' | 'table')}
        items={[
          {
            key: 'chart',
            label: (
              <span>
                <BarChartOutlined />
                折线图
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ marginRight: 8 }}>显示数据：</span>
                  <Checkbox.Group
                    options={availableDataTypes.map(type => ({
                      label: type.label,
                      value: type.key,
                    }))}
                    value={selectedDataTypes}
                    onChange={setSelectedDataTypes}
                  />
                </div>

                {/* 温度图表 */}
                {selectedDataTypes.includes('temperature_c') && temperatureData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>温度数据</h4>
                    <div style={{ height: 300 }}>
                      <Line {...temperatureChartConfig} />
                    </div>
                  </div>
                )}

                {/* 湿度图表 */}
                {selectedDataTypes.includes('humidity') && humidityData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>湿度数据</h4>
                    <div style={{ height: 300 }}>
                      <Line {...humidityChartConfig} />
                    </div>
                  </div>
                )}

                {/* 电池电量图表 */}
                {selectedDataTypes.includes('battery') && batteryData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>电池电量</h4>
                    <div style={{ height: 300 }}>
                      <Line {...batteryChartConfig} />
                    </div>
                  </div>
                )}

                {/* 风速图表 */}
                {selectedDataTypes.includes('velocity') && velocityData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>风速数据</h4>
                    <div style={{ height: 300 }}>
                      <Line {...velocityChartConfig} />
                    </div>
                  </div>
                )}

                {/* 高度图表 */}
                {selectedDataTypes.includes('altitude') && altitudeData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>高度数据</h4>
                    <div style={{ height: 300 }}>
                      <Line {...altitudeChartConfig} />
                    </div>
                  </div>
                )}

                {/* 航向角图表 */}
                {selectedDataTypes.includes('heading') && headingData.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginBottom: 16 }}>航向角数据</h4>
                    <div style={{ height: 300 }}>
                      <Line {...headingChartConfig} />
                    </div>
                  </div>
                )}

                {/* 无数据提示 */}
                {selectedDataTypes.length === 0 && (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    请选择要显示的数据类型
                  </div>
                )}

                {selectedDataTypes.length > 0 &&
                 temperatureData.length === 0 &&
                 humidityData.length === 0 &&
                 batteryData.length === 0 &&
                 velocityData.length === 0 &&
                 altitudeData.length === 0 &&
                 headingData.length === 0 && (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    暂无图表数据
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'table',
            label: (
              <span>
                <TableOutlined />
                表格
              </span>
            ),
            children: (
              <Table
                columns={columns}
                dataSource={historyData}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 30,
                  showSizeChanger: false,
                  showQuickJumper: true,
                }}
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }}
                scroll={{ x: 800 }}
              />
            ),
          },
        ]}
      />

      {/* 管理历史记录模态框 */}
      <Modal
        title="管理历史记录"
        open={manageModalVisible}
        onCancel={() => setManageModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setManageModalVisible(false)}>
            关闭
          </Button>,
          <Popconfirm
            key="delete"
            title={`确定删除选中的 ${selectedRowKeys.length} 条记录吗？`}
            onConfirm={handleDeleteSelected}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button type="primary" danger disabled={selectedRowKeys.length === 0}>
              批量删除 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>,
        ]}
      >
        <Table
          columns={columns.slice(0, -1)} // 移除操作列
          dataSource={historyData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 600, y: 400 }}
        />
      </Modal>

      {/* 编辑记录模态框 */}
      <Modal
        title="编辑历史记录"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingRecord(null)
          form.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="数据类型"
            name="data_type"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select>
              <Option value="websocket">WebSocket</Option>
              <Option value="mqtt">MQTT</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="数据内容 (JSON格式)"
            name="data_content"
            rules={[
              { required: true, message: '请输入数据内容' },
              {
                validator: (_, value) => {
                  try {
                    JSON.parse(value)
                    return Promise.resolve()
                  } catch {
                    return Promise.reject(new Error('请输入有效的JSON格式'))
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default HistoryDataPanel
