import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Spin,
  Tabs,
  Descriptions,
  Tag,
  Table,
  Empty,
  Modal,
  Space,
  Collapse,
  Typography,
  InputNumber,
  Select,
  DatePicker,
  Row,
  Col,
  Divider,
  Radio,
  TimePicker
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { EditOutlined, EyeOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { warningCases } from '@/utils/api';
import type {
  WarningCaseItem,
  CreateWarningCaseParams,
  UpdateWarningCaseParams,
  ParsedContent
} from '@/utils/api/warning-cases';

const { TextArea } = Input;
const { Title, Text } = Typography;

// 定义数据类型
interface WeatherData {
  rain: number;
  temperature: number;
  visibility: number;
  wet: number;
  wind: number;
  wind_direct: number;
}

interface TimeRangeDetail {
  name: string;
  region: string;
  remark: string;
  thunderWarningCount: number;
  time: string;
  type: string;
  visWarningCount: number;
  windWarningCount: number;
}

interface TimeRangeData {
  detail: TimeRangeDetail;
  timeList: string[];
}

const WarningCaseEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'edit'; // 'view', 'edit', 'create'

  const [form] = Form.useForm();
  const [jsonForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<WarningCaseItem | null>(null);
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [activeTab, setActiveTab] = useState(mode === 'view' ? 'parsed' : 'form');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [editForm] = Form.useForm();

  // 风险个例类型
  const [caseType, setCaseType] = useState<'weather' | 'marine'>('weather');

  // 动态数据
  const [weatherDataList, setWeatherDataList] = useState<any[]>([]);
  const [timeRangeList, setTimeRangeList] = useState<any[]>([]);

  // 分页状态
  const [weatherPagination, setWeatherPagination] = useState({ current: 1, pageSize: 10 });
  const [timeRangePagination, setTimeRangePagination] = useState({ current: 1, pageSize: 5 });

  const isNew = id === 'new';

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      Promise.all([
        warningCases.getWarningCase(Number(id)),
        warningCases.parseWarningCaseContent(Number(id))
      ]).then(([itemData, parsedData]) => {
        setItem(itemData);
        setParsedContent(parsedData);

        // 如果有内容，解析并填充表单
        if (itemData.content) {
          const content = itemData.content;

          // 设置基本信息
          form.setFieldsValue({
            yearMonth: content.yearMonth || [],
            caseType: content.timeRangeDataMap ? 'weather' : 'marine'
          });

          // 设置JSON表单
          jsonForm.setFieldsValue({
            contentText: JSON.stringify(content, null, 2)
          });

          // 设置气象数据
          if (content.timeDataMap) {
            const weatherData: any[] = [];
            Object.entries(content.timeDataMap).forEach(([time, regionData]: [string, any]) => {
              Object.entries(regionData).forEach(([region, data]: [string, any]) => {
                weatherData.push({
                  key: `${time}-${region}`,
                  time,
                  region,
                  ...data
                });
              });
            });
            setWeatherDataList(weatherData);
          }

          // 设置时间范围数据
          if (content.timeRangeDataMap) {
            const timeRanges = Object.entries(content.timeRangeDataMap).map(([range, data]: [string, any]) => ({
              key: range,
              range,
              ...data.detail,
              timeList: data.timeList
            }));
            setTimeRangeList(timeRanges);
          }

          // 设置风险个例类型
          if (content.timeRangeDataMap) {
            setCaseType('weather');
          }
        }
      }).catch(error => {
        console.error('Error loading warning case:', error);
        message.error('加载风险个例失败');
      }).finally(() => {
        setLoading(false);
      });
    } else if (isNew) {
      // 新增时的默认值
      form.setFieldsValue({
        yearMonth: [dayjs().format('YYYY-MM')],
        caseType: 'weather'
      });
      jsonForm.setFieldsValue({
        contentText: JSON.stringify({
          yearMonth: [dayjs().format('YYYY-MM')],
          timeDataMap: {},
          timeRangeDataMap: {},
          timeRangeList: []
        }, null, 2)
      });
      setWeatherDataList([]);
      setTimeRangeList([]);
    }
  }, [id, isNew, form]);

  // 表单提交处理
  const handleSubmit = async (values: any) => {
    try {
      // 构建JSON数据结构
      const content: any = {
        yearMonth: values.yearMonth || [],
        timeDataMap: {},
        timeRangeDataMap: {},
        timeRangeList: [],
      };

      // 构建时间数据映射
      weatherDataList.forEach(item => {
        if (!content.timeDataMap[item.time]) {
          content.timeDataMap[item.time] = {};
        }
        content.timeDataMap[item.time][item.region] = {
          rain: item.rain,
          temperature: item.temperature,
          visibility: item.visibility,
          wet: item.wet,
          wind: item.wind,
          wind_direct: item.wind_direct
        };
      });

      // 构建时间范围数据映射
      timeRangeList.forEach(item => {
        content.timeRangeDataMap[item.range] = {
          detail: {
            name: item.name,
            region: item.region,
            remark: item.remark,
            thunderWarningCount: item.thunderWarningCount,
            time: item.range,
            type: item.type,
            visWarningCount: item.visWarningCount,
            windWarningCount: item.windWarningCount
          },
          timeList: item.timeList || []
        };
      });

      // 构建时间范围列表
      const timeRangeGroups: { [key: string]: string[] } = {};
      timeRangeList.forEach(item => {
        const yearMonth = item.range.substring(0, 7); // 提取年月
        if (!timeRangeGroups[yearMonth]) {
          timeRangeGroups[yearMonth] = [];
        }
        timeRangeGroups[yearMonth].push(item.range);
      });
      content.timeRangeList = Object.values(timeRangeGroups);

      const submitData: CreateWarningCaseParams | UpdateWarningCaseParams = { content };

      if (isNew) {
        await warningCases.createWarningCase(submitData as CreateWarningCaseParams);
        message.success('创建成功');
      } else if (id) {
        await warningCases.updateWarningCase(Number(id), submitData);
        message.success('更新成功');
      }
      navigate('/admin/warning-cases');
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error('操作失败');
    }
  };

  // 添加气象数据
  const addWeatherData = () => {
    const newData = {
      key: `new-${Date.now()}`,
      time: dayjs().format('YYYY-MM-DD HH:mm'),
      region: '',
      rain: 0,
      temperature: 0,
      visibility: 0,
      wet: 0,
      wind: 0,
      wind_direct: 0
    };
    setWeatherDataList([...weatherDataList, newData]);
  };

  // 删除气象数据
  const removeWeatherData = (key: string) => {
    setWeatherDataList(weatherDataList.filter(item => item.key !== key));
  };

  // 更新气象数据
  const updateWeatherData = (key: string, field: string, value: any) => {
    setWeatherDataList(weatherDataList.map(item =>
      item.key === key ? { ...item, [field]: value } : item
    ));
  };

  // 添加时间范围数据
  const addTimeRangeData = () => {
    const newData = {
      key: `new-${Date.now()}`,
      range: '',
      name: '',
      region: '',
      type: '大风',
      remark: '',
      thunderWarningCount: 0,
      visWarningCount: 0,
      windWarningCount: 0,
      timeList: []
    };
    setTimeRangeList([...timeRangeList, newData]);
  };

  // 删除时间范围数据
  const removeTimeRangeData = (key: string) => {
    setTimeRangeList(timeRangeList.filter(item => item.key !== key));
  };

  // 更新时间范围数据
  const updateTimeRangeData = (key: string, field: string, value: any) => {
    setTimeRangeList(timeRangeList.map(item =>
      item.key === key ? { ...item, [field]: value } : item
    ));
  };

  // 格式化时间数据映射为表格数据
  const formatTimeDataForTable = (timeDataMap: Record<string, Record<string, WeatherData>>) => {
    if (!timeDataMap) return [];

    const result: any[] = [];
    Object.entries(timeDataMap).forEach(([time, regionData]) => {
      Object.entries(regionData).forEach(([region, data]) => {
        result.push({
          key: `${time}-${region}`,
          time,
          region,
          ...data
        });
      });
    });
    return result;
  };

  // 格式化时间范围数据映射为表格数据
  const formatTimeRangeDataForTable = (timeRangeDataMap: Record<string, TimeRangeData>) => {
    if (!timeRangeDataMap) return [];

    return Object.entries(timeRangeDataMap).map(([range, data]) => ({
      key: range,
      range,
      ...data.detail,
      timeListStr: data.timeList.join(', ')
    }));
  };

  // 处理编辑数据
  const handleEditData = (record: any, type: 'weather' | 'timeRange') => {
    setEditingData({ ...record, type });
    if (type === 'weather') {
      editForm.setFieldsValue({
        rain: record.rain,
        temperature: record.temperature,
        visibility: record.visibility,
        wet: record.wet,
        wind: record.wind,
        wind_direct: record.wind_direct
      });
    } else {
      editForm.setFieldsValue({
        name: record.name,
        region: record.region,
        remark: record.remark,
        thunderWarningCount: record.thunderWarningCount,
        type: record.type,
        visWarningCount: record.visWarningCount,
        windWarningCount: record.windWarningCount
      });
    }
    setEditModalVisible(true);
  };

  // 保存编辑的数据
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();

      if (!item?.content) return;

      const updatedContent = { ...item.content };

      if (editingData.type === 'weather') {
        // 更新气象数据
        if (!updatedContent.timeDataMap) updatedContent.timeDataMap = {};
        if (!updatedContent.timeDataMap[editingData.time]) {
          updatedContent.timeDataMap[editingData.time] = {};
        }
        updatedContent.timeDataMap[editingData.time][editingData.region] = {
          rain: values.rain,
          temperature: values.temperature,
          visibility: values.visibility,
          wet: values.wet,
          wind: values.wind,
          wind_direct: values.wind_direct
        };
      } else {
        // 更新时间范围数据
        if (!updatedContent.timeRangeDataMap) updatedContent.timeRangeDataMap = {};
        if (updatedContent.timeRangeDataMap[editingData.range]) {
          updatedContent.timeRangeDataMap[editingData.range].detail = {
            ...updatedContent.timeRangeDataMap[editingData.range].detail,
            name: values.name,
            region: values.region,
            remark: values.remark,
            thunderWarningCount: values.thunderWarningCount,
            type: values.type,
            visWarningCount: values.visWarningCount,
            windWarningCount: values.windWarningCount
          };
        }
      }

      // 更新到后端
      await warningCases.updateWarningCase(Number(id), { content: updatedContent });

      // 更新本地状态
      setItem({ ...item, content: updatedContent });
      form.setFieldsValue({
        contentText: JSON.stringify(updatedContent, null, 2)
      });

      message.success('数据更新成功');
      setEditModalVisible(false);

      // 重新解析数据
      const parsedData = await warningCases.parseWarningCaseContent(Number(id));
      setParsedContent(parsedData);

    } catch (error) {
      console.error('Error updating data:', error);
      message.error('数据更新失败');
    }
  };

  const getPageTitle = () => {
    if (isNew) return '新增风险个例';
    if (mode === 'view') return '查看风险个例';
    return '编辑风险个例';
  };

  return (
    <PageContainer
      header={{
        title: getPageTitle(),
        breadcrumb: {
          items: [
            {
              title: <a onClick={() => navigate('/admin/warning-cases')}>风险个例管理</a>,
            },
            {
              title: isNew ? '新增' : mode === 'view' ? '查看' : '编辑',
            },
          ],
        },
      }}
    >
      <Card>
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              // 表单编辑标签页
              {
                key: 'form',
                label: isNew ? "新增表单" : "表单编辑",
                children: (
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                {/* 基本信息 */}
                <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="年月信息"
                        name="yearMonth"
                        rules={[{ required: true, message: '请选择年月信息' }]}
                      >
                        <Select
                          mode="tags"
                          placeholder="请选择或输入年月，格式：YYYY-MM"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="风险个例类型"
                        name="caseType"
                        rules={[{ required: true, message: '请选择风险个例类型' }]}
                      >
                        <Radio.Group onChange={(e) => setCaseType(e.target.value)}>
                          <Radio value="weather">气象风险个例</Radio>
                          <Radio value="marine">海洋风险个例</Radio>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 气象数据管理 */}
                <Card
                  title="气象数据管理"
                  size="small"
                  style={{ marginBottom: 16 }}
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={addWeatherData}
                      disabled={mode === 'view'}
                    >
                      添加气象数据
                    </Button>
                  }
                >
                  <Table
                    dataSource={weatherDataList}
                    pagination={{
                      current: weatherPagination.current,
                      pageSize: weatherPagination.pageSize,
                      total: weatherDataList.length,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                      onChange: (page, pageSize) => setWeatherPagination({ current: page, pageSize: pageSize || 10 })
                    }}
                    size="small"
                    scroll={{ x: 1000 }}
                    columns={[
                      {
                        title: '时间',
                        dataIndex: 'time',
                        key: 'time',
                        width: 150,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <DatePicker
                              showTime
                              value={value ? dayjs(value) : null}
                              onChange={(date) => updateWeatherData(record.key, 'time', date?.format('YYYY-MM-DD HH:mm'))}
                              format="YYYY-MM-DD HH:mm"
                              size="small"
                            />
                          )
                        )
                      },
                      {
                        title: '区域',
                        dataIndex: 'region',
                        key: 'region',
                        width: 120,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <Input
                              value={value}
                              onChange={(e) => updateWeatherData(record.key, 'region', e.target.value)}
                              placeholder="请输入区域"
                              size="small"
                            />
                          )
                        )
                      },
                      {
                        title: '降雨量(mm)',
                        dataIndex: 'rain',
                        key: 'rain',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value?.toFixed(1) : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'rain', val)}
                              precision={1}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '温度(°C)',
                        dataIndex: 'temperature',
                        key: 'temperature',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value?.toFixed(1) : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'temperature', val)}
                              precision={1}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '能见度(m)',
                        dataIndex: 'visibility',
                        key: 'visibility',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value?.toFixed(1) : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'visibility', val)}
                              precision={1}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '湿度(%)',
                        dataIndex: 'wet',
                        key: 'wet',
                        width: 80,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'wet', val)}
                              min={0}
                              max={100}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '风速(m/s)',
                        dataIndex: 'wind',
                        key: 'wind',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value?.toFixed(1) : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'wind', val)}
                              precision={1}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '风向(°)',
                        dataIndex: 'wind_direct',
                        key: 'wind_direct',
                        width: 80,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateWeatherData(record.key, 'wind_direct', val)}
                              min={0}
                              max={360}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      ...(mode !== 'view' ? [{
                        title: '操作',
                        key: 'action',
                        width: 80,
                        fixed: 'right' as const,
                        render: (_: any, record: any) => (
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeWeatherData(record.key)}
                          />
                        )
                      }] : [])
                    ]}
                  />
                </Card>

                {/* 风险个例详情管理 */}
                <Card
                  title="风险个例详情管理"
                  size="small"
                  style={{ marginBottom: 16 }}
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={addTimeRangeData}
                      disabled={mode === 'view'}
                    >
                      添加风险个例
                    </Button>
                  }
                >
                  <Table
                    dataSource={timeRangeList}
                    pagination={{
                      current: timeRangePagination.current,
                      pageSize: timeRangePagination.pageSize,
                      total: timeRangeList.length,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                      onChange: (page, pageSize) => setTimeRangePagination({ current: page, pageSize: pageSize || 5 })
                    }}
                    size="small"
                    scroll={{ x: 1200 }}
                    columns={[
                      {
                        title: '时间范围',
                        dataIndex: 'range',
                        key: 'range',
                        width: 200,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <Input
                              value={value}
                              onChange={(e) => updateTimeRangeData(record.key, 'range', e.target.value)}
                              placeholder="如：2024-01-01 10:00~2024-01-01 12:00"
                              size="small"
                            />
                          )
                        )
                      },
                      {
                        title: '名称',
                        dataIndex: 'name',
                        key: 'name',
                        width: 120,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <Input
                              value={value}
                              onChange={(e) => updateTimeRangeData(record.key, 'name', e.target.value)}
                              placeholder="请输入名称"
                              size="small"
                            />
                          )
                        )
                      },
                      {
                        title: '区域',
                        dataIndex: 'region',
                        key: 'region',
                        width: 150,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <Input
                              value={value}
                              onChange={(e) => updateTimeRangeData(record.key, 'region', e.target.value)}
                              placeholder="请输入区域"
                              size="small"
                            />
                          )
                        )
                      },
                      {
                        title: '类型',
                        dataIndex: 'type',
                        key: 'type',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? (
                            <Tag color={value === '大风' ? 'red' : value === '暴雨' ? 'cyan' : 'green'}>
                              {value}
                            </Tag>
                          ) : (
                            <Select
                              value={value}
                              onChange={(val) => updateTimeRangeData(record.key, 'type', val)}
                              size="small"
                              style={{ width: '100%' }}
                            >
                              <Select.Option value="大风">大风</Select.Option>
                              <Select.Option value="暴雨">暴雨</Select.Option>
                              <Select.Option value="雷电">雷电</Select.Option>
                              <Select.Option value="大雾">大雾</Select.Option>
                            </Select>
                          )
                        )
                      },
                      {
                        title: '雷电预警',
                        dataIndex: 'thunderWarningCount',
                        key: 'thunderWarningCount',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateTimeRangeData(record.key, 'thunderWarningCount', val)}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '能见度预警',
                        dataIndex: 'visWarningCount',
                        key: 'visWarningCount',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateTimeRangeData(record.key, 'visWarningCount', val)}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '大风预警',
                        dataIndex: 'windWarningCount',
                        key: 'windWarningCount',
                        width: 100,
                        render: (value, record) => (
                          mode === 'view' ? value : (
                            <InputNumber
                              value={value}
                              onChange={(val) => updateTimeRangeData(record.key, 'windWarningCount', val)}
                              min={0}
                              size="small"
                              style={{ width: '100%' }}
                            />
                          )
                        )
                      },
                      {
                        title: '备注',
                        dataIndex: 'remark',
                        key: 'remark',
                        width: 200,
                        render: (value, record) => (
                          mode === 'view' ? (
                            <div style={{ maxWidth: 200, wordBreak: 'break-all' }}>{value}</div>
                          ) : (
                            <Input.TextArea
                              value={value}
                              onChange={(e) => updateTimeRangeData(record.key, 'remark', e.target.value)}
                              placeholder="请输入备注"
                              size="small"
                              rows={2}
                            />
                          )
                        )
                      },
                      ...(mode !== 'view' ? [{
                        title: '操作',
                        key: 'action',
                        width: 80,
                        fixed: 'right' as const,
                        render: (_: any, record: any) => (
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeTimeRangeData(record.key)}
                          />
                        )
                      }] : [])
                    ]}
                  />
                </Card>

                {/* 提交按钮 */}
                {mode !== 'view' && (
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit">
                        {isNew ? '创建' : '保存'}
                      </Button>
                      <Button onClick={() => navigate('/admin/warning-cases')}>
                        取消
                      </Button>
                    </Space>
                  </Form.Item>
                )}
              </Form>
                )
              },
              // JSON编辑标签页
              {
                key: 'json',
                label: 'JSON编辑',
                children: (
              <Form
                form={jsonForm}
                layout="vertical"
                onFinish={(values) => {
                  try {
                    const content = JSON.parse(values.contentText);
                    const submitData: CreateWarningCaseParams | UpdateWarningCaseParams = { content };

                    if (isNew) {
                      warningCases.createWarningCase(submitData as CreateWarningCaseParams).then(() => {
                        message.success('创建成功');
                        navigate('/admin/warning-cases');
                      });
                    } else if (id) {
                      warningCases.updateWarningCase(Number(id), submitData).then(() => {
                        message.success('更新成功');
                        navigate('/admin/warning-cases');
                      });
                    }
                  } catch (error) {
                    message.error('JSON格式错误');
                  }
                }}
              >
                <Form.Item
                  label="内容 (JSON格式)"
                  name="contentText"
                  rules={[
                    { required: true, message: '请输入内容' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.reject(new Error('请输入内容'));
                        try {
                          JSON.parse(value);
                          return Promise.resolve();
                        } catch (error) {
                          return Promise.reject(new Error('请输入有效的JSON格式'));
                        }
                      }
                    }
                  ]}
                >
                  <TextArea
                    rows={20}
                    placeholder="请输入JSON格式的风险个例内容"
                    disabled={mode === 'view'}
                  />
                </Form.Item>
                {mode !== 'view' && (
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit">
                        {isNew ? '创建' : '保存'}
                      </Button>
                      <Button onClick={() => navigate('/admin/warning-cases')}>
                        取消
                      </Button>
                    </Space>
                  </Form.Item>
                )}
              </Form>
                )
              },
              // 解析数据查看标签页
              ...(isNew ? [] : [{
                key: 'parsed',
                label: '解析数据查看',
                children: (
                  item?.content ? (
                    <div>
                    <Descriptions title="基本信息" column={2} bordered style={{ marginBottom: 20 }}>
                      <Descriptions.Item label="年月信息">
                        {item.content.yearMonth?.map((ym: string) => (
                          <Tag key={ym} style={{ marginRight: 5 }}>
                            {ym}
                          </Tag>
                        ))}
                      </Descriptions.Item>
                    </Descriptions>

                    <Collapse
                      defaultActiveKey={['1']}
                      style={{ marginBottom: 20 }}
                      items={[
                        {
                          key: '1',
                          label: '气象数据详情',
                          children: (
                            <div>
                              <Title level={4}>按时间点的气象数据</Title>
                        <Table
                          dataSource={formatTimeDataForTable(item.content.timeDataMap || {})}
                          columns={[
                            {
                              title: '时间',
                              dataIndex: 'time',
                              key: 'time',
                              width: 150,
                              fixed: 'left'
                            },
                            {
                              title: '区域',
                              dataIndex: 'region',
                              key: 'region',
                              width: 100,
                              fixed: 'left'
                            },
                            {
                              title: '降雨量(mm)',
                              dataIndex: 'rain',
                              key: 'rain',
                              width: 100,
                              render: (value: number) => value?.toFixed(1)
                            },
                            {
                              title: '温度(°C)',
                              dataIndex: 'temperature',
                              key: 'temperature',
                              width: 100,
                              render: (value: number) => value?.toFixed(1)
                            },
                            {
                              title: '能见度(m)',
                              dataIndex: 'visibility',
                              key: 'visibility',
                              width: 100,
                              render: (value: number) => value?.toFixed(1)
                            },
                            {
                              title: '湿度(%)',
                              dataIndex: 'wet',
                              key: 'wet',
                              width: 80
                            },
                            {
                              title: '风速(m/s)',
                              dataIndex: 'wind',
                              key: 'wind',
                              width: 100,
                              render: (value: number) => value?.toFixed(1)
                            },
                            {
                              title: '风向(°)',
                              dataIndex: 'wind_direct',
                              key: 'wind_direct',
                              width: 80
                            },
                            {
                              title: '操作',
                              key: 'action',
                              width: 120,
                              fixed: 'right',
                              render: (_, record) => (
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditData(record, 'weather')}
                                  >
                                    编辑
                                  </Button>
                                </Space>
                              )
                            }
                          ]}
                          pagination={{ pageSize: 10 }}
                          size="small"
                          scroll={{ x: 1000 }}
                        />
                            </div>
                          )
                        }
                      ]}
                    />

                    <Collapse
                      defaultActiveKey={['2']}
                      items={[
                        {
                          key: '2',
                          label: '风险个例详情',
                          children: (
                            <div>
                              <Title level={4}>按时间范围的风险个例数据</Title>
                        <Table
                          dataSource={formatTimeRangeDataForTable(item.content.timeRangeDataMap || {})}
                          columns={[
                            {
                              title: '时间范围',
                              dataIndex: 'range',
                              key: 'range',
                              width: 200,
                              fixed: 'left'
                            },
                            {
                              title: '名称',
                              dataIndex: 'name',
                              key: 'name',
                              width: 120
                            },
                            {
                              title: '区域',
                              dataIndex: 'region',
                              key: 'region',
                              width: 200
                            },
                            {
                              title: '类型',
                              dataIndex: 'type',
                              key: 'type',
                              width: 80,
                              render: (type: string) => (
                                <Tag color={type === '大风' ? 'red' : 'blue'}>{type}</Tag>
                              )
                            },
                            {
                              title: '雷电预警',
                              dataIndex: 'thunderWarningCount',
                              key: 'thunderWarningCount',
                              width: 100
                            },
                            {
                              title: '能见度预警',
                              dataIndex: 'visWarningCount',
                              key: 'visWarningCount',
                              width: 100
                            },
                            {
                              title: '大风预警',
                              dataIndex: 'windWarningCount',
                              key: 'windWarningCount',
                              width: 100
                            },
                            {
                              title: '备注',
                              dataIndex: 'remark',
                              key: 'remark',
                              width: 300,
                              ellipsis: true
                            },
                            {
                              title: '时间点列表',
                              dataIndex: 'timeListStr',
                              key: 'timeListStr',
                              width: 200,
                              ellipsis: true
                            },
                            {
                              title: '操作',
                              key: 'action',
                              width: 120,
                              fixed: 'right',
                              render: (_, record) => (
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditData(record, 'timeRange')}
                                  >
                                    编辑
                                  </Button>
                                </Space>
                              )
                            }
                          ]}
                          pagination={{ pageSize: 5 }}
                          size="small"
                          scroll={{ x: 1400 }}
                        />
                            </div>
                          )
                        }
                      ]}
                    />
                  </div>
                ) : (
                  <Empty description="无解析数据" />
                )
                )
              }])
            ]}
          />
        </Spin>

        {/* 编辑数据模态框 */}
        <Modal
          title={editingData?.type === 'weather' ? '编辑气象数据' : '编辑风险个例详情'}
          open={editModalVisible}
          onOk={handleSaveEdit}
          onCancel={() => setEditModalVisible(false)}
          width={600}
          okText="保存"
          cancelText="取消"
        >
          <Form form={editForm} layout="vertical">
            {editingData?.type === 'weather' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>时间：</Text>{editingData?.time} | <Text strong>区域：</Text>{editingData?.region}
                </div>
                <Form.Item
                  label="降雨量 (mm)"
                  name="rain"
                  rules={[{ required: true, message: '请输入降雨量' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    precision={1}
                    min={0}
                    placeholder="请输入降雨量"
                  />
                </Form.Item>
                <Form.Item
                  label="温度 (°C)"
                  name="temperature"
                  rules={[{ required: true, message: '请输入温度' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    precision={1}
                    placeholder="请输入温度"
                  />
                </Form.Item>
                <Form.Item
                  label="能见度 (m)"
                  name="visibility"
                  rules={[{ required: true, message: '请输入能见度' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    precision={1}
                    min={0}
                    placeholder="请输入能见度"
                  />
                </Form.Item>
                <Form.Item
                  label="湿度 (%)"
                  name="wet"
                  rules={[{ required: true, message: '请输入湿度' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    placeholder="请输入湿度"
                  />
                </Form.Item>
                <Form.Item
                  label="风速 (m/s)"
                  name="wind"
                  rules={[{ required: true, message: '请输入风速' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    precision={1}
                    min={0}
                    placeholder="请输入风速"
                  />
                </Form.Item>
                <Form.Item
                  label="风向 (°)"
                  name="wind_direct"
                  rules={[{ required: true, message: '请输入风向' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={360}
                    placeholder="请输入风向"
                  />
                </Form.Item>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>时间范围：</Text>{editingData?.range}
                </div>
                <Form.Item
                  label="名称"
                  name="name"
                  rules={[{ required: true, message: '请输入名称' }]}
                >
                  <Input placeholder="请输入名称" />
                </Form.Item>
                <Form.Item
                  label="区域"
                  name="region"
                  rules={[{ required: true, message: '请输入区域' }]}
                >
                  <Input placeholder="请输入区域" />
                </Form.Item>
                <Form.Item
                  label="类型"
                  name="type"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select placeholder="请选择类型">
                    <Select.Option value="大风">大风</Select.Option>
                    <Select.Option value="暴雨">暴雨</Select.Option>
                    <Select.Option value="雷电">雷电</Select.Option>
                    <Select.Option value="大雾">大雾</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label="雷电预警次数"
                  name="thunderWarningCount"
                  rules={[{ required: true, message: '请输入雷电预警次数' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    placeholder="请输入雷电预警次数"
                  />
                </Form.Item>
                <Form.Item
                  label="能见度预警次数"
                  name="visWarningCount"
                  rules={[{ required: true, message: '请输入能见度预警次数' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    placeholder="请输入能见度预警次数"
                  />
                </Form.Item>
                <Form.Item
                  label="大风预警次数"
                  name="windWarningCount"
                  rules={[{ required: true, message: '请输入大风预警次数' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    placeholder="请输入大风预警次数"
                  />
                </Form.Item>
                <Form.Item
                  label="备注"
                  name="remark"
                  rules={[{ required: true, message: '请输入备注' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="请输入备注"
                  />
                </Form.Item>
              </>
            )}
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  );
};

export default WarningCaseEdit;