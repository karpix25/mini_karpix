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
      {/* lesson.sort_order - это номер урока */}
      <span className="lesson-item-number">{lesson.sort_order}.</span> {/* Явная нумерация урока */}
      <span className="lesson-item-title">{lesson.title}</span>
      {/* Иконки состояния (замок/галочка) можно добавить здесь, если нужны */}
    </li>
  );
};

// Компонент секции курса (теперь с возможностью переключения)
const CourseSection = ({ section, onLessonClick, userRankLevel, isInitiallyExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
    if (tg) tg.HapticFeedback.impactOccurred('light'); // Тактильный отклик
  };

  const isSectionUnlocked = true; // Пока всегда true, если курс доступен
  
  return (
    <div className="course-section-group">
      <div className="course-section-header" onClick={handleToggle}>
        <div className="section-info">
          {/* Убрано "Секция" - теперь только название секции */}
          {section.title && <span className="course-section-title-text">{section.title}</span>}
        </div>
        <div className="section-controls">
          {/* Иконка переключения (шеврон) */}
          <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>
      
      {isExpanded && (
        <ol className="section-lessons-list">
          {section.lessons.map((lesson) => (
            <LessonListItem 
              key={lesson.id}
              lesson={lesson}
              isUnlocked={isSectionUnlocked && (lesson.rank_required <= userRankLevel)} 
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
      {/* Заголовок курса и прогресс-бар */}
      <div className="course-simple-header">
        <h1 className="course-simple-title">{course.title}</h1>
        {/* Прогресс-бар с текстом внутри */}
        <div className="course-simple-progress-bar">
          <div 
            className="course-simple-progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
          <span className="progress-percentage-text">{progressPercentage}%</span>
        </div>
      </div>

      {/* Список секций/уроков */}
      <div className="course-sections-list-wrapper">
        {course.sections?.map((section, index) => (
          <CourseSection
            key={section.id}
            section={section}
            onLessonClick={handleLessonClick}
            userRankLevel={userRankLevel} 
            isInitiallyExpanded={index === 0} // Разворачиваем первую секцию по умолчанию
          />
        ))}
      </div>
    </div>
  );
}

export default CourseOverview;
