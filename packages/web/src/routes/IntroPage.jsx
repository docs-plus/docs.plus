import { useState, useRef } from 'react';
import { redirect } from "react-router-dom";
import { Doc } from '../components/icons/Icons';

const IntroPage = () => {
  const padNameRef = useRef()

  const createARandomPad = () => {
    const randPadName = (Math.random() + 1).toString(36).substring(2);
    window.location = `/${ randPadName }`
    return redirect(`/${ randPadName }`)
  }

  const enterToPad = () => {
    const padName = padNameRef.current.value
    if (padName.length === 0) return
    window.location = `/${ padName }`
    return redirect(`/${ padName }`)
  }

  return (
    <div className='max-w-lg mx-auto h-screen flex flex-col justify-center align-middle p-4'>
      <div className='h-fit'>
        <h1 className='flex flex-row items-end'> <Doc size="58" className="mr-3" /> Docs Plus</h1>
        <h2 className='mt-2 text-gray-500 font-semibold'>Get Everyone one the Same Page</h2>
        <div className='flex flex-col h-32 w-3/4 items-center justify-center mx-auto my-11'>
          <button onClick={createARandomPad} className="px-3 w-full py-2 border rounded">New Pad</button>
          <label className='text-center w-full mt-6 block mb-1'>or Create/Open a Pad with the name:</label>
          <div className='flex flex-row w-full'>
            <input className='p-1 w-full rounded-l border' ref={padNameRef} type="text" id="padName" />
            <button className='border px-3 py-2 rounded border-l-0 rounded-l-none' onClick={enterToPad}>Enter</button>
          </div>
        </div>
        <div className=''>
          <p><span>+</span> A <a href="https://github.com/nwspk/docs.plus">free &amp; open source</a> project by <a href="https://newspeak.house">Newspeak House</a></p>
          <p><span>+</span> Check out our <a href="demo">demo page</a>!</p>
          <p><span>+</span> Enquiries to <a href="https://www.twitter.com/docsdotplus">@docsdotplus</a> or <a href="mailto:ed@newspeak.house">ed@newspeak.house</a></p>
          <p><span>+</span> <a href="https://www.patreon.com/docsplus">Back us on Patreon</a> to help us pay for hosting &amp; development</p>
          <p><span>+</span> See our progress &amp; roadmap on <a href="https://trello.com/b/RUlI6aWC/docsplus">Trello</a> </p>
          <p><span>+</span> Want to report a bug? Interested in contributing? Have a look at our <a href="https://github.com/nwspk/docs.plus/blob/main/CONTRIBUTING.md">contributing guidelines</a>. </p>
          <p><span>+</span> Kindly seed funded by <a href="https://www.grantfortheweb.org">Grant for Web</a> &amp; <a href="https://www.nesta.org.uk">Nesta</a></p>
        </div>
      </div>
    </div >
  );
}

export default IntroPage;
