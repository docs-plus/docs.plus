export enum ELinkType {
  Email = 'email',
  Social = 'social',
  Simple = 'simple',
  Phone = 'phone'
}

export interface ILinkMetadata {
  title: string
  description: string
  icon: string
  themeColor?: string
  socialBanner?: string
}

export interface ILinkItem {
  url: string
  type: ELinkType
  metadata: ILinkMetadata
}
