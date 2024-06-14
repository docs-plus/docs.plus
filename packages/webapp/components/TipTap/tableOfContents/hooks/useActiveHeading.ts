import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const useActiveHeading = () => {
  const router = useRouter()
  const [activeHeading, setActiveHeading] = useState(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const heading = url.searchParams.get('id')

    if (heading) setActiveHeading(heading)
  }, [router.asPath])

  return [activeHeading, setActiveHeading]
}

export default useActiveHeading
