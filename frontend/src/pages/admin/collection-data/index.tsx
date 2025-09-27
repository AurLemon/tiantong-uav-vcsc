import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Popconfirm,
  Space,
  Card,
  Row,
  Col,
  Image,
  Pagination,
  message,
  Select
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';

import { renderTableTime } from '@/utils/time';

import {
  collectionData,
  weatherCondition,
  device as deviceApi,
} from '@/utils/api';
import type {
  CollectionDataItem,
  CollectionDataQueryParams
} from '@/utils/api/collection-data';
import type { WeatherCondition } from '@/utils/api/weather-condition';
import type { Device } from '@/utils/api/device';

const { Option } = Select;

const CollectionData: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CollectionDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 20,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });
  const [filters, setFilters] = useState<CollectionDataQueryParams>({
    device_id: undefined,
    weather_condition_id: undefined
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams: CollectionDataQueryParams = {
        page: pagination.current_page,
        page_size: pagination.page_size,
        ...filters
      };

      const result = await collectionData.getCollectionDataList(queryParams);
      setData(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || {
        current_page: 1,
        page_size: 20,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      });
    } catch (error) {
      console.error('Error loading data:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载设备列表
  const loadDevices = async () => {
    try {
      const result = await deviceApi.getDevices();
      setDevices(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  // 加载天气情况列表
  const loadWeatherConditions = async () => {
    try {
      const result = await weatherCondition.getAllWeatherConditions();
      setWeatherConditions(result);
    } catch (error) {
      console.error('Error loading weather conditions:', error);
    }
  };

  // 表格列定义
  const columns: ColumnsType<CollectionDataItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '经度',
      dataIndex: 'longitude',
      key: 'longitude',
      width: 120,
    },
    {
      title: '纬度',
      dataIndex: 'latitude',
      key: 'latitude',
      width: 120,
    },
    {
      title: '高度(m)',
      dataIndex: 'altitude',
      key: 'altitude',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '温度(°C)',
      dataIndex: 'temperature',
      key: 'temperature',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '湿度(%)',
      dataIndex: 'humidity',
      key: 'humidity',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '设备',
      dataIndex: 'device_name',
      key: 'device_name',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '天气情况',
      dataIndex: 'weather_condition_name',
      key: 'weather_condition_name',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '图片',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 100,
      render: (url) => url ? (
        <Image
          src={url}
          width={60}
          height={40}
          style={{ objectFit: 'cover' }}
        />
      ) : '-',
    },
    {
      title: '采集时间',
      dataIndex: 'collected_at',
      key: 'collected_at',
      width: 160,
      render: (value) => renderTableTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/collection-data/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条采集数据吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await collectionData.deleteCollectionData(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      message.error('删除失败');
    }
  };

  // 分页处理
  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({
      ...prev,
      current_page: page,
      page_size: pageSize
    }));
  };

  // 重置过滤器
  const resetFilters = () => {
    setFilters({
      device_id: undefined,
      weather_condition_id: undefined
    });
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  useEffect(() => {
    loadData();
  }, [pagination.current_page, pagination.page_size, filters]);

  useEffect(() => {
    loadDevices();
    loadWeatherConditions();
  }, []);

  return (
    <PageContainer
      header={{
        title: '采集数据',
        extra: [
          <Button
            key="1"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/collection-data/new')}
          >
            新增采集数据
          </Button>,
        ],
      }}
    >
      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Select
              placeholder="选择设备"
              value={filters.device_id}
              onChange={(value) => setFilters(prev => ({ ...prev, device_id: value }))}
              allowClear
              style={{ width: '100%' }}
            >
              {devices.map(device => (
                <Option key={device.id} value={device.id}>
                  {device.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择天气情况"
              value={filters.weather_condition_id}
              onChange={(value) => setFilters(prev => ({ ...prev, weather_condition_id: value }))}
              allowClear
              style={{ width: '100%' }}
            >
              {weatherConditions.map(weather => (
                <Option key={weather.id} value={weather.id}>
                  {weather.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Space>
              <Button type="primary" onClick={loadData}>
                搜索
              </Button>
              <Button onClick={resetFilters}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1200 }}
      />

      {/* 分页 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <Pagination
          current={pagination.current_page}
          pageSize={pagination.page_size}
          total={pagination.total_items}
          showSizeChanger
          showQuickJumper
          showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`}
          onChange={handlePaginationChange}
          onShowSizeChange={handlePaginationChange}
        />
      </div>
    </PageContainer>
  );
};

export default CollectionData;
