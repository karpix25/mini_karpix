import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент раздела с toggle
const CourseSection = ({ section, isExpanded, onToggle, onLessonClick, userRankLevel }) => {
  return (
    <div className="course-section">
      <div 
        className={`section-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <div className="section-info">
          <span className="section-icon">{section.icon || '📚'}</span>
          <span className="section-title">{section.title}</span>
        </div>
        <div className="section-controls">
          <span className="lessons-count">{section.lessons.length} уроков</span>
          <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="section-lessons">
          {section.lessons.map((lesson, index) => {
            const isUnlocked = true; // Все уроки в курсе доступны если курс доступен
            return (
              <div 
                key={lesson.id}
                className={`lesson-item ${!isUnlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
                onClick={() => isUnlocked && onLessonClick(lesson.id)}
              >
                <div className="lesson-info">
                  <span className="lesson-icon">
                    {!isUnlocked ? '🔒' : lesson.completed ? '✅' : '📄'}
                  </span>
                  <span className="lesson-title">{lesson.title}</span>
                </div>
                <span className="lesson-duration">5 мин</span>
              </div>
            );
          })}
        </div>
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
  const [expandedSections, setExpandedSections] = useState({});

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
        // Загружаем данные пользователя
        const userResponse = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const points = userData.points || 0;
          // Простая логика определения ранга: каждые 50 очков = +1 ранг
          const rankLevel = Math.floor(points / 50) + 1;
          setUserRankLevel(Math.min(rankLevel, 4)); // Макс ранг 4
        }

        // Загружаем данные конкретного курса
        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!courseResponse.ok) {
          if (courseResponse.status === 404) {
            throw new Error('Курс не найден');
          }
          if (courseResponse.status === 403) {
            throw new Error('Недостаточно прав для доступа к курсу');
          }
          throw new Error('Не удалось загрузить курс');
        }
        
        const courseData = await courseResponse.json();
        console.log('Loaded course data:', courseData);
        setCourse(courseData);
        
        // Разворачиваем первый раздел по умолчанию
        if (courseData.sections?.length > 0) {
          setExpandedSections({ [courseData.sections[0].id]: true });
        }
        
      } catch (error) {
        console.error('Ошибка загрузки курса:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleSectionToggle = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleLessonClick = (lessonId) => {
    navigate(`/course/${courseId}/lesson/${lessonId}`);
  };

  const goBackToContent = () => {
    navigate('/content');
  };

  if (loading) {
    return (
      <div className="course-overview-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Загружается курс...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-overview-container">
        <div className="error-state">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <button onClick={goBackToContent} className="back-button">
            ← Вернуться к курсам
          </button>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="course-overview-container">
        <div className="error-state">
          <h2>Курс не найден</h2>
          <button onClick={goBackToContent} className="back-button">
            ← Вернуться к курсам
          </button>
        </div>
      </div>
    );
  }

  const totalLessons = course.sections?.reduce((acc, section) => acc + section.lessons.length, 0) || 0;
  const completedLessons = course.sections?.reduce((acc, section) => 
    acc + section.lessons.filter(lesson => lesson.completed).length, 0
  ) || 0;
  const progressPercentage = course.progress || 0;

  return (
    <div className="course-overview-container">
      {/* Мобильная навигация */}
      <div className="mobile-navigation">
        <button className="back-to-menu" onClick={goBackToContent}>
          ← Menu
        </button>
      </div>

      {/* Заголовок курса */}
      <div className="course-header">
        <h1 className="course-title">{course.title}</h1>
        <p className="course-description">{course.description}</p>
        
        <div className="course-stats">
          <div className="progress-section">
            <div className="progress-text">
              <span className="progress-percentage">{progressPercentage}%</span>
              <span className="progress-label">завершено</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="course-meta">
            <span className="meta-item">
              <span className="meta-icon">📚</span>
              {totalLessons} уроков
            </span>
            <span className="meta-item">
              <span className="meta-icon">⭐</span>
              Ранг {course.rank_required}
            </span>
          </div>
        </div>
      </div>

      {/* Список разделов */}
      <div className="course-sections">
        {course.sections?.map((section) => (
          <CourseSection
            key={section.id}
            section={section}
            isExpanded={expandedSections[section.id]}
            onToggle={() => handleSectionToggle(section.id)}
            onLessonClick={handleLessonClick}
            userRankLevel={userRankLevel}
          />
        ))}
      </div>

      {/* Информация о доступе */}
      <div className="access-info">
        <p className="access-text">
          💡 Зарабатывайте очки в канале, чтобы разблокировать новые курсы
        </p>
      </div>
    </div>
  );
}

export default CourseOverview;
