import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db, initDB } from '../../../db';

const useCustomHook = (docSlug) => {
  // NOTE: This is a hack to get the correct URL in the build time
  const url = `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ docSlug }`

  const { isLoading, error, data, isSuccess } = useQuery({
    queryKey: ['getDocumentMetadataByDocName'],
    queryFn: () => {
      return fetch(url).then((res) => res.json())
    },
  })

  return { isLoading, error, data, isSuccess }
}

const useDocumentMetadata = (docSlug, docTitle, slugs) => {
  const { isLoading, error, data, isSuccess } = useCustomHook(docSlug);
  const [documentTitle, setDocumentTitle] = useState(docTitle);
  const [docId, setDocId] = useState(null);

  useEffect(() => {
    if (data?.data?.documentId) {
      const { documentId, isPrivate } = data?.data;

      setDocumentTitle(data?.data.title);
      setDocId(`${ isPrivate ? 'private' : 'public' }.${ documentId }`);
      localStorage.setItem('docId', documentId);
      localStorage.setItem(
        'padName',
        `${ isPrivate ? 'private' : 'public' }.${ documentId }`
      );
      localStorage.setItem('slug', docSlug);
      localStorage.setItem('title', data?.data.title);

      initDB(
        `meta.${ documentId }`,
        `${ isPrivate ? 'private' : 'public' }.${ documentId }`
      );

      // get the heading map from indexdb, when the document is not in the filter mode
      if (slugs.length === 1) {
        // console.log('get db.meta data from indexdb')
        db.meta
          .where({ docId: documentId })
          .toArray()
          .then((data) => {
            localStorage.setItem('headingMap', JSON.stringify(data))
          })
      }
    }
  }, [data]);

  return {
    documentTitle,
    docId,
    isLoading, error,
    isSuccess
  };
};

export default useDocumentMetadata
