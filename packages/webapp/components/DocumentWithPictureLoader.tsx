import React from 'react'
import ContentLoader from 'react-content-loader'

type TProps = {
  level: string
  className: string
}

// Using React.HTMLProps<HTMLDivElement> for general div props
const DocumentWithPictureLoader: React.FC<React.HTMLProps<HTMLDivElement> & TProps> = (
  props: TProps
) => {
  return (
    <div {...props}>
      <ContentLoader
        backgroundColor="#f3f3f3"
        width={'100%'}
        height={140}
        uniqueKey="document-simple-loader5">
        <rect x="0" y="0" rx="4" ry="4" width="54%" height="29" />
        <rect x="0" y="48" rx="4" ry="4" width="12%" height="15" />
        <rect x="17%" y="48" rx="4" ry="4" width="32%" height="15" />
        {/*  */}
        <rect x="2%" y="90" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="120" rx="4" ry="4" width="30%" height="15" />
      </ContentLoader>
      <ContentLoader
        backgroundColor="#c6c6c6"
        width={'100%'}
        height={120}
        className="mt-2"
        uniqueKey="document-simple-loader22">
        <rect x="2%" y="0" rx="4" ry="4" width="14%" height="108" />

        <rect x="18%" y="0" rx="4" ry="4" width="78%" height="15" />
        <rect x="18%" y="30" rx="4" ry="4" width="58%" height="15" />
        <rect x="18%" y="60" rx="4" ry="4" width="78%" height="15" />
        <rect x="18%" y="90" rx="4" ry="4" width="28%" height="15" />
      </ContentLoader>
      <ContentLoader
        backgroundColor="#f3f3f3"
        width={'100%'}
        height={160}
        className="mt-2"
        uniqueKey="document-simple-loader242">
        <rect x="2%" y="0" rx="4" ry="4" width="78%" height="15" />
        <rect x="2%" y="30" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="60" rx="4" ry="4" width="78%" height="15" />
        <rect x="2%" y="90" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="120" rx="4" ry="4" width="52%" height="15" />
      </ContentLoader>
    </div>
  )
}

export default DocumentWithPictureLoader
