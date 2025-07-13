import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function LessonContent({ lesson, isCompleted, onMarkComplete, prevLesson, nextLesson, onNavigate, course }) {
  if (!lesson) {
    return <div className="lesson-reader-container common-loading-error-state">Урок не найден</div>;
  }

  return (
    <div className="lesson-reader-container minimal-mobile-lesson">
      {/* Название курса */}
      {course?.title && (
        <div className="lesson-course-title-minimal">{course.title}</div>
      )}
      {/* Название урока */}
      <h1 className="lesson-title-minimal">{lesson.title}</h1>
      {/* Картинка, если есть */}
      {lesson.image && (
        <img src={lesson.image} alt="lesson" className="lesson-image-minimal" />
      )}
      {/* Навигация */}
      <div className="lesson-nav-minimal">
        {onNavigate && (
          <button className="nav-text-btn-minimal" onClick={onNavigate.menu}>Menu</button>
        )}
        {prevLesson && onNavigate && (
          <button className="nav-text-btn-minimal" onClick={onNavigate.prev}>Назад</button>
        )}
        {nextLesson && onNavigate && (
          <button className="nav-text-btn-minimal" onClick={onNavigate.next}>Вперёд</button>
        )}
      </div>
      {/* Контент урока */}
      <div className="lesson-content-minimal markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.content || '# Урок\n\nСодержимое урока загружается...'}</ReactMarkdown>
      </div>
    </div>
  );
}

export default LessonContent; 