import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Popconfirm,
  Space,
  Card,
  Row,
  Col,
  Pagination,
  message,
  Input,
  Select,
  DatePicker,
  Modal,
  Form
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { renderTableTime, toUTC, parseToLocal } from '@/utils/time';

import { predictionData, elementType } from '@/utils/api';
import type {
  PredictionDataItem,
  PredictionDataQueryParams,
  CreatePredictionDataParams,
  UpdatePredictionDataParams
} from '@/utils/api/prediction-data';
import type { ElementType } from '@/utils/api/element-type';

const { Option } = Select;
const { RangePicker } = DatePicker;

const PredictionData: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PredictionDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [elementTypes, setElementTypes] = useState<ElementType[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 20,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });
  const [filters, setFilters] = useState<PredictionDataQueryParams>({
    region: '',
    tid: undefined,
    start_time: undefined,
    end_time: undefined
  });

  // Dialog 相关状态
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<PredictionDataItem | null>(null);
  const [form] = Form.useForm();

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams: PredictionDataQueryParams = {
        page: pagination.current_page,
        page_size: pagination.page_size,
        ...filters
      };

      const result = await predictionData.getPredictionDataList(queryParams);
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

  // 加载要素类型列表
  const loadElementTypes = async () => {
    try {
      const result = await elementType.getAllElementTypes();
      setElementTypes(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading element types:', error);
    }
  };

  // 表格列定义
  const columns: ColumnsType<PredictionDataItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '要素类型',
      dataIndex: 'element_type_name',
      key: 'element_type_name',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '数值',
      dataIndex: 'v',
      key: 'v',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '预报时间',
      dataIndex: 'tm',
      key: 'tm',
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
          <Button size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条预报数据吗？"
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
      await predictionData.deletePredictionData(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      message.error('删除失败');
    }
  };

  // 处理新增
  const handleCreate = () => {
    setDialogMode('create');
    setEditingItem(null);
    form.resetFields();
    setDialogVisible(true);
  };

  // 处理编辑
  const handleEdit = (item: PredictionDataItem) => {
    setDialogMode('edit');
    setEditingItem(item);
    form.setFieldsValue({
      region: item.region,
      tid: item.tid,
      v: item.v,
      tm: item.tm ? dayjs(parseToLocal(item.tm)) : null,
    });
    setDialogVisible(true);
  };

  // 处理 Dialog 提交
  const handleDialogSubmit = async () => {
    try {
      const values = await form.validateFields();

      const submitData = {
        region: values.region,
        tid: values.tid,
        v: values.v ? parseFloat(values.v) : undefined,
        tm: toUTC(values.tm),
      };

      if (dialogMode === 'create') {
        await predictionData.createPredictionData(submitData as CreatePredictionDataParams);
        message.success('创建成功');
      } else if (editingItem) {
        await predictionData.updatePredictionData(editingItem.id, submitData as UpdatePredictionDataParams);
        message.success('更新成功');
      }

      setDialogVisible(false);
      loadData();
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error('操作失败');
    }
  };

  // 处理 Dialog 取消
  const handleDialogCancel = () => {
    setDialogVisible(false);
    form.resetFields();
    setEditingItem(null);
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
      region: '',
      tid: undefined,
      start_time: undefined,
      end_time: undefined
    });
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  useEffect(() => {
    loadData();
  }, [pagination.current_page, pagination.page_size, filters]);

  useEffect(() => {
    loadElementTypes();
  }, []);

  return (
    <PageContainer
      header={{
        title: '预报数据管理',
        extra: [
          <Button
            key="1"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新增预报数据
          </Button>,
        ],
      }}
    >
      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input
              placeholder="输入区域名称"
              value={filters.region}
              onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择要素类型"
              value={filters.tid}
              onChange={(value) => setFilters(prev => ({ ...prev, tid: value }))}
              allowClear
              style={{ width: '100%' }}
            >
              {elementTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              showTime
              placeholder={['开始时间', '结束时间']}
              onChange={(dates) => {
                if (dates && dates.length === 2) {
                  setFilters(prev => ({
                    ...prev,
                    start_time: toUTC(dates[0]),
                    end_time: toUTC(dates[1])
                  }));
                } else {
                  setFilters(prev => ({
                    ...prev,
                    start_time: undefined,
                    end_time: undefined
                  }));
                }
              }}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
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
        scroll={{ x: 800 }}
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

      {/* 新增/编辑 Dialog */}
      <Modal
        title={dialogMode === 'create' ? '新增预报数据' : '编辑预报数据'}
        open={dialogVisible}
        onOk={handleDialogSubmit}
        onCancel={handleDialogCancel}
        width={600}
        okText={dialogMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="区域"
            name="region"
            rules={[{ required: true, message: '请输入区域名称' }]}
          >
            <Input placeholder="请输入区域名称" />
          </Form.Item>
          <Form.Item
            label="要素类型"
            name="tid"
            rules={[{ required: true, message: '请选择要素类型' }]}
          >
            <Select placeholder="选择要素类型">
              {elementTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="数值"
            name="v"
            rules={[
              { required: true, message: '请输入数值' },
              { pattern: /^-?\d+(\.\d+)?$/, message: '请输入有效的数值' }
            ]}
          >
            <Input placeholder="请输入数值" />
          </Form.Item>
          <Form.Item label="预报时间" name="tm">
            <DatePicker
              showTime
              placeholder="选择预报时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default PredictionData;
