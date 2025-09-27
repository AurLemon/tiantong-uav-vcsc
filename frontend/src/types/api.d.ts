// API 命名空间类型定义
declare namespace API {
  // 登录相关类型
  interface LoginResult {
    status?: string;
    type?: string;
    currentAuthority?: string;
    token?: string;
    message?: string;
    success?: boolean;
  }

  interface LoginParams {
    username?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  }

  interface EmailLoginParams {
    email?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  }

  interface PasswordLoginParams {
    email?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  }

  // 通用响应类型
  interface Response {
    success?: boolean;
    message?: string;
    token?: string;
    data?: any;
  }

  // 用户相关类型
  interface CurrentUser {
    name?: string;
    avatar?: string;
    userid?: string;
    email?: string;
    signature?: string;
    title?: string;
    group?: string;
    tags?: { key?: string; label?: string }[];
    notifyCount?: number;
    unreadCount?: number;
    country?: string;
    access?: string;
    geographic?: {
      province?: { label?: string; key?: string };
      city?: { label?: string; key?: string };
    };
    address?: string;
    phone?: string;
  }

  // 通知相关类型
  interface NoticeIconList {
    data?: NoticeIconItem[];
    total?: number;
    success?: boolean;
  }

  interface NoticeIconItem {
    id?: string;
    extra?: string;
    key?: string;
    read?: boolean;
    avatar?: string;
    title?: string;
    status?: string;
    datetime?: string;
    description?: string;
    type?: NoticeIconItemType;
  }

  type NoticeIconItemType = 'notification' | 'message' | 'event';

  // 规则相关类型
  interface RuleList {
    data?: RuleListItem[];
    total?: number;
    success?: boolean;
  }

  interface RuleListItem {
    key?: number;
    disabled?: boolean;
    href?: string;
    avatar?: string;
    name?: string;
    owner?: string;
    desc?: string;
    callNo?: number;
    status?: number;
    updatedAt?: string;
    createdAt?: string;
    progress?: number;
  }

  // 验证码相关类型
  interface FakeCaptcha {
    code?: number;
    status?: string;
  }

  // 绘图相关类型
  interface DrawingList {
    id?: string;
    name?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  }

  interface DrawingView {
    id?: string;
    name?: string;
    content?: string;
    metadata?: any;
  }

  interface DrawingDimension {
    id?: string;
    drawingId?: string;
    dimension?: string;
    value?: number;
    unit?: string;
  }
}