import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 扩展 dayjs 插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 设置默认时区为东八区
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/**
 * 时间本地化工具类
 * 用于处理后端返回的UTC时间转换为东八区时间显示
 */
export class TimeUtils {
  /**
   * 将后端返回的时间字符串转换为东八区时间显示
   * @param timeStr 后端返回的时间字符串（通常是UTC时间或带时区的ISO字符串）
   * @param format 显示格式，默认为 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化后的东八区时间字符串
   */
  static formatToLocal(timeStr: string | null | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    if (!timeStr) return '-';

    try {
      // 如果时间字符串包含 'T' 且以 'Z' 结尾，说明是UTC时间
      if (timeStr.includes('T') && timeStr.endsWith('Z')) {
        // ISO 8601 格式的UTC时间字符串，直接解析并转换到东八区
        return dayjs(timeStr).tz(DEFAULT_TIMEZONE).format(format);
      }

      // 如果时间字符串包含时区偏移信息（+XX:XX 或 -XX:XX）
      if (timeStr.includes('T') && (timeStr.includes('+') || timeStr.lastIndexOf('-') > 10)) {
        // 带时区偏移的ISO时间字符串，直接解析并转换到东八区
        return dayjs(timeStr).tz(DEFAULT_TIMEZONE).format(format);
      }

      // 如果时间字符串包含 'T' 但不包含时区信息，假设是UTC时间
      if (timeStr.includes('T')) {
        // 假设是UTC时间，使用utc()方法解析然后转换到东八区
        return dayjs.utc(timeStr).tz(DEFAULT_TIMEZONE).format(format);
      }

      // 其他格式，尝试直接解析（假设已经是本地时间）
      return dayjs(timeStr).format(format);
    } catch (error) {
      console.warn('时间格式化失败:', timeStr, error);
      return timeStr;
    }
  }

  /**
   * 将后端返回的时间字符串转换为 dayjs 对象（东八区）
   * @param timeStr 后端返回的时间字符串
   * @returns dayjs 对象
   */
  static parseToLocal(timeStr: string | null | undefined): dayjs.Dayjs | null {
    if (!timeStr) return null;

    try {
      // 如果时间字符串包含 'T' 且以 'Z' 结尾，说明是UTC时间
      if (timeStr.includes('T') && timeStr.endsWith('Z')) {
        return dayjs(timeStr).tz(DEFAULT_TIMEZONE);
      }

      // 如果时间字符串包含时区偏移信息（+XX:XX 或 -XX:XX）
      if (timeStr.includes('T') && (timeStr.includes('+') || timeStr.lastIndexOf('-') > 10)) {
        return dayjs(timeStr).tz(DEFAULT_TIMEZONE);
      }

      // 如果时间字符串包含 'T' 但不包含时区信息，假设是UTC时间
      if (timeStr.includes('T')) {
        return dayjs.utc(timeStr).tz(DEFAULT_TIMEZONE);
      }

      // 其他格式，尝试直接解析（假设已经是本地时间）
      return dayjs(timeStr);
    } catch (error) {
      console.warn('时间解析失败:', timeStr, error);
      return null;
    }
  }

  /**
   * 将本地时间转换为UTC时间字符串（用于发送给后端）
   * @param localTime dayjs 对象或时间字符串
   * @returns UTC时间的ISO字符串
   */
  static toUTC(localTime: dayjs.Dayjs | string | null | undefined): string | null {
    if (!localTime) return null;
    
    try {
      if (typeof localTime === 'string') {
        // 假设输入的是东八区时间
        return dayjs.tz(localTime, DEFAULT_TIMEZONE).utc().toISOString();
      } else {
        // dayjs 对象
        return localTime.utc().toISOString();
      }
    } catch (error) {
      console.warn('时间转换UTC失败:', localTime, error);
      return null;
    }
  }

  /**
   * 获取当前东八区时间
   * @param format 格式，默认为 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化的当前时间
   */
  static now(format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    return dayjs().tz(DEFAULT_TIMEZONE).format(format);
  }

  /**
   * 获取当前东八区时间的 dayjs 对象
   * @returns dayjs 对象
   */
  static nowDayjs(): dayjs.Dayjs {
    return dayjs().tz(DEFAULT_TIMEZONE);
  }

  /**
   * 表格时间列的渲染函数
   * @param value 时间值
   * @param format 显示格式
   * @returns 格式化的时间字符串
   */
  static renderTableTime(value: string | null | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    return TimeUtils.formatToLocal(value, format);
  }

  /**
   * 处理后端返回的时间字段，去除毫秒部分并转换为东八区
   * @param timeStr 时间字符串
   * @param format 显示格式
   * @returns 格式化的时间字符串
   */
  static formatBackendTime(timeStr: string | null | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    if (!timeStr) return '-';

    try {
      // 直接使用formatToLocal处理，它已经能够处理带毫秒的时间
      return TimeUtils.formatToLocal(timeStr, format);
    } catch (error) {
      console.warn('后端时间格式化失败:', timeStr, error);
      return timeStr;
    }
  }
}

// 导出常用的格式化函数
export const formatToLocal = TimeUtils.formatToLocal;
export const parseToLocal = TimeUtils.parseToLocal;
export const toUTC = TimeUtils.toUTC;
export const renderTableTime = TimeUtils.renderTableTime;
export const formatBackendTime = TimeUtils.formatBackendTime;

// 默认导出
export default TimeUtils;
