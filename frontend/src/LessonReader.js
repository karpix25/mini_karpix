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
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  // Моковые данные курса
  const mockCourse = {
    title: "Введение в разработку",
    sections: [
      {
        id: "introduction",
        title: "🚀 Introduction",
        lessons: [
          { id: "welcome", title: "Welcome!", completed: false },
          { id: "setup", title: "Project Setup", completed: false }
        ]
      },
      {
        id: "basics", 
        title: "📚 Basics",
        lessons: [
          { id: "html", title: "HTML Basics", completed: false },
          { id: "css", title: "CSS Introduction", completed: false }
        ]
      }
    ]
  };

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate(`/course/${courseId}`);
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate, courseId]);

  // Загрузка данных урока
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        if (tg?.initData) {
          const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
            headers: { 'X-Init-Data': tg.initData }
          });
          
          if (response.ok) {
            const lessonData = await response.json();
            setLesson(lessonData);
          } else {
            throw new Error('Урок не найден');
          }
        } else {
          // Моковые данные
          setLesson({
            id: lessonId,
            title: "Добро пожаловать в курс!",
            content: `# Добро пожаловать!

Это урок "${lessonId}" из курса "${courseId}".

## Содержание урока

- Основы веб-разработки
- Практические навыки
- Современные технологии

## Следующие шаги

1. Изучите материал
2. Выполните задания
3. Переходите дальше

Удачи в обучении! 🚀`
          });
        }
      } catch (error) {
        console.error('Ошибка загрузки урока:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [courseId, lessonId]);

  const handleMarkComplete = () => {
    setIsCompleted(!isCompleted);
    console.log(`Урок ${lessonId} отмечен как завершенный`);
  };

  const goBackToCourse = () => {
    navigate(`/course/${courseId}`);
  };

  // Найти все уроки для навигации
  const getAllLessons = () => {
    const allLessons = [];
    mockCourse.sections.forEach(section => {
      section.lessons.forEach(lessonItem => {
        allLessons.push(lessonItem);
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

  if (!lesson) {
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
          <h3 className="course-name">{mockCourse.title}</h3>
        </div>
        
        <div className="sidebar-content">
          {mockCourse.sections.map((section) => (
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
            {lesson.content}
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
