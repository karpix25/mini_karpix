import React, { useEffect, useState } from 'react';
import AdminEditor from './admin/AdminEditor';

const BACKEND_URL = "https://miniback.karpix.com";
const tg = window.Telegram?.WebApp;

const initialForm = {
  name: '',
  description: '',
  cover_image_url: '',
  access_type: 'level',
  access_level: 1,
  access_days: ''
};

export default function AdminPanel() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [lessonContent, setLessonContent] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

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

  const handleOpenModal = () => {
    setForm(initialForm);
    setFormError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tg?.initData ? { 'X-Init-Data': tg.initData } : {})
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          cover_image_url: form.cover_image_url,
          access_type: form.access_type,
          access_level: Number(form.access_level),
          access_days: form.access_days ? Number(form.access_days) : null
        })
      });
      if (!resp.ok) throw new Error('Ошибка при создании курса');
      setShowModal(false);
      setForm(initialForm);
      await fetchCourses();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCourse = (course) => {
    setSelectedCourse(course);
    setShowEditor(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !lessonContent) return;
    
    try {
      const resp = await fetch(`${BACKEND_URL}/api/courses/${selectedCourse.id}/lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tg?.initData ? { 'X-Init-Data': tg.initData } : {})
        },
        body: JSON.stringify({
          title: 'Новый урок',
          description: 'Описание урока',
          content: lessonContent,
          lesson_type: 'text',
          order_index: 1,
          duration_minutes: 15,
          is_published: true
        })
      });
      
      if (!resp.ok) throw new Error('Ошибка при сохранении урока');
      
      setShowEditor(false);
      setSelectedCourse(null);
      setLessonContent('');
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }
  };

  if (showEditor) {
    return (
      <div style={{maxWidth: 1200, margin: '0 auto', padding: 32}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
          <h1 style={{fontSize: 28, fontWeight: 800, margin: 0}}>
            Редактор урока: {selectedCourse?.title}
          </h1>
          <div style={{display: 'flex', gap: 12}}>
            <button 
              onClick={() => setShowEditor(false)}
              style={{padding: '8px 16px', background: '#f7f7f7', border: '1px solid #eee', borderRadius: 6, cursor: 'pointer'}}
            >
              Отмена
            </button>
            <button 
              onClick={handleSaveLesson}
              style={{padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer'}}
            >
              Сохранить
            </button>
          </div>
        </div>
        <AdminEditor value={lessonContent} onChange={setLessonContent} />
      </div>
    );
  }

  return (
    <div style={{maxWidth: 900, margin: '0 auto', padding: 32}}>
      <h1 style={{fontSize: 28, fontWeight: 800, marginBottom: 24}}>Админ-панель: Курсы</h1>
      <button onClick={handleOpenModal} style={{marginBottom: 24, padding: '10px 22px', fontSize: 16, borderRadius: 8, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer'}}>
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
              <button 
                onClick={() => handleEditCourse(course)}
                style={{background: '#f7f7f7', border: '1px solid #eee', borderRadius: 6, padding: '6px 16px', fontWeight: 500, cursor: 'pointer'}}
              >
                Редактировать
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Модалка создания курса */}
      {showModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <form onSubmit={handleSubmit} style={{background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: 32, minWidth: 340, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
            <h2 style={{margin: 0, fontSize: 22, fontWeight: 700}}>Новый курс</h2>
            <label>
              Название курса
              <input name="name" value={form.name} onChange={handleChange} required style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4}} />
            </label>
            <label>
              Описание
              <textarea name="description" value={form.description} onChange={handleChange} style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4, minHeight: 60}} />
            </label>
            <label>
              Картинка (URL)
              <input name="cover_image_url" value={form.cover_image_url} onChange={handleChange} style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4}} />
            </label>
            <label>
              Тип доступа
              <select name="access_type" value={form.access_type} onChange={handleChange} style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4}}>
                <option value="level">По уровню</option>
                <option value="days">По времени</option>
                <option value="private">Только по ссылке</option>
              </select>
            </label>
            <label>
              Уровень доступа
              <input name="access_level" type="number" min="1" value={form.access_level} onChange={handleChange} style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4}} />
            </label>
            <label>
              Количество дней доступа
              <input name="access_days" type="number" min="0" value={form.access_days} onChange={handleChange} style={{width: '100%', padding: 8, borderRadius: 6, border: '1px solid #eee', marginTop: 4}} />
            </label>
            {formError && <div style={{color: 'red', fontSize: 14}}>{formError}</div>}
            <div style={{display: 'flex', gap: 12, marginTop: 8}}>
              <button type="button" onClick={handleCloseModal} style={{flex: 1, background: '#f7f7f7', border: '1px solid #eee', borderRadius: 6, padding: '10px 0', fontWeight: 500, cursor: 'pointer'}}>Отмена</button>
              <button type="submit" disabled={saving} style={{flex: 1, background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontWeight: 600, cursor: 'pointer'}}>
                {saving ? 'Сохраняю...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 