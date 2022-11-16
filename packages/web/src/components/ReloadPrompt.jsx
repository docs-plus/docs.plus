import React from 'react'
import './ReloadPrompt.css'

import { useRegisterSW } from 'virtual:pwa-register/react'


// const updateServiceWorker = useRegisterSW({
//   onRegistered(r) {
//     r && setInterval(() => {
//       r.update()
//     }, intervalMS)
//   }
// })


function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // eslint-disable-next-line prefer-template
      // console.log(updateServiceWorker)
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
    onNeedRefresh() {
      console.log("onNeedRefresh")
      alert("onNeedRefresh")
    },
    onOfflineReady() {
      console.log("onOfflineReady")
      alert("onOfflineReady")
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
              ? <span>App ready to work offline</span>
              : <span>New content available, click on reload button to update.</span>
            }
          </div>
          {needRefresh && <button className="ReloadPrompt-toast-button" onClick={() => updateServiceWorker(true)}>Reload</button>}
          <button className="ReloadPrompt-toast-button" onClick={() => close()}>Close</button>
        </div>
      }
    </div>
  )
}

export default ReloadPrompt
