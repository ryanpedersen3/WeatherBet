import { useState } from 'react'
import './App.css'
import { NFLGames } from './components/NFLGames'
import { HistoricalGames } from './components/HistoricalGames'
import { Chatbot } from './components/Chatbot'

function App() {
  const [currentPage, setCurrentPage] = useState<'current' | 'historical'>('current');

  return (
    <div className="app-container">
      <nav className="main-nav">
        <button 
          className={currentPage === 'current' ? 'active' : ''}
          onClick={() => setCurrentPage('current')}
        >
          🏈 Current Games
        </button>
        <button 
          className={currentPage === 'historical' ? 'active' : ''}
          onClick={() => setCurrentPage('historical')}
        >
          📊 Historical Games
        </button>
      </nav>
      
      {currentPage === 'current' ? <NFLGames /> : <HistoricalGames />}
      
      {/* AI Chatbot - visible on all pages */}
      <Chatbot />
    </div>
  )
}

export default App
