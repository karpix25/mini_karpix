// src/CourseLessonContent.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CourseContext } from './CourseLayout';
import './CourseLessonContent.css';

function CourseLessonContent() {
  const { lessonId } = useParams();
  const { course, setCourse } = useContext(CourseContext);

  const [lessonContent, setLessonContent] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
      // Загружаем только контент урока
      const fetchLessonContent = async () => {
        // ... ваша логика fetch для `/api/courses/{courseId}/lessons/${lessonId}`
        // В конце: setLessonContent(data.content); setLoading(false);
      };
      fetchLessonContent();
  }, [lessonId]);

  const handleMarkComplete = () => {
    // Ваша логика с optimistic update через setCourse из контекста
  };

  if (loading || !course) return <div>Загрузка урока...</div>;

  const currentLesson = course.sections?.flatMap(s => s.lessons).find(l => l.id === lessonId);
  if (!currentLesson) return <div>Урок не найден.</div>;

  return (
      <div className="lesson-content-container">
          <div className="lesson-header">
              <h1 className="lesson-title">{currentLesson.title}</h1>
              <button onClick={handleMarkComplete} className={`completion-button ${currentLesson.completed ? 'completed' : ''}`}>
                  {/* Иконка галочки */}
              </button>
          </div>
          {/* ... ваш JSX для видео и markdown ... */}
          <div className="lesson-markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent}</ReactMarkdown>
          </div>
      </div>
  );
}

export default CourseLessonContent;
