import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function LessonContent({ lesson, isCompleted, onMarkComplete, prevLesson, nextLesson, onNavigate }) {
  if (!lesson) {
    return <div className="lesson-reader-container common-loading-error-state">Урок не найден</div>;
  }

  return (
    <div className="lesson-reader-container">
      {/* Верхний хедер с заголовком урока и кнопками навигации */}
      <div className="lesson-top-header">
        {onNavigate && (
          <button className="nav-text-button" onClick={onNavigate.menu}>
            ← Menu
          </button>
        )}
        <h1 className="lesson-top-title">{lesson.title}</h1>
        {onNavigate && (
          <button className="nav-text-button" onClick={onNavigate.next} disabled={!nextLesson}>
            Next →
          </button>
        )}
      </div>

      {/* Основной контент урока */}
      <div className="lesson-main-content-wrapper markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {lesson.content || '# Урок\n\nСодержимое урока загружается...'}
        </ReactMarkdown>
      </div>

      {/* Нижняя навигация между уроками */}
      <div className="lesson-bottom-navigation">
        {prevLesson && onNavigate && (
          <button className="bottom-nav-button" onClick={onNavigate.prev}>
            ← Previous Lesson
          </button>
        )}
        {onMarkComplete && (
          <button
            className={`bottom-complete-button ${isCompleted ? 'completed' : ''}`}
            onClick={onMarkComplete}
            title={isCompleted ? 'Урок завершен' : 'Отметить как завершенный'}
          >
            {isCompleted ? 'Завершено ✓' : 'Отметить как завершенный'}
          </button>
        )}
        {nextLesson && onNavigate && (
          <button className="bottom-nav-button" onClick={onNavigate.next}>
            Next Lesson →
          </button>
        )}
      </div>
    </div>
  );
}

export default LessonContent; 