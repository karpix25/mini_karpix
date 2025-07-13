// src/CourseLayout.js
import React, { useState, useEffect, createContext } from 'react';
import { Outlet, useParams, NavLink } from 'react-router-dom';
import useMediaQuery from './hooks/useMediaQuery';
import './CourseLayout.css'; // Общие стили для макета

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Создаем контекст для передачи данных вниз
export const CourseContext = createContext(null);

// --- Компоненты для РАЗНЫХ ВИДОВ ---

const DesktopView = () => {
  const { course, courseId } = React.useContext(CourseContext);

  if (!course) return null; // Или заглушка загрузки

  return (
    <div className="desktop-layout">
      <aside className="desktop-sidebar">
        <div className="sidebar-header">
            <h2 className="course-name">{course.title}</h2>
        </div>
        <div className="sidebar-progress-wrapper">
            <div className="sidebar-progress-bar">
                <div className="sidebar-progress-fill" style={{ width: `${course.progress || 0}%` }}>
                    <span>{course.progress || 0}%</span>
                </div>
            </div>
        </div>
        <div className="sidebar-content">
          {course.sections.map(section => (
              <div key={section.id} className="sidebar-section">
                  <div className="sidebar-section-header">
                      <h3 className="section-title">{section.title}</h3>
                  </div>
                  <ul className="sidebar-lessons-list">
                      {section.lessons.map(l => (
                          <li key={l.id}>
                            <NavLink to={`/course/${courseId}/lesson/${l.id}`} className={({ isActive }) => `sidebar-lesson ${isActive ? 'active' : ''}`}>
                                {l.title}
                            </NavLink>
                          </li>
                      ))}
                  </ul>
              </div>
          ))}
        </div>
      </aside>
      <main className="desktop-content">
        <Outlet /> {/* Здесь будет либо CourseLessonList, либо CourseLessonContent */}
      </main>
    </div>
  );
};

const MobileView = () => {
  // На мобильных мы просто рендерим то, что говорит роутер (список или урок)
  return (
    <div className="mobile-layout">
      <Outlet />
    </div>
  );
};


// --- ГЛАВНЫЙ КОМПОНЕНТ-ОРКЕСТРАТОР ---

function CourseLayout() {
  const { courseId } = useParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Этот компонент загружает данные один раз и пробрасывает их вниз
    const fetchCourseData = async () => {
      // ... ваша логика fetch для `/api/courses/${courseId}` ...
      // В конце: setCourse(data); setLoading(false);
    };
    fetchCourseData();
  }, [courseId]);

  if (loading) return <div>Загрузка курса...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <CourseContext.Provider value={{ course, setCourse, courseId }}>
      {isDesktop ? <DesktopView /> : <MobileView />}
    </CourseContext.Provider>
  );
}

export default CourseLayout;
