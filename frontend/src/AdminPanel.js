import React, { useEffect, useState } from 'react';

const BACKEND_URL = "https://miniback.karpix.com";
const tg = window.Telegram?.WebApp;

export default function AdminPanel() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/courses`, {
          headers: tg?.initData ? { 'X-Init-Data': tg.initData } : {}
        });
        if (!resp.ok) throw new Error('Не удалось загрузить курсы');
        const data = await resp.json();
        setCourses(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  return (
    <div style={{maxWidth: 900, margin: '0 auto', padding: 32}}>
      <h1 style={{fontSize: 28, fontWeight: 800, marginBottom: 24}}>Админ-панель: Курсы</h1>
      <button style={{marginBottom: 24, padding: '10px 22px', fontSize: 16, borderRadius: 8, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer'}}>
        + Добавить курс
      </button>
      {loading ? (
        <div>Загрузка...</div>
      ) : error ? (
        <div style={{color: 'red'}}>{error}</div>
      ) : (
        <ul style={{listStyle: 'none', padding: 0}}>
          {courses.map(course => (
            <li key={course.id} style={{background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontWeight: 700, fontSize: 18}}>{course.title}</div>
                <div style={{color: '#888', fontSize: 14}}>{course.description}</div>
              </div>
              <button style={{background: '#f7f7f7', border: '1px solid #eee', borderRadius: 6, padding: '6px 16px', fontWeight: 500, cursor: 'pointer'}}>Редактировать</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 