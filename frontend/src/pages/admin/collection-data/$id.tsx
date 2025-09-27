import React, { useState, useEffect } from 'react';
import {
  PageContainer,
} from '@ant-design/pro-components';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  message,
  Button,
  Space,
  Card,
  Row,
  Col,
  Spin,
  Image
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { parseToLocal, toUTC } from '@/utils/time';
import {
  collectionData,
  weatherCondition,
  device as deviceApi,
  upload as uploadApi
} from '@/utils/api';
import type {
  CollectionDataItem,
  UpdateCollectionDataParams,
} from '@/utils/api/collection-data';
import type { WeatherCondition } from '@/utils/api/weather-condition';
import type { Device } from '@/utils/api/device';
import type { UploadProps } from 'antd/es/upload';

const { Option } = Select;

const CollectionDataEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<CollectionDataItem | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        // @ts-ignore
        const [itemData, devicesData, weatherData] = await Promise.all([
          collectionData.getCollectionData(parseInt(id, 10)),
          deviceApi.getDevices(),
          weatherCondition.getAllWeatherConditions(),
        ]);

        setItem(itemData);
        setDevices(devicesData);
        setWeatherConditions(weatherData);

        form.setFieldsValue({
          ...itemData,
          collected_at: parseToLocal(itemData.collected_at),
        });
      } catch (error) {
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!id) return;

      const submitData: UpdateCollectionDataParams = {
        longitude: parseFloat(values.longitude),
        latitude: parseFloat(values.latitude),
        altitude: values.altitude ? parseFloat(values.altitude) : undefined,
        temperature: values.temperature ? parseFloat(values.temperature) : undefined,
        humidity: values.humidity ? parseFloat(values.humidity) : undefined,
        device_id: values.device_id,
        image_url: values.image_url,
        weather_condition_id: values.weather_condition_id,
        collected_at: toUTC(values.collected_at),
      };

      await collectionData.updateCollectionData(parseInt(id, 10), submitData);
      message.success('更新成功');
      navigate('/admin/collection-data');
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error('操作失败');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const result = await uploadApi.uploadImage(file as File);
        form.setFieldsValue({ image_url: result.url });
        message.success('图片上传成功');
        onSuccess?.(result);
      } catch (error) {
        console.error('Upload error:', error);
        message.error('图片上传失败');
        onError?.(error as Error);
      }
    },
    beforeUpload(file) {
      const isImage = file.type.startsWith('image/');
      const isLt10M = file.size / 1024 / 1024 < 10;

      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB!');
        return false;
      }
      return true;
    },
  };

  if (loading) {
    return <Spin style={{ display: 'block', marginTop: '50px' }} />;
  }

  return (
    <PageContainer
      header={{
        title: `编辑采集数据 #${item?.id}`,
        breadcrumb: {
          items: [
            {
              title: '采集数据管理',
              onClick: () => navigate('/admin/collection-data'),
            },
            {
              title: '编辑',
            },
          ],
        },
      }}
    >
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="经度"
                name="longitude"
                rules={[
                  { required: true, message: '请输入经度' },
                  { pattern: /^-?((1[0-7]\d)|([1-9]?\d))(\.\d+)?$/, message: '请输入有效的经度' }
                ]}
              >
                <Input placeholder="请输入经度" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="纬度"
                name="latitude"
                rules={[
                  { required: true, message: '请输入纬度' },
                  { pattern: /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)$/, message: '请输入有效的纬度' }
                ]}
              >
                <Input placeholder="请输入纬度" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="高度(米)" name="altitude">
                <Input placeholder="请输入高度" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="温度(°C)" name="temperature">
                <Input placeholder="请输入温度" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="湿度(%)" name="humidity">
                <Input placeholder="请输入湿度" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备" name="device_id">
                <Select placeholder="选择设备">
                  {devices.map(device => (
                    <Option key={device.id} value={device.id}>
                      {device.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="天气情况" name="weather_condition_id">
            <Select placeholder="选择天气情况">
              {weatherConditions.map(weather => (
                <Option key={weather.id} value={weather.id}>
                  {weather.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="图片"
            name="image_url"
          >
            <Space direction="vertical">
              <Upload {...uploadProps} listType="picture-card" maxCount={1} showUploadList={false}>
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              </Upload>
              {form.getFieldValue('image_url') && (
                <Image src={form.getFieldValue('image_url')} width={102} height={102} />
              )}
            </Space>
          </Form.Item>
          <Form.Item label="采集时间" name="collected_at">
            <DatePicker
              showTime
              placeholder="选择采集时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => navigate('/admin/collection-data')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  );
};

export default CollectionDataEdit;