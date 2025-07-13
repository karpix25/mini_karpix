import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Если нужна подсветка синтаксиса, то потребуется дополнительная библиотека, например, react-syntax-highlighter
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Пример темной темы для кода
import './LessonReader.css';
import LessonContent from './LessonContent';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

function LessonReader() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null); // Курс нужен для навигации по урокам
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate(`/course/${courseId}`); // Назад к обзору курса
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
        const headers = { 'X-Init-Data': tg.initData };
        
        // Загружаем данные курса (для навигации по урокам)
        const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, { headers });
        if (!courseResponse.ok) throw new Error("Ошибка загрузки данных курса");
        const courseData = await courseResponse.json();
        setCourse(courseData);
        
        // Загружаем содержимое урока
        const lessonResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, { headers });
        if (!lessonResponse.ok) {
          if (lessonResponse.status === 404) { throw new Error('Урок не найден'); }
          if (lessonResponse.status === 403) { throw new Error('Недостаточно прав для доступа к уроку'); }
          throw new Error('Не удалось загрузить урок');
        }
        
        const lessonData = await lessonResponse.json();
        setLesson(lessonData);
        
        // Проверяем статус завершения урока
        const currentLessonInCourse = courseData.sections
          ?.flatMap(section => section.lessons)
          ?.find(l => l.id === lessonId);
        if (currentLessonInCourse) {
          setIsCompleted(currentLessonInCourse.completed || false);
        }
        
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
        setIsCompleted(!isCompleted); // Переключаем статус
        console.log(`Урок ${lessonId} отмечен как завершенный/незавершенный`);
        // Опционально: оповестить Telegram Haptic Feedback
        if (tg) tg.HapticFeedback.impactOccurred('light');
      } else {
        const errorData = await response.json();
        console.error('Ошибка при отметке урока:', errorData);
        alert(`Не удалось обновить статус: ${errorData.detail || 'Ошибка сети'}`);
      }
    } catch (error) {
      console.error('Ошибка при отметке урока:', error);
      alert(`Не удалось обновить статус: ${error.message}`);
    }
  };

  // Найти все уроки для навигации
  const getAllLessons = () => {
    if (!course?.sections) return [];
    
    const allLessons = [];
    course.sections.forEach(section => {
      section.lessons.forEach(lessonItem => {
        allLessons.push({
          ...lessonItem,
          sectionId: section.id, // Добавляем sectionId для полной навигации
        });
      });
    });
    // Сортировка, если уроки не гарантированно приходят отсортированными
    allLessons.sort((a, b) => a.sort_order - b.sort_order);
    return allLessons;
  };

  const allLessons = getAllLessons();
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="lesson-reader-container common-loading-error-state">
        <div className="loading-spinner"></div>
        <p>Загружается урок...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-reader-container common-loading-error-state">
        <h2>Ошибка загрузки</h2>
        <p>{error}</p>
        <button onClick={() => navigate(`/course/${courseId}`)} className="back-button">
          ← Вернуться к курсу
        </button>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="lesson-reader-container common-loading-error-state">
        <h2>Урок не найден</h2>
        <button onClick={() => navigate(`/course/${courseId}`)} className="back-button">
          ← Вернуться к курсу
        </button>
      </div>
    );
  }

  // Навигационные обработчики для передачи в LessonContent
  const navHandlers = {
    menu: () => navigate(`/course/${courseId}`),
    prev: prevLesson ? () => navigate(`/course/${courseId}/lesson/${prevLesson.id}`) : undefined,
    next: nextLesson ? () => navigate(`/course/${courseId}/lesson/${nextLesson.id}`) : undefined,
  };

  return (
    <LessonContent
      lesson={lesson}
      isCompleted={isCompleted}
      onMarkComplete={handleMarkComplete}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
      onNavigate={navHandlers}
    />
  );
}

export default LessonReader;
