import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';
import LessonContent from './LessonContent';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент секции с toggle
const CourseSection = ({ section, onLessonClick, expanded, onToggle, activeLessonId }) => (
  <div className="skool-section">
    <div className="skool-section-header" onClick={onToggle}>
      <span className="skool-section-title">{section.title}</span>
      <span className={`skool-toggle-icon${expanded ? ' expanded' : ''}`}>▼</span>
    </div>
    {expanded && (
      <ul className="skool-lessons-list">
        {section.lessons.map((lesson) => (
          <li
            key={lesson.id}
            className={`skool-lesson-item${lesson.id === activeLessonId ? ' active' : ''}${lesson.completed ? ' completed' : ''}`}
            onClick={() => onLessonClick(lesson.id)}
          >
            <span className="skool-lesson-title">{lesson.title}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [lessonData, setLessonData] = useState(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState(null);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Загрузка курса
  useEffect(() => {
    const fetchCourse = async () => {
      if (!tg?.initData) {
        setError('Приложение должно быть открыто в Telegram.');
        setLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        if (!resp.ok) throw new Error('Не удалось загрузить курс');
        const data = await resp.json();
        setCourse(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId]);

  // Открываем первую секцию по умолчанию
  useEffect(() => {
    if (course?.sections) {
      const initial = {};
      course.sections.forEach((section, idx) => {
        initial[section.id] = idx === 0;
      });
      setExpandedSections(initial);
    }
  }, [course]);

  // Загрузка урока для десктопа
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

  const handleSectionToggle = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleLessonClick = (lessonId) => {
    setActiveLessonId(lessonId);
    if (window.innerWidth < 1024) {
      navigate(`/course/${courseId}/lesson/${lessonId}`);
    }
  };

  // Прогресс курса
  const progress = course?.progress || 0;

  // Layout
  if (loading) return <div className="skool-loading">Загрузка...</div>;
  if (error) return <div className="skool-error">{error}</div>;
  if (!course) return <div className="skool-error">Курс не найден</div>;

  // Десктоп
  if (window.innerWidth >= 1024) {
    return (
      <div className="skool-desktop-layout">
        <aside className="skool-sidebar">
          <div className="skool-course-title">{course.title}</div>
          <div className="skool-progress-bar"><div className="skool-progress-inner" style={{width: `${progress}%`}}></div></div>
          <div className="skool-sections">
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
        </aside>
        <main className="skool-content">
          {lessonLoading ? (
            <div className="skool-placeholder">Загрузка урока...</div>
          ) : lessonError ? (
            <div className="skool-placeholder">{lessonError}</div>
          ) : activeLessonId && lessonData ? (
            <LessonContent
              lesson={lessonData}
              isCompleted={lessonCompleted}
              onMarkComplete={() => {}}
              prevLesson={null}
              nextLesson={null}
              onNavigate={{}}
            />
          ) : (
            <div className="skool-placeholder">Выберите урок слева</div>
          )}
        </main>
      </div>
    );
  }

  // Мобильная версия
  return (
    <div className="skool-mobile-layout">
      <div className="skool-course-title">{course.title}</div>
      <div className="skool-progress-bar"><div className="skool-progress-inner" style={{width: `${progress}%`}}></div></div>
      <div className="skool-sections">
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
  );
}

export default CourseOverview;
