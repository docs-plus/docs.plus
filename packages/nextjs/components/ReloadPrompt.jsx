import React, { useState, useEffect } from 'react'
import Counter from './Counter'
const intervalMS = 1000 * 60 // 1min

const PwaUpdater = () => {
    const wb = window?.workbox

    const [isOpen, setIsOpen] = useState(false);
    const onConfirmActivate = () => wb.messageSkipWaiting();


    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.workbox !== undefined) {

    useEffect(() => {

            // add event listeners to handle any of PWA lifecycle event
            // https://developers.google.com/web/tools/workbox/reference-docs/latest/module-workbox-window.Workbox#events
            wb.addEventListener('installed', event => {
              console.log(`Event ${event.type} is triggered.`)
              console.log(event)
            })

            wb.addEventListener('controlling', event => {
              console.log(`Event ${event.type} is triggered.`)
              console.log(event)
              window.location.reload();
            })

            wb.addEventListener('activated', event => {
              console.log(`Event ${event.type} is triggered.`)
              console.log(event)
            })

            // A common UX pattern for progressive web apps is to show a banner when a service worker has updated and waiting to install.
            // NOTE: MUST set skipWaiting to false in next.config.js pwa object
            // https://developers.google.com/web/tools/workbox/guides/advanced-recipes#offer_a_page_reload_for_users
            const promptNewVersionAvailable = event => {
                console.log("promptNewVersionAvailable", event)
              // `event.wasWaitingBeforeRegister` will be false if this is the first time the updated service worker is waiting.
              // When `event.wasWaitingBeforeRegister` is true, a previously updated service worker is still waiting.
              // You may want to customize the UI prompt accordingly.
              if (confirm('A newer version of this web app is available, reload to update?')) {
                wb.addEventListener('controlling', event => {
                //   window.location.reload()
                    console.log("new version is available")
                })

                // Send a message to the waiting service worker, instructing it to activate.
                // wb.messageSkipWaiting()
              } else {
                console.log(
                  'User rejected to reload the web app, keep using old version. New version will be automatically load when user open the app next time.'
                )
              }
            }

            // wb.addEventListener('waiting', promptNewVersionAvailable)
            wb.addEventListener('waiting', () => setIsOpen(true));
            wb.register();

            // ISSUE - this is not working as expected, why?
            // I could only make message event listenser work when I manually add this listenser into sw.js file
            wb.addEventListener('message', event => {
              console.log(`Event ${event.type} is triggered.`)
              console.log(event)
            })

    }, []);

  }


    return (
        <div className={`${isOpen? 'visible': 'hidden'} fixed bottom-2 left-2 p-3 z-50 rounded-md shadow bg-white`}>
        <p>
          Hey, a new version is available! Please click below to update.
        </p>
        <div className='pt-2 flex'>
            <button
                className="border outline mr-2 px-3 py-1 outline-none rounded-md bg-blue-500 text-white hover:bg-blue-600"
                onClick={onConfirmActivate}
            >
                Reload and update
            </button>
            <button
                className="border outline mr-2 px-3 py-1 outline-none rounded-md hover:bg-slate-500  hover:text-white"
                onClick={() => setIsOpen(false)}
            >
                Cancel
            </button>
        </div>

      </div>
    );
  }

  export default PwaUpdater;
