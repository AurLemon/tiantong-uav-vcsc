import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  message,
  Popconfirm,
  Space,
  Pagination,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';

import { warningCases } from '@/utils/api';
import type {
  WarningCaseItem,
  WarningCaseQueryParams,
} from '@/utils/api/warning-cases';

const WarningCases: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<WarningCaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 20,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams: WarningCaseQueryParams = {
        page: pagination.current_page,
        page_size: pagination.page_size
      };

      const result = await warningCases.getWarningCaseList(queryParams);
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

  // 获取内容预览标签
  const getContentPreviewTags = (content: any) => {
    if (!content) return <Tag>无数据</Tag>;

    try {
      const tags: React.ReactNode[] = [];

      if (typeof content === 'object' && content !== null) {
        // 提取年月信息
        if (content.yearMonth && Array.isArray(content.yearMonth)) {
          const yearMonths = content.yearMonth.slice(0, 2);
          tags.push(
            <Tag key="time" color="blue">
              时间: {yearMonths.join('~')}{content.yearMonth.length > 2 ? '...' : ''}
            </Tag>
          );
        }

        // 提取第一个风险个例的类型和区域
        if (content.timeRangeDataMap && typeof content.timeRangeDataMap === 'object') {
          const firstRange = Object.values(content.timeRangeDataMap)[0] as any;
          if (firstRange?.detail) {
            const detail = firstRange.detail;
            if (detail.type) {
              tags.push(
                <Tag key="type" color={detail.type === '大风' ? 'red' : detail.type === '暴雨' ? 'cyan' : 'green'}>
                  {detail.type}
                </Tag>
              );
            }
            if (detail.region) {
              const regions = detail.region.split('、').slice(0, 2);
              tags.push(
                <Tag key="region" color="orange">
                  {regions.join('、')}{detail.region.split('、').length > 2 ? '...' : ''}
                </Tag>
              );
            }
          }

          const rangeCount = Object.keys(content.timeRangeDataMap).length;
          tags.push(
            <Tag key="count" color="purple">
              {rangeCount}个个例
            </Tag>
          );
        }

        // 提取时间数据映射数量
        if (content.timeDataMap && typeof content.timeDataMap === 'object') {
          const timeCount = Object.keys(content.timeDataMap).length;
          tags.push(
            <Tag key="data-count" color="geekblue">
              {timeCount}个时间点
            </Tag>
          );
        }
      }

      return tags.length > 0 ? <Space wrap>{tags}</Space> : <Tag>数据格式异常</Tag>;
    } catch (error) {
      return <Tag color="red">解析失败</Tag>;
    }
  };

  // 表格列定义
  const columns: ColumnsType<WarningCaseItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '内容概览',
      dataIndex: 'content',
      key: 'content',
      render: (content) => (
        <div style={{ maxWidth: 400 }}>
          {getContentPreviewTags(content)}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => navigate(`/admin/warning-cases/${record.id}?mode=view`)}
          >
            查看
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={() => navigate(`/admin/warning-cases/${record.id}?mode=edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条风险个例吗？"
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
      await warningCases.deleteWarningCase(id);
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

  useEffect(() => {
    loadData();
  }, [pagination.current_page, pagination.page_size]);

  return (
    <PageContainer
      header={{
        title: '风险个例管理',
        extra: [
          <Button
            key="1"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/warning-cases/new')}
          >
            新增风险个例
          </Button>,
        ],
      }}
    >
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
    </PageContainer>
  );
};

export default WarningCases;
