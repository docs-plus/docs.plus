import ContentLoader from 'react-content-loader'

const TableOfcontentLoader = (props) => {
  return (
    <div {...props}>
      <ContentLoader
        width={'100%'}
        height={700}
        backgroundColor="#ccc"
        foregroundColor="#ebebeb"
        uniqueKey="TableOfcontentLoader">
        <rect x="22" y="20" rx="3" ry="3" width="129" height="23" />
        <rect x="20" y="80" rx="3" ry="3" width="148" height="14" />
        <rect x="64" y="108" rx="3" ry="3" width="148" height="14" />
        <rect x="65" y="136" rx="3" ry="3" width="148" height="14" />
        <rect x="64" y="164" rx="3" ry="3" width="148" height="14" />
        <rect x="20" y="192" rx="3" ry="3" width="148" height="14" />
        <rect x="64" y="220" rx="3" ry="3" width="148" height="14" />
        <rect x="64" y="248" rx="3" ry="3" width="148" height="14" />
        <rect x="84" y="276" rx="3" ry="3" width="148" height="14" />
      </ContentLoader>
    </div>
  )
}

export default TableOfcontentLoader
