import { useState } from 'react';
import { redirect } from "react-router-dom";


const IntroPage = () => {
  const [padName, setPadName] = useState("")

  const createARandomPad = () => {
    const randPadName = (Math.random() + 1).toString(36).substring(2);
    window.location = `/${ randPadName }`
    return redirect(`/${ randPadName }`)
  }

  const enterToPad = () => {
    if (padName.length === 0) return
    window.location = `/${ padName }`
    return redirect(`/${ padName }`)
  }

  return (
    <div className=''>
      <div className=''>
        <h1>Docs Plus</h1>
        <h2>Get Everyone one the Same Page</h2>
        <div className='flex m-auto flex-col h-32 w-96 align-middle justify-between mt-24 mb-28'>
          <button onClick={createARandomPad}>New Pad</button>
          <label className='text-center w-full mt-6 block mb-1'>or Create/open a Pad with the name:</label>
          <div className='flex flex-row'>
            <input className='p-1 w-full rounded-l' onChange={e => setPadName(e.target.value)} value={padName} type="text" id="padName" />
            <button className='rounded-l-none' onClick={enterToPad}>Enter</button>
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
