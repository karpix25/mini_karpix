import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент раздела без явного toggle (если разделы всегда развернуты)
const CourseSection = ({ section, onLessonClick }) => {
  return (
    <div className="course-section-group"> {/* Новая обертка для секции */}
      {/* Заголовок секции, если она нужна (на скриншоте не виден) */}
      {/* Можно добавить <h3 className="section-title">{section.title}</h3> если секции нужны */}
      
      <ol className="section-lessons-list"> {/* Список уроков в виде нумерованного списка */}
        {section.lessons.map((lesson) => {
          // Логика разблокировки должна быть на бэкенде или в userData.is_active
          // Для простоты пока оставим isUnlocked = true
          const isUnlocked = true; 
          return (
            <li 
              key={lesson.id}
              className={`lesson-list-item ${!isUnlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
              onClick={() => isUnlocked && onLessonClick(lesson.id)}
            >
              {/* Если нужны иконки, то здесь, но на скриншоте их нет */}
              {/* <span className="lesson-item-icon">
                {!isUnlocked ? '🔒' : lesson.completed ? '✅' : '📄'}
              </span> */}
              <span className="lesson-item-title">{lesson.title}</span>
              {/* <span className="lesson-duration">5 мин</span> */} {/* Убрано, т.к. на скриншоте нет */}
            </li>
          );
        })}
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
  const [userRankLevel, setUserRankLevel] = useState(1); // Сохраняем, если нужно для логики доступа

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content'); // Назад к списку курсов
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
        // Загружаем данные пользователя (для ранга)
        const userResponse = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          // Ваша логика определения ранга
          const rankLevel = Math.floor((userData.points || 0) / 50) + 1;
          setUserRankLevel(Math.min(rankLevel, 4)); 
        }

        // Загружаем данные конкретного курса
        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
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
    // Переход к странице чтения урока
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
      {/* Заголовок курса */}
      <div className="course-overview-header">
        <h1 className="course-overview-title">{course.title}</h1>
        {/* Прогресс-бар */}
        <div className="course-overview-progress-bar">
          <div 
            className="course-overview-progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Список уроков, объединенный из всех секций */}
      <div className="course-overview-content-list">
        {course.sections?.map((section) => (
          <CourseSection
            key={section.id}
            section={section}
            onLessonClick={handleLessonClick}
            userRankLevel={userRankLevel} // Передаем, если нужно для логики доступа
          />
        ))}
      </div>

      {/* Информация о доступе - можно сохранить, если она нужна */}
      {/* <div className="access-info">
        <p className="access-text">
          💡 Зарабатывайте очки в канале, чтобы разблокировать новые курсы
        </p>
      </div> */}
    </div>
  );
}

export default CourseOverview;
