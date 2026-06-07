import MobileDetect from 'mobile-detect'
import { type GetServerSidePropsContext } from 'next'

export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface DeviceInfo {
  /** @deprecated Use `deviceType` instead */
  isMobile: boolean
  deviceType: DeviceType
  os: string | null
}

export const getDeviceInfo = (context: GetServerSidePropsContext): DeviceInfo => {
  const userAgent = context.req.headers['user-agent'] || ''
  const device = new MobileDetect(userAgent)

  // mobile-detect: tablet() → tablet UA, phone() → phone UA, mobile() → either
  const isTablet = Boolean(device.tablet())
  const isMobile = Boolean(device.mobile()) // true for both phones AND tablets

  const deviceType: DeviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  return {
    isMobile,
    deviceType,
    os: device.os() || null
  }
}
