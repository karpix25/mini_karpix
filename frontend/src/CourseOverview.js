import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';
import LessonContent from './LessonContent';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент секции с toggle
const CourseSection = ({ section, onLessonClick, expanded, onToggle, activeLessonId }) => {
  return (
    <div className="course-section-group">
      {/* Заголовок секции с toggle */}
      <div className="course-section-header" onClick={onToggle}>
        <span className="course-section-title-text">{section.title}</span>
        <span className={`toggle-icon-wrapper${expanded ? ' expanded' : ''}`}>▼</span>
      </div>
      {expanded && (
        <ol className="section-lessons-list">
          {section.lessons.map((lesson) => {
            const isUnlocked = true; // TODO: логика разблокировки
            const isActive = lesson.id === activeLessonId;
            return (
              <li
                key={lesson.id}
                className={`lesson-list-item${!isUnlocked ? ' locked' : ''}${lesson.completed ? ' completed' : ''}${isActive ? ' selected' : ''}`}
                onClick={() => isUnlocked && onLessonClick(lesson.id)}
              >
                <span className="lesson-item-title">{lesson.title}</span>
              </li>
            );
          })}
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
  const [expandedSections, setExpandedSections] = useState({});
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [lessonData, setLessonData] = useState(null); // Для десктопа: содержимое выбранного урока
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState(null);
  const [lessonCompleted, setLessonCompleted] = useState(false);

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

  // Открываем первую секцию по умолчанию после загрузки курса
  useEffect(() => {
    if (course?.sections) {
      const initial = {};
      course.sections.forEach((section, idx) => {
        initial[section.id] = idx === 0; // первая секция открыта
      });
      setExpandedSections(initial);
    }
  }, [course]);

  // Загрузка содержимого урока для десктопа
  useEffect(() => {
    if (window.innerWidth >= 1024 && activeLessonId && courseId) {
      const fetchLesson = async () => {
        setLessonLoading(true);
        setLessonError(null);
        try {
          const headers = tg?.initData ? { 'X-Init-Data': tg.initData } : {};
          const resp = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${activeLessonId}`, { headers });
          if (!resp.ok) throw new Error('Ошибка загрузки урока');
          const data = await resp.json();
          setLessonData(data);
          // Проверяем статус завершения урока
          const currentLessonInCourse = course.sections
            ?.flatMap(section => section.lessons)
            ?.find(l => l.id === activeLessonId);
          setLessonCompleted(currentLessonInCourse?.completed || false);
        } catch (e) {
          setLessonError(e.message);
        } finally {
          setLessonLoading(false);
        }
      };
      fetchLesson();
    }
  }, [activeLessonId, courseId, course]);

  // Навигация между уроками (десктоп)
  const getAllLessons = () => {
    if (!course?.sections) return [];
    const allLessons = [];
    course.sections.forEach(section => {
      section.lessons.forEach(lessonItem => {
        allLessons.push({ ...lessonItem, sectionId: section.id });
      });
    });
    allLessons.sort((a, b) => a.sort_order - b.sort_order);
    return allLessons;
  };
  const allLessons = getAllLessons();
  const currentIndex = allLessons.findIndex(l => l.id === activeLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const handleMarkComplete = async () => {
    if (!tg?.initData || !activeLessonId) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${activeLessonId}/complete`, {
        method: 'POST',
        headers: { 'X-Init-Data': tg.initData }
      });
      if (response.ok) {
        setLessonCompleted(!lessonCompleted);
        if (tg) tg.HapticFeedback.impactOccurred('light');
      }
    } catch {}
  };

  const handleSectionToggle = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleLessonClick = (lessonId) => {
    setActiveLessonId(lessonId);
    // Мобильная версия — переход на отдельную страницу
    if (window.innerWidth < 1024) {
      navigate(`/course/${courseId}/lesson/${lessonId}`);
    }
    // Десктоп — просто выделяем урок, содержимое будет справа
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
    <div className={`course-overview-container${window.innerWidth >= 1024 ? ' course-layout-container' : ''}`}>
      {/* Заголовок курса */}
      <div className="course-overview-header">
        <h1 className="course-overview-title">{course.title}</h1>
        <div className="course-overview-progress-bar">
          <div
            className="course-overview-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Двухколоночный макет для десктопа */}
      {window.innerWidth >= 1024 ? (
        <div className="course-layout-container">
          <div className="lesson-sidebar">
            <div className="course-sections-list-wrapper">
              {course.sections?.map((section) => (
                <CourseSection
                  key={section.id}
                  section={section}
                  expanded={!!expandedSections[section.id]}
                  onToggle={() => handleSectionToggle(section.id)}
                  onLessonClick={handleLessonClick}
                  activeLessonId={activeLessonId}
                />
              ))}
            </div>
          </div>
          <div className="lesson-content-area">
            {lessonLoading ? (
              <div className="lesson-placeholder">Загрузка урока...</div>
            ) : lessonError ? (
              <div className="lesson-placeholder">{lessonError}</div>
            ) : activeLessonId && lessonData ? (
              <LessonContent
                lesson={lessonData}
                isCompleted={lessonCompleted}
                onMarkComplete={handleMarkComplete}
                prevLesson={prevLesson}
                nextLesson={nextLesson}
                onNavigate={{
                  menu: () => setActiveLessonId(null),
                  prev: prevLesson ? () => setActiveLessonId(prevLesson.id) : undefined,
                  next: nextLesson ? () => setActiveLessonId(nextLesson.id) : undefined,
                }}
              />
            ) : (
              <div className="lesson-placeholder">Выберите урок слева</div>
            )}
          </div>
        </div>
      ) : (
        // Мобильная версия — только список секций и уроков
        <div className="course-overview-content-list">
          {course.sections?.map((section) => (
            <CourseSection
              key={section.id}
              section={section}
              expanded={!!expandedSections[section.id]}
              onToggle={() => handleSectionToggle(section.id)}
              onLessonClick={handleLessonClick}
              activeLessonId={activeLessonId}
            />
          ))}
        </div>
      )}

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
