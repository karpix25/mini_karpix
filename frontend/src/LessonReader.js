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
  const [lessonData, setLessonData] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate(`/course/${courseId}`);
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate, courseId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!tg?.initData || !courseId || !lessonId) return;
      
      try {
        // Загружаем урок и информацию о курсе параллельно
        const [lessonResponse, courseResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
            headers: { 'X-Init-Data': tg.initData }
          }),
          fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
            headers: { 'X-Init-Data': tg.initData }
          })
        ]);
        
        if (!lessonResponse.ok) {
          throw new Error('Не удалось загрузить урок');
        }
        
        if (!courseResponse.ok) {
          throw new Error('Не удалось загрузить информацию о курсе');
        }
        
        const lesson = await lessonResponse.json();
        const course = await courseResponse.json();
        
        setLessonData(lesson);
        setCourseData(course);
        
        // TODO: Загрузить реальный статус завершения
        setIsCompleted(false);
        
      } catch (error) {
        console.error('Ошибка при загрузке урока:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, lessonId]);

  const handleMarkComplete = () => {
    setIsCompleted(!isCompleted);
    // TODO: API вызов для сохранения прогресса
    console.log(`Урок ${lessonId} отмечен как ${!isCompleted ? 'завершенный' : 'незавершенный'}`);
  };

  const goBackToCourse = () => {
    navigate(`/course/${courseId}`);
  };

  // Находим текущий урок и навигацию
  const getCurrentLessonInfo = () => {
    if (!courseData) return null;
    
    let currentLessonIndex = -1;
    let allLessons = [];
    
    // Собираем все уроки из всех разделов
    courseData.sections.forEach(section => {
      section.lessons.forEach(lesson => {
        allLessons.push({
          ...lesson,
          sectionId: section.id,
          sectionTitle: section.title
        });
      });
    });
    
    // Находим индекс текущего урока
    currentLessonIndex = allLessons.findIndex(lesson => lesson.id === lessonId);
    
    return {
      currentIndex: currentLessonIndex,
      lessons: allLessons,
      prev: currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null,
      next: currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null
    };
  };

  const navigationInfo = getCurrentLessonInfo();

  const handlePrevLesson = () => {
    if (navigationInfo?.prev) {
      navigate(`/course/${courseId}/lesson/${navigationInfo.prev.id}`);
    }
  };

  const handleNextLesson = () => {
    if (navigationInfo?.next) {
      navigate(`/course/${courseId}/lesson/${navigationInfo.next.id}`);
    }
  };

  if (loading) {
    return (
      <div className="lesson-reader-container">
        <div className="loading-state">Загрузка урока...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-reader-container">
        <div className="error-state">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <button onClick={goBackToCourse} className="back-button">
            ← Вернуться к курсу
          </button>
        </div>
      </div>
    );
  }

  if (!lessonData) {
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
      {/* Мобильная навигация */}
      <div className="mobile-navigation">
        <button className="back-to-course" onClick={goBackToCourse}>
          ← {courseData?.title || 'Курс'}
        </button>
      </div>

      {/* Заголовок урока */}
      <div className="lesson-header">
        <h1 className="lesson-title">{lessonData.title}</h1>
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

      {/* Контент урока */}
      <div className="lesson-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {lessonData.content || "Контент урока загружается..."}
        </ReactMarkdown>
      </div>

      {/* Навигация между уроками */}
      <div className="lesson-navigation">
        {navigationInfo?.prev && (
          <button 
            className="nav-button prev"
            onClick={handlePrevLesson}
          >
            ← {navigationInfo.prev.title}
          </button>
        )}
        
        {navigationInfo?.next && (
          <button 
            className="nav-button next"
            onClick={handleNextLesson}
          >
            {navigationInfo.next.title} →
          </button>
        )}
      </div>

      {/* Информация о прогрессе */}
      {navigationInfo && (
        <div className="lesson-progress-info">
          <span>
            Урок {navigationInfo.currentIndex + 1} из {navigationInfo.lessons.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default LessonReader;
