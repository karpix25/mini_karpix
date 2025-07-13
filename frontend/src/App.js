// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css'; 
import Profile from './Profile';
import Content from './Content';

// Новые компоненты для нашей архитектуры
import CourseLayout from './CourseLayout';
import CourseLessonList from './CourseLessonList';
import CourseLessonContent from './CourseLessonContent';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            <Route path="/" element={<Profile />} />
            <Route path="/content" element={<Content />} />
            
            {/* Вот правильная структура для курсов */}
            <Route path="/course/:courseId" element={<CourseLayout />}>
              {/* index-маршрут: что показывать по-умолчанию */}
              <Route index element={<CourseLessonList />} /> 
              {/* Маршрут для конкретного урока */}
              <Route path="lesson/:lessonId" element={<CourseLessonContent />} />
            </Route>
            
          </Routes>
        </div>
        
        <nav className="nav-tabs">
          {/* ... ваша навигация ... */}
        </nav>
      </div>
    </Router>
  );
}

export default App;
