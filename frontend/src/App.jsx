import { useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import Tiptap from './components/Tiptap.jsx'


function App({ padName }) {
  return (
    <div className="App">
      <h1>Docsy Editor:</h1>
      <Tiptap padName={padName} />
    </div>
  )
}

export default App
