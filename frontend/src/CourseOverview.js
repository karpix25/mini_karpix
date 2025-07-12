import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент одной строки урока в списке
// Этот компонент не менялся, но я оставляю его для полноты картины.
const LessonListItem = ({ lesson, isUnlocked, onLessonClick }) => {
  return (
    <li
      className={`lesson-list-item ${!isUnlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
      onClick={() => isUnlocked && onLessonClick(lesson.id)}
    >
      {/* lesson-item-number может отсутствовать для админских уроков, это нормально */}
      <span className="lesson-item-number">{lesson.sort_order}</span>
      <span className="lesson-item-title">{lesson.title}</span>
    </li>
  );
};

// --- ИЗМЕНЕНИЕ №1: Упрощенный компонент секции ---
// Мы убрали 'userRankLevel', так как он больше не нужен для проверки.
const CourseSection = ({ section, onLessonClick, isInitiallyExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
    if (tg) tg.HapticFeedback.impactOccurred('light'); 
  };

  return (
    <div className="course-section-group">
      <div className="course-section-header" onClick={handleToggle}>
        <div className={`toggle-icon-wrapper ${isExpanded ? 'expanded' : ''}`}>
             <svg className="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        
        <div className="section-info">
          {section.title && <span className="course-section-title-text">{section.title.replace(/^Секция\s*/, '')}</span>}
        </div>
      </div>
      
      {isExpanded && (
        <ol className="section-lessons-list">
          {section.lessons.map((lesson) => (
            <LessonListItem 
              key={lesson.id}
              lesson={lesson}
              // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ---
              // Все уроки считаются разблокированными, так как доступ к курсу уже проверен.
              isUnlocked={true} 
              onLessonClick={onLessonClick}
            />
          ))}
        </ol>
      )}
    </div>
  );
};

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null);
  // --- ИЗМЕНЕНИЕ №2: Убрали ненужный стейт ---
  // const [userRankLevel, setUserRankLevel] = useState(1); 

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content'); 
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate]);

  // Загрузка данных курса
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!tg?.initData) {
        setError("Приложение должно быть открыто в Telegram.");
        setLoading(false);
        return;
      }

      try {
        const headers = { 'X-Init-Data': tg.initData };
        
        // --- ИЗМЕНЕНИЕ №3: Убрали лишний API-запрос ---
        // Запрос на /api/me здесь не нужен, так как бэкенд сам проверит
        // доступ при запросе курса и вернет 403 ошибку, если нужно.
        // Это упрощает код и уменьшает количество запросов.

        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, { headers });
        
        if (!courseResponse.ok) {
          if (courseResponse.status === 404) { throw new Error('Курс не найден'); }
          if (courseResponse.status === 403) { throw new Error('Недостаточно прав для доступа к курсу'); }
          throw new Error('Не удалось загрузить курс');
        }
        
        const courseData = await courseResponse.json();
        setCourse(courseData);
        
      } catch (error) {
        console.error('Ошибка загрузки курса:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]); // Добавил courseId в массив зависимостей для корректной работы

  const handleLessonClick = (lessonId) => {
    navigate(`/course/${courseId}/lesson/${lessonId}`);
  };

  if (loading) {
    return (
      <div className="course-overview-container common-loading-error-state">
        <div className="loading-spinner"></div>
        <p>Загружается курс...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-overview-container common-loading-error-state">
        <h2>Ошибка загрузки</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/content')} className="back-button">
          ← Вернуться к курсам
        </button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="course-overview-container common-loading-error-state">
        <h2>Курс не найден</h2>
        <button onClick={() => navigate('/content')} className="back-button">
          ← Вернуться к курсам
        </button>
      </div>
    );
  }

  const progressPercentage = course.progress || 0;

  return (
    <div className="course-overview-container">
      <div className="course-simple-header">
        <h1 className="course-simple-title">{course.title}</h1>
        <div className="course-simple-progress-bar">
          <div 
            className="course-simple-progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
          <span className="progress-percentage-text">{progressPercentage}%</span>
        </div>
      </div>

      <div className="course-sections-list-wrapper">
        {course.sections?.map((section, index) => (
          <CourseSection
            key={section.id}
            section={section}
            onLessonClick={handleLessonClick}
            // --- ИЗМЕНЕНИЕ №4: Убрали передачу ненужного prop ---
            // userRankLevel={userRankLevel} 
            isInitiallyExpanded={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export default CourseOverview;
