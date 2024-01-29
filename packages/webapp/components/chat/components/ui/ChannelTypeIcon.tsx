import { MdOutlinePublic } from 'react-icons/md'
import { RiLock2Fill } from 'react-icons/ri'
import { MdCampaign } from 'react-icons/md'
import { MdGroups } from 'react-icons/md'
import { RiArchiveFill } from 'react-icons/ri'
import { FaUserGroup } from 'react-icons/fa6'

export const ChannelTypeIcon = ({ channelType }: any) => {
  const size = 20

  switch (channelType) {
    case 'PUBLIC':
      return <MdOutlinePublic size={size} />
    case 'PRIVATE':
      return <RiLock2Fill size={size} />
    case 'DIRECT':
      return <FaUserGroup size={size - 2} />
    case 'BROADCAST':
      return <MdCampaign size={size + 2} />
    case 'GROUP':
      return <MdGroups size={size + 2} />
    case 'ARCHIVE':
      return <RiArchiveFill size={size} />
    default:
      return ''
  }
}
