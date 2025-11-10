import MobileDetect from 'mobile-detect'
import { type GetServerSidePropsContext } from 'next'

export const getDeviceInfo = (
  context: GetServerSidePropsContext
): { isMobile: boolean; os: string | null } => {
  const userAgent = context.req.headers['user-agent'] || ''
  const device = new MobileDetect(userAgent)

  return {
    isMobile: Boolean(device.mobile()),
    os: device.os() || null
  }
}
