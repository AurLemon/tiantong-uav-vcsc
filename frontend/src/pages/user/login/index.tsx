import { Footer } from '@/components'
import { emailLogin, login, passwordLogin } from '@/utils/api/api'
import { getFakeCaptcha } from '@/utils/api/login'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { LoginForm, ProFormCaptcha, ProFormCheckbox, ProFormText } from '@ant-design/pro-components'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useModel } from '@/contexts/global/GlobalContext'
import { Helmet } from 'react-helmet-async'
import { Alert, message, Tabs } from 'antd'
import Settings from '../../../../config/settings'
import React, { useState } from 'react'
import { flushSync } from 'react-dom'
import { createStyles } from 'antd-style'

import bgImage from '@/assets/resources/bg.png'
import logoSvg from '@/assets/resources/logo.svg'

const useStyles = createStyles(({ token }) => {
  return {
    action: {
      marginLeft: '8px',
      color: 'rgba(0, 0, 0, 0.2)',
      fontSize: '24px',
      verticalAlign: 'middle',
      cursor: 'pointer',
      transition: 'color 0.3s',
      '&:hover': {
        color: token.colorPrimaryActive,
      },
    },
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage: `url(${bgImage})`,
      backgroundSize: '100% 100%',
    },
  }
})

const LoginMessage: React.FC<{
  content: string
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type='error'
      showIcon
    />
  )
}

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({})
  const [type, setType] = useState<string>('account')
  const { initialState, setInitialState } = useModel('@@initialState')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { styles } = useStyles()

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.()
    if (userInfo) {
      flushSync(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }))
      })
    }
  }

  const handleEmailLogin = async (values: API.EmailLoginParams) => {
    try {
      const response = await emailLogin({ ...values })
      const msg = response.data
      if (msg?.success) {
        const defaultLoginSuccessMessage = msg.message || '登录成功！'
        message.success(defaultLoginSuccessMessage)
        return
      }
      console.log(msg)
    } catch (error) {
      const defaultLoginFailureMessage = '登录失败，请重试！'
      console.log(error)
      message.error(defaultLoginFailureMessage)
    }
  }
  const handleAccountLogin = async (values: API.LoginParams) => {
    try {
      const response = await passwordLogin({ email: values.username, password: values.password })
      const msg = (response as any)?.data || response
      
      if (msg?.token) {
        localStorage.setItem('auth_token', msg.token)
        const defaultLoginSuccessMessage = '登录成功！'
        message.success(defaultLoginSuccessMessage)
        
        // 获取用户信息
        try {
          await fetchUserInfo()
        } catch (fetchError) {
          console.warn('获取用户信息失败:', fetchError)
          // 即使获取用户信息失败，也继续跳转
        }
        
        const urlParams = new URL(window.location.href).searchParams
        navigate(urlParams.get('redirect') || '/')
        return
      }
      
      // 登录失败的情况
      console.log('登录响应:', msg)
      const errorMessage = '登录失败，请检查用户名和密码！'
      message.error(errorMessage)
      setUserLoginState({ status: 'error' })
    } catch (error) {
      const defaultLoginFailureMessage = '登录失败，请重试！'
      console.log('登录错误:', error)
      message.error(defaultLoginFailureMessage)
    }
  }
  const { status, type: loginType } = userLoginState

  const setLoginToken = async () => {
    const t = searchParams.get('t')
    if (t && t.length > 0) {
      localStorage.setItem('auth_token', t)
      await fetchUserInfo()
      navigate('/')
      return
    }
  }

  setLoginToken()

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {'登录页'}
          {(Settings as any).site?.theme?.title ? ` - ${(Settings as any).site?.theme?.title}` : ''}
        </title>
      </Helmet>
      <div className='login-container flex flex-col gap-20 m-auto'>
        <LoginForm
          contentStyle={{
            minWidth: 280,
            maxWidth: '75vw',
          }}
          initialValues={{
            autoLogin: true,
          }}
          onFinish={async (values) => {
            if (type === 'email') {
              await handleEmailLogin(values as API.EmailLoginParams)
            } else if (type === 'account') {
              await handleAccountLogin(values as API.LoginParams)
            }
          }}
        >
          <div className='flex justify-center mb-6'>
            <img
              alt='logo'
              src={logoSvg}
              className='w-fit h-14 object-contain select-none'
            />
          </div>
          <Tabs
            activeKey={type}
            onChange={setType}
            centered
            items={[
              {
                key: 'account',
                label: '账户密码登录',
              },
            ]}
          />

          {status === 'error' && loginType === 'account' && (
            <LoginMessage content={'账户或密码错误(admin/ant.design)'} />
          )}
          {type === 'account' && (
            <>
              <ProFormText
                name='username'
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />,
                }}
                placeholder={'请输入用户名'}
                rules={[
                  {
                    required: true,
                    message: '请输入用户名!',
                  },
                ]}
              />
              <ProFormText.Password
                name='password'
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                placeholder={'请输入密码'}
                rules={[
                  {
                    required: true,
                    message: '请输入密码！',
                  },
                ]}
              />
            </>
          )}
        </LoginForm>
        <Footer />
      </div>
    </div>
  )
}

export default Login
