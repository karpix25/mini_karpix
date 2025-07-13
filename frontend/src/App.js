import AdminPanel from './AdminPanel';
import { Routes, Route, BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </div>
        {/* ... навигация ... */}
      </div>
    </Router>
  );
}

export default App; 