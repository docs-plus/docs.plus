import ContentLoader from 'react-content-loader'

const DocumentSimpleLoader = (props) => {
  return (
    <div {...props}>
      <ContentLoader
        backgroundColor="#f3f3f3"
        width={'100%'}
        height={140}
        uniqueKey="document-simple-loader2"
      >
        <rect x="0" y="0" rx="4" ry="4" width="54%" height="29" />
        <rect x="0" y="48" rx="4" ry="4" width="12%" height="15" />
        <rect x="17%" y="48" rx="4" ry="4" width="32%" height="15" />
        {/*  */}
        <rect x="2%" y="90" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="120" rx="4" ry="4" width="30%" height="15" />
      </ContentLoader>
      <ContentLoader
        backgroundColor="#5092ff"
        width={'100%'}
        height={15}
        className="mt-2"
        uniqueKey="document-simple-loader3"
      >
        <rect x="2%" y="0" rx="4" ry="4" width="20%" height="15" />
        <rect x="24%" y="0" rx="4" ry="4" width="16%" height="15" />
        <rect x="42%" y="0" rx="4" ry="4" width="54%" height="15" />
      </ContentLoader>
      <ContentLoader
        backgroundColor="#f3f3f3"
        width={'100%'}
        height={150}
        className="mt-2"
        uniqueKey="document-simple-loader4"
      >
        <rect x="2%" y="0" rx="4" ry="4" width="78%" height="15" />
        <rect x="2%" y="30" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="60" rx="4" ry="4" width="78%" height="15" />
        <rect x="2%" y="90" rx="4" ry="4" width="94%" height="15" />
        <rect x="2%" y="120" rx="4" ry="4" width="52%" height="15" />
      </ContentLoader>
    </div>
  )
}

export default DocumentSimpleLoader
