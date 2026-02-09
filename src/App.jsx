import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Upload from './pages/Upload'
import View from './pages/View'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/view" element={<View />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
