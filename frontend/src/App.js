import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'; // <-- Добавлена точка с запятой
import './App.css'; // <-- Добавлена точка с запятой
import Profile from './Profile'; // <-- Добавлена точка с запятой
import Content from './Content'; // <-- Добавлена точка с запятой
import CourseOverview from './CourseOverview'; // <-- Добавлена точка с запятой
import LessonReader from './LessonReader'; // <-- Добавлена точка с запятой
import ArticleReader from './ArticleReader'; // <-- Добавлена точка с запятой (если он будет использоваться)

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/" element={<Profile />} />
            <Route path="/leaderboard" element={<Profile />} />
            
            <Route path="/content" element={<Content />} />
            
            <Route path="/course/:courseId" element={<CourseOverview />} />
            <Route path="/course/:courseId/lesson/:lessonId" element={<LessonReader />} />
            
            <Route path="/article/:articleId" element={<ArticleReader />} />
          </Routes>
        </div>
        
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
      </div>
    </Router>
  );
}

export default App;
