// frontend/src/LessonReader.js

// Импорты: добавляем useContext и Link
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Импортируем наш контекст, созданный в CourseOverview
import { CourseContext } from './CourseOverview'; 
import './LessonReader.css'; // Будем использовать новый CSS

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Иконка для кнопки завершения, как в Skool
const CompletionIcon = ({ completed }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.6C10.1013 21.6 8.24524 21.037 6.66653 19.9821C5.08782 18.9272 3.85736 17.4279 3.13076 15.6738C2.40416 13.9196 2.21405 11.9893 2.58447 10.1271C2.95488 8.26491 3.8692 6.55436 5.21178 5.21177C6.55436 3.86919 8.26492 2.95488 10.1271 2.58446C11.9894 2.21404 13.9196 2.40416 15.6738 3.13076C17.4279 3.85736 18.9272 5.08781 19.9821 6.66652C21.037 8.24524 21.6 10.1013 21.6 12C21.6 14.5461 20.5886 16.9879 18.7882 18.7882C16.9879 20.5886 14.5461 21.6 12 21.6Z" fill={completed ? '#34C759' : 'transparent'}/>
        <path d="M15.24 7.66799L10.704 13.668L8.74803 11.136C8.5523 10.8846 8.26471 10.7212 7.94852 10.6818C7.63234 10.6424 7.31346 10.7303 7.06203 10.926C6.81061 11.1217 6.64723 11.4093 6.60785 11.7255C6.56847 12.0417 6.6563 12.3606 6.85203 12.612L9.76803 16.344C9.88104 16.487 10.0251 16.6024 10.1894 16.6814C10.3537 16.7604 10.5338 16.801 10.716 16.8C10.8993 16.7995 11.08 16.7571 11.2443 16.676C11.4087 16.5949 11.5522 16.4772 11.664 16.332L17.148 9.13199C17.3422 8.87738 17.4272 8.55608 17.3845 8.23877C17.3417 7.92146 17.1746 7.63413 16.92 7.43999C16.6654 7.24585 16.3441 7.16081 16.0268 7.20357C15.7095 7.24633 15.4222 7.41338 15.228 7.66799H15.24Z" fill={completed ? '#34C759' : 'currentColor'}/>
    </svg>
);


function LessonReader() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  // 1. Получаем данные из контекста, а не через fetch
  const { course, setCourse } = useContext(CourseContext);

  // 2. Упрощаем состояние: нам нужен только контент, loading и error для самого урока
  const [lessonContent, setLessonContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 3. Логика загрузки ТЕПЕРЬ ТОЛЬКО ДЛЯ КОНТЕНТА УРОКА
  useEffect(() => {
    setLoading(true);
    const fetchLessonContent = async () => {
      if (!tg?.initData) {
        setError("Приложение должно быть открыто в Telegram.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        if (!response.ok) {
          if (response.status === 404) throw new Error('Урок не найден');
          throw new Error('Не удалось загрузить контент урока');
        }
        const data = await response.json();
        setLessonContent(data.content);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLessonContent();
  }, [courseId, lessonId]);

  // 4. Обновляем handleMarkComplete для работы с контекстом
  const handleMarkComplete = async () => {
    if (!tg?.initData || !setCourse) return;

    const currentStatus = course.sections.flatMap(s => s.lessons).find(l => l.id === lessonId)?.completed;

    // Оптимистичное обновление UI
    if(tg) tg.HapticFeedback.impactOccurred('light');
    setCourse(prevCourse => {
        const newSections = prevCourse.sections.map(section => ({
            ...section,
            lessons: section.lessons.map(l => l.id === lessonId ? { ...l, completed: !l.completed } : l)
        }));
        const allLessons = newSections.flatMap(s => s.lessons);
        const completedCount = allLessons.filter(l => l.completed).length;
        const newProgress = Math.round((completedCount / allLessons.length) * 100);
        return { ...prevCourse, sections: newSections, progress: newProgress };
    });

    try {
      // Отправляем запрос на сервер
      await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: { 'X-Init-Data': tg.initData }
      });
    } catch (error) {
        // Если ошибка, откатываем изменение в UI
        console.error('Ошибка при отметке урока:', error);
        alert('Не удалось сохранить статус урока. Пожалуйста, попробуйте еще раз.');
        setCourse(prevCourse => {
            const newSections = prevCourse.sections.map(section => ({
                ...section,
                lessons: section.lessons.map(l => l.id === lessonId ? { ...l, completed: currentStatus } : l)
            }));
            return { ...prevCourse, sections: newSections };
        });
    }
  };
  
  // 5. Данные для навигации и отображения теперь берутся напрямую из `course` (из контекста)
  const allLessons = course?.sections?.flatMap(s => s.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const currentLessonMeta = allLessons[currentIndex];

  // Рендеринг состояний
  if (loading) {
    return (
      <div className="common-loading-error-state">
        <div className="loading-spinner"></div>
        <p>Загружается урок...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="common-loading-error-state">
        <h2>Ошибка</h2><p>{error}</p>
      </div>
    );
  }

  if (!currentLessonMeta) {
    // Это состояние может возникнуть на мгновение, пока данные курса из контекста не загрузились
    return null; 
  }

  // 6. Финальный рендеринг в стиле Skool
  return (
    <div className="lesson-reader-container">
        <div className="lesson-header">
            <h1 className="lesson-title">{currentLessonMeta.title}</h1>
            <button 
                className={`completion-button ${currentLessonMeta.completed ? 'completed' : ''}`}
                onClick={handleMarkComplete}
                title={currentLessonMeta.completed ? "Отмечен как завершенный" : "Отметить как завершенный"}
            >
                <CompletionIcon completed={currentLessonMeta.completed} />
            </button>
        </div>

        {currentLessonMeta.video_url && (
            <div className="lesson-video-wrapper">
                <iframe 
                    src={currentLessonMeta.video_url}
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    title={currentLessonMeta.title}
                ></iframe>
            </div>
        )}
        
        <div className="lesson-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent}</ReactMarkdown>
        </div>

        {/* Навигация как в Skool - отсутствует. Пользователь кликает в сайдбар. */}
        {/* Можно добавить опционально для мобильных, но для чистоты дизайна убираем. */}
    </div>
  );
}

export default LessonReader;
