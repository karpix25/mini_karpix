import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './LessonReader.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

function LessonReader() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate(`/course/${courseId}`);
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate, courseId]);

  // Загрузка данных урока и курса
  useEffect(() => {
    const fetchData = async () => {
      if (!tg?.initData) {
        setError("Приложение должно быть открыто в Telegram.");
        setLoading(false);
        return;
      }

      try {
        // Загружаем данные курса для sidebar
        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (courseResponse.ok) {
          const courseData = await courseResponse.json();
          setCourse(courseData);
          
          // Проверяем завершен ли текущий урок
          const currentLesson = courseData.sections
            ?.flatMap(section => section.lessons)
            ?.find(l => l.id === lessonId);
          
          if (currentLesson) {
            setIsCompleted(currentLesson.completed || false);
          }
        }

        // Загружаем содержимое урока
        const lessonResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!lessonResponse.ok) {
          if (lessonResponse.status === 404) {
            throw new Error('Урок не найден');
          }
          if (lessonResponse.status === 403) {
            throw new Error('Недостаточно прав для доступа к уроку');
          }
          throw new Error('Не удалось загрузить урок');
        }
        
        const lessonData = await lessonResponse.json();
        console.log('Loaded lesson:', lessonData);
        setLesson(lessonData);
        
      } catch (error) {
        console.error('Ошибка загрузки урока:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, lessonId]);

  const handleMarkComplete = async () => {
    if (!tg?.initData) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: { 'X-Init-Data': tg.initData }
      });
      
      if (response.ok) {
        setIsCompleted(!isCompleted);
        console.log(`Урок ${lessonId} отмечен как завершенный`);
      }
    } catch (error) {
      console.error('Ошибка при отметке урока:', error);
    }
  };

  const goBackToCourse = () => {
    navigate(`/course/${courseId}`);
  };

  // Найти все уроки для навигации
  const getAllLessons = () => {
    if (!course?.sections) return [];
    
    const allLessons = [];
    course.sections.forEach(section => {
      section.lessons.forEach(lessonItem => {
        allLessons.push({
          ...lessonItem,
          sectionId: section.id,
          sectionTitle: section.title
        });
      });
    });
    return allLessons;
  };

  const allLessons = getAllLessons();
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="lesson-reader-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Загружается урок...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-reader-container">
        <div className="error-state">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <button onClick={goBackToCourse} className="back-button">
            ← Вернуться к курсу
          </button>
        </div>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="lesson-reader-container">
        <div className="error-state">
          <h2>Урок не найден</h2>
          <button onClick={goBackToCourse} className="back-button">
            ← Вернуться к курсу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-reader-container">
      {/* Левый sidebar */}
      <div className="lesson-sidebar">
        <div className="sidebar-header">
          <h3 className="course-name">{course.title}</h3>
        </div>
        
        <div className="sidebar-content">
          {course.sections?.map((section) => (
            <div key={section.id} className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="section-title">{section.title}</span>
              </div>
              <div className="sidebar-lessons">
                {section.lessons.map((lessonItem) => (
                  <div 
                    key={lessonItem.id}
                    className={`sidebar-lesson ${lessonItem.id === lessonId ? 'active' : ''}`}
                    onClick={() => navigate(`/course/${courseId}/lesson/${lessonItem.id}`)}
                  >
                    <span className="lesson-icon">
                      {lessonItem.completed ? '✅' : '📄'}
                    </span>
                    <span className="lesson-title">{lessonItem.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Основной контент */}
      <div className="lesson-main-content">
        {/* Мобильная навигация */}
        <div className="mobile-navigation">
          <button className="back-to-course" onClick={goBackToCourse}>
            ← Menu
          </button>
        </div>

        {/* Заголовок урока */}
        <div className="lesson-header">
          <h1 className="lesson-title">{lesson.title}</h1>
          <button 
            className={`complete-button ${isCompleted ? 'completed' : ''}`}
            onClick={handleMarkComplete}
          >
            {isCompleted ? (
              <div className="completion-check">✓</div>
            ) : (
              <div className="completion-circle"></div>
            )}
          </button>
        </div>

        {/* Markdown контент */}
        <div className="lesson-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {lesson.content || '# Урок\n\nСодержимое урока загружается...'}
          </ReactMarkdown>
        </div>

        {/* Навигация между уроками */}
        <div className="lesson-navigation">
          {prevLesson && (
            <button 
              className="nav-button prev"
              onClick={() => navigate(`/course/${courseId}/lesson/${prevLesson.id}`)}
            >
              ← Previous
            </button>
          )}
          
          {nextLesson && (
            <button 
              className="nav-button next"
              onClick={() => navigate(`/course/${courseId}/lesson/${nextLesson.id}`)}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonReader;
