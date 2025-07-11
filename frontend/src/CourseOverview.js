import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент одной строки урока в списке
const LessonListItem = ({ lesson, isUnlocked, onLessonClick }) => {
  return (
    <li
      className={`lesson-list-item ${!isUnlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
      onClick={() => isUnlocked && onLessonClick(lesson.id)}
    >
      {/* lesson.sort_order теперь будет использоваться для CSS counter, не рендерим его явно тут */}
      <span className="lesson-item-title">{lesson.title}</span>
    </li>
  );
};

// Компонент секции курса (если секции нужны для группировки уроков)
const CourseSection = ({ section, onLessonClick, userRankLevel }) => {
  // Логика разблокировки секции (если применимо)
  const isSectionUnlocked = true; // Пока всегда true, если курс доступен
  
  return (
    <div className="course-section-group">
      {/* Заголовок секции - если он нужен для разделения, но менее заметный */}
      {section.title && <h3 className="course-section-title">{section.title}</h3>}
      
      {/* Нумерованный список уроков */}
      <ol className="section-lessons-list">
        {section.lessons.map((lesson) => (
          <LessonListItem 
            key={lesson.id}
            lesson={lesson}
            isUnlocked={isSectionUnlocked && (lesson.rank_required <= userRankLevel)} // Пример логики разблокировки урока
            onLessonClick={onLessonClick}
          />
        ))}
      </ol>
    </div>
  );
};

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRankLevel, setUserRankLevel] = useState(1); 

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
        
        const userResponse = await fetch(`${BACKEND_URL}/api/me`, { headers });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const rankLevel = Math.floor((userData.points || 0) / 50) + 1;
          setUserRankLevel(Math.min(rankLevel, 4)); 
        }

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
  }, [courseId]);

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
      {/* Заголовок курса (как на скриншоте KontentEngine.io) */}
      <div className="course-simple-header">
        <h1 className="course-simple-title">{course.title}</h1>
        {/* Прогресс-бар (как на скриншоте) */}
        <div className="course-simple-progress-bar">
          <div 
            className="course-simple-progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Список секций/уроков */}
      <div className="course-sections-list-wrapper">
        {course.sections?.map((section) => (
          <CourseSection
            key={section.id}
            section={section}
            onLessonClick={handleLessonClick}
            userRankLevel={userRankLevel} 
          />
        ))}
      </div>
    </div>
  );
}

export default CourseOverview;
