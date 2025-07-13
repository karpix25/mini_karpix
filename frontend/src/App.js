// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css'; 
import Profile from './Profile';
import Content from './Content';
import CourseOverview from './CourseOverview'; // Наш главный компонент для этой задачи

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/" element={<Profile />} />
            <Route path="/content" element={<Content />} />
            
            {/* Этот маршрут ведет на страницу курса, где отображается сайдбар + контент */}
            <Route path="/course/:courseId" element={<CourseOverview />} />
            <Route path="/course/:courseId/lesson/:lessonId" element={<CourseOverview />} />

            {/* <Route path="/article/:articleId" element={<ArticleReader />} /> */}
          </Routes>
        </div>
        
        <nav className="nav-tabs">
            <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                Профиль
            </NavLink>
            <NavLink to="/content" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                Контент
            </NavLink>
        </nav>
      </div>
    </Router>
  );
}

export default App;
