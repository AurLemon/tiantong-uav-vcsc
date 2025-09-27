import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/zh-cn'
import App from './App'
import './assets/styles/styles.less'
import './assets/styles/tailwind.css'
import { GlobalProvider } from '@/contexts/global/GlobalContext'

// 配置 dayjs 时区支持
// 扩展 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('zh-cn')

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={zhCN}>
        <GlobalProvider>
          <App />
        </GlobalProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
)
