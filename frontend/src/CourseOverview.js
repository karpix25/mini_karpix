// frontend/src/CourseOverview.js

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import useMediaQuery from './hooks/useMediaQuery';
import './CourseOverview.css';
import './LessonReader.css'; 

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

const LessonListItem = ({ lesson, onLessonClick, isSelected }) => {
  return (
    <li
      className={`lesson-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onLessonClick(lesson)}
    >
      <span className="lesson-item-number">{lesson.sort_order}</span>
      <span className="lesson-item-title">{lesson.title}</span>
    </li>
  );
};

const CourseSection = ({ section, onLessonClick, isInitiallyExpanded, selectedLessonId }) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const handleToggle = () => setIsExpanded(prev => !prev);

  return (
    <div className="course-section-group">
      <div className="course-section-header" onClick={handleToggle}>
        <div className={`toggle-icon-wrapper ${isExpanded ? 'expanded' : ''}`}>
          <svg className="toggle-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
              onLessonClick={onLessonClick}
              isSelected={lesson.id === selectedLessonId}
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

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [lessonContent, setLessonContent] = useState(null);
  const [isLessonLoading, setIsLessonLoading] = useState(false);
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null);

  const selectedLesson = useMemo(() => {
    if (!course || !selectedLessonId) return null;
    for (const section of course.sections) {
      const found = section.lessons.find(l => l.id === selectedLessonId);
      if (found) return found;
    }
    return null;
  }, [course, selectedLessonId]);

  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content'); 
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCourseData = async () => {
      setLoading(true);
      try {
        if (!tg?.initData) throw new Error("Приложение должно быть открыто в Telegram.");
        
        const headers = { 'X-Init-Data': tg.initData };
        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, { headers });
        
        if (!courseResponse.ok) {
          if (courseResponse.status === 404) throw new Error('Курс не найден');
          if (courseResponse.status === 403) throw new Error('Недостаточно прав');
          throw new Error('Не удалось загрузить курс');
        }
        
        const courseData = await courseResponse.json();
        setCourse(courseData);
        
        if (isDesktop && !selectedLessonId && courseData.sections?.[0]?.lessons?.[0]) {
          setSelectedLessonId(courseData.sections[0].lessons[0].id);
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseData();
  }, [courseId, navigate]); // Убрали isDesktop отсюда, чтобы не было перезагрузок

  useEffect(() => {
    if (!selectedLessonId || !isDesktop) {
      setLessonContent(null);
      return;
    }

    const fetchLessonContent = async () => {
      setIsLessonLoading(true);
      try {
        const headers = { 'X-Init-Data': tg.initData };
        const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${selectedLessonId}`, { headers });
        if (!response.ok) throw new Error("Не удалось загрузить урок");
        const data = await response.json();
        setLessonContent(data.content);
      } catch (err) {
        console.error("Ошибка загрузки контента урока:", err);
      } finally {
        setIsLessonLoading(false);
      }
    };

    fetchLessonContent();
  }, [selectedLessonId, courseId, isDesktop]);

  const handleLessonClick = (lesson) => {
    if (isDesktop) {
      setSelectedLessonId(lesson.id);
    } else {
      navigate(`/course/${courseId}/lesson/${lesson.id}`);
    }
  };

  // --- СОХРАНЯЕМ ВАШИ ОРИГИНАЛЬНЫЕ БЛОКИ ЗАГРУЗКИ И ОШИБОК ---
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
        <p>{error.message}</p>
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
    <div className="course-layout-container">
      <div className="lesson-sidebar">
        <div className="course-simple-header">
          <h1 className="course-simple-title">{course.title}</h1>
          <div className="course-simple-progress-bar">
            <div className="course-simple-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
            <span className="progress-percentage-text">{progressPercentage}%</span>
          </div>
        </div>
        <div className="course-sections-list-wrapper">
          {course.sections?.map((section, index) => (
            <CourseSection
              key={section.id}
              section={section}
              onLessonClick={handleLessonClick}
              isInitiallyExpanded={true}
              selectedLessonId={selectedLessonId}
            />
          ))}
        </div>
      </div>

      <div className="lesson-content-area">
        {isLessonLoading && (
          <div className="common-loading-error-state"><div className="loading-spinner"></div></div>
        )}
        {!isLessonLoading && lessonContent && (
          <div className="lesson-reader-container">
            <h1 className="lesson-title">{selectedLesson?.title}</h1>
            <div className="markdown-content">
              <ReactMarkdown>{lessonContent}</ReactMarkdown>
            </div>
          </div>
        )}
        {!isLessonLoading && !lessonContent && isDesktop && (
          <div className="lesson-placeholder">
            <h2>Выберите урок слева, чтобы начать обучение</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default CourseOverview;
