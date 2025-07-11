import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css'; 
import Profile from './Profile';
import Content from './Content';
import CourseOverview from './CourseOverview';
import LessonReader from './LessonReader';
import ArticleReader from './ArticleReader'; 

function App() {
  return (
    <Router>
      <div className="App">
        <div className="content">
          <Routes>
            {/* Главная страница, которая теперь включает Профиль и Лидерборд */}
            <Route path="/" element={<Profile />} /> 
            {/* Этот маршрут теперь можно удалить, так как он дублирует "/" */}
            {/* <Route path="/leaderboard" element={<Profile />} /> */}
            
            <Route path="/content" element={<Content />} />
            
            <Route path="/course/:courseId" element={<CourseOverview />} />
            <Route path="/course/:courseId/lesson/:lessonId" element={<LessonReader />} />
            
            <Route path="/article/:articleId" element={<ArticleReader />} />
          </Routes>
        </div>
        
        {/* Нижняя навигация */}
        <div className="nav-tabs">
            <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                Профиль
            </NavLink>
            {/* УДАЛЯЕМ ЭТУ Вкладку Лидеры */}
            {/* 
            <NavLink to="/leaderboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                Лидеры
            </NavLink>
            */}
            <NavLink to="/content" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                Контент
            </NavLink>
        </div>
      </div>
    </Router>
  );
}

export default App;
