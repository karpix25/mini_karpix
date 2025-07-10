import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import Leaderboard from './Leaderboard';
import Content from './Content';
import CourseOverview from './CourseOverview'; // Новый компонент
import LessonReader from './LessonReader'; // Переименованный ArticleReader
import ArticleReader from './ArticleReader'; // Старый компонент для совместимости
import Profile from './Profile';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/content" element={<Content />} />
            
            {/* Новые роуты для курсов */}
            <Route path="/course/:courseId" element={<CourseOverview />} />
            <Route path="/course/:courseId/lesson/:lessonId" element={<LessonReader />} />
            
            {/* Старый роут для обратной совместимости */}
            <Route path="/article/:articleId" element={<ArticleReader />} />
          </Routes>
        </div>
        
        <Routes>
          {/* Скрываем навигацию на страницах курсов и уроков */}
          <Route path="/course/*" element={null} />
          <Route path="/article/:articleId" element={null} />
          <Route path="*" element={
              <div className="nav-tabs">
                  <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                      Профиль
                  </NavLink>
                  <NavLink to="/leaderboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                      Лидеры
                  </NavLink>
                  <NavLink to="/content" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                      Контент
                  </NavLink>
              </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
