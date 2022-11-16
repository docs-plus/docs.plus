import React, { useEffect, useState, useRef } from 'react'
import './ReloadPrompt.css'

import { useRegisterSW } from 'virtual:pwa-register/react'
import Counter from './Counter'

const intervalMS = 1000 * 60 // 1min

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // eslint-disable-next-line prefer-template

      r && setInterval(() => {
        console.log("check for new update")
        r.update()
      }, intervalMS)

      // setOfflineReady(false)
      // setNeedRefresh(true)

    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
    onNeedRefresh() {
      // console.log("onNeedRefresh")
    },
    onOfflineReady() {
      // console.log("onOfflineReady")
    }
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="ReloadPrompt-container">
      {(offlineReady || needRefresh)
        && <div className="ReloadPrompt-toast">
          <div className="ReloadPrompt-message">
            {offlineReady
              ? <span>App ready to work offline!</span>
              : <span>New content available, click on reload button to update.</span>
            }
          </div>
          <div className='pt-2 flex'>
            {needRefresh &&
              <button className="ReloadPrompt-toast-button rounded-md bg-blue-500 text-white hover:bg-blue-600" onClick={() => updateServiceWorker(true)}>Reload</button>
            }
            <button className="ReloadPrompt-toast-button rounded-md hover:bg-slate-500  hover:text-white" onClick={() => { close(); }}>Close</button>
            {needRefresh &&
              <div className=' text-sm antialiased rounded-full  w-8 h-8 border-2 flex justify-center content-center items-center m-auto mr-0 border-sky-600'>
                <Counter seconds="30" callback={() => updateServiceWorker(true)} />
              </div>
            }
          </div>
        </div>
      }
    </div >
  )
}

export default ReloadPrompt
