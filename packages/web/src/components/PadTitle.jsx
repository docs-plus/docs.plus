
import { Link } from 'react-router-dom'

import {
  DocsPlus
} from './icons/Icons'

const PadTitle = ({ padName }) => {
  return (
    <div className='flex flex-row items-center'>
      <div className='padLog'>
        <Link to="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      <div className='ml-3'>
        <div className="border border-transparent px-2 py-0 rounded-sm text-lg font-medium min-w-[14rem] hover:border-slate-300" type="text" >
          {padName}
        </div>
      </div>
    </div>
  )
}

export default PadTitle
