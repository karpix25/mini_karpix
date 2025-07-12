// frontend/src/CourseOverview.js

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Плагин для таблиц и другого GFM-синтаксиса
import useMediaQuery from './hooks/useMediaQuery';
import './CourseOverview.css';
import './LessonReader.css'; 

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// --- НОВЫЕ КОМПОНЕНТЫ ДЛЯ ЧИТАЛКИ ---

// Кастомный компонент для блоков кода с кнопкой "Копировать"
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // Сбрасываем состояние через 2 секунды
  };

  return !inline ? (
    <div className="code-block-wrapper">
      <pre className={className} {...props}>
        <code>{children}</code>
      </pre>
      <button className="copy-code-button" onClick={handleCopy}>
        {isCopied ? 'Скопировано!' : 'Копировать'}
      </button>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

// Иконка-галочка для завершения урока
const CompleteCheckmark = ({ isCompleted, onClick }) => (
  <div 
    className={`complete-checkmark ${isCompleted ? 'completed' : ''}`}
    onClick={onClick}
    title={isCompleted ? "Урок пройден" : "Отметить как пройденный"}
  >
    <svg viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
    </svg>
  </div>
);


// --- КОМПОНЕНТЫ СПИСКА УРОКОВ (без изменений) ---
const LessonListItem = ({ lesson, onLessonClick, isSelected }) => { /* ... ваш код без изменений ... */ };
const CourseSection = ({ section, onLessonClick, isInitiallyExpanded, selectedLessonId }) => { /* ... ваш код без изменений ... */ };

// --- ОСНОВНОЙ КОМПОНЕНТ ---
function CourseOverview() {
  // ... (Ваши хуки и состояния до return остаются почти без изменений) ...
  const [isLessonCompleted, setIsLessonCompleted] = useState(false); // Для примера
  const handleCompleteLesson = () => {
    setIsLessonCompleted(!isLessonCompleted);
    // TODO: Здесь будет логика отправки запроса на бэкенд о завершении
    if(tg) tg.HapticFeedback.notificationOccurred('success');
  }

  // ... (Код до return без изменений)

  // ... (Блоки loading, error, !course без изменений) ...

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
      {/* Левая колонка - без изменений */}
      <div className="lesson-sidebar">
        {/* ... */}
      </div>

      {/* --- ОБНОВЛЕННАЯ ПРАВАЯ КОЛОНКА --- */}
      <div className="lesson-content-area">
        {isLessonLoading && (
          <div className="common-loading-error-state"><div className="loading-spinner"></div></div>
        )}
        {!isLessonLoading && lessonContent && (
          // Добавляем обертку для центрирования контента
          <div className="lesson-content-wrapper"> 
            <div className="lesson-reader-header">
              <h1 className="lesson-title">{selectedLesson?.title}</h1>
              <CompleteCheckmark 
                isCompleted={isLessonCompleted}
                onClick={handleCompleteLesson}
              />
            </div>
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]} // <-- Включаем GFM
                components={{
                  code: CodeBlock, // <-- Используем наш кастомный компонент для кода
                }}
              >
                {lessonContent}
              </ReactMarkdown>
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

// ... экспорты и другие компоненты без изменений
export default CourseOverview;
