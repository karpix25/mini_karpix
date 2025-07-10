# Основы CSS

CSS (Cascading Style Sheets) - это язык стилей, который отвечает за внешний вид веб-страниц. Если HTML - это скелет, то CSS - это кожа и одежда!

## Что такое CSS?

CSS позволяет:
- 🎨 Изменять цвета и шрифты
- 📐 Управлять размерами и расположением
- ✨ Добавлять анимации и эффекты
- 📱 Создавать адаптивный дизайн

## Способы подключения CSS

### 1. Внутренние стили
```html
<head>
    <style>
        h1 { color: blue; }
    </style>
</head>
```

### 2. Внешний файл (рекомендуется)
```html
<head>
    <link rel="stylesheet" href="styles.css">
</head>
```

### 3. Инлайн стили
```html
<h1 style="color: red;">Заголовок</h1>
```

## Синтаксис CSS

```css
селектор {
    свойство: значение;
    другое-свойство: другое-значение;
}
```

## Основные селекторы

### Селектор по тегу
```css
h1 {
    color: #333;
    font-size: 24px;
}
```

### Селектор по классу
```css
.my-class {
    background-color: lightblue;
    padding: 10px;
}
```

### Селектор по ID
```css
#my-id {
    border: 1px solid black;
    margin: 20px;
}
```

## Популярные CSS свойства

### Текст и шрифты
```css
.text-style {
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #333;
    text-align: center;
    line-height: 1.5;
}
```

### Отступы и размеры
```css
.box-model {
    width: 300px;
    height: 200px;
    padding: 20px;      /* Внутренние отступы */
    margin: 10px;       /* Внешние отступы */
    border: 2px solid red;
}
```

### Фон и цвета
```css
.background-style {
    background-color: #f0f0f0;
    background-image: url('image.jpg');
    background-size: cover;
    background-position: center;
}
```

## Flexbox - современная раскладка

```css
.flex-container {
    display: flex;
    justify-content: center;    /* Горизонтальное выравнивание */
    align-items: center;        /* Вертикальное выравнивание */
    gap: 20px;                  /* Расстояние между элементами */
}
```

## Адаптивный дизайн

```css
/* Стили для мобильных устройств */
@media (max-width: 768px) {
    .container {
        padding: 10px;
        font-size: 14px;
    }
}

/* Стили для планшетов */
@media (min-width: 769px) and (max-width: 1024px) {
    .container {
        padding: 20px;
    }
}
```

## Практический пример

HTML:
```html
<div class="card">
    <h2 class="card-title">Заголовок карточки</h2>
    <p class="card-text">Текст карточки с описанием.</p>
    <button class="card-button">Кнопка</button>
</div>
```

CSS:
```css
.card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    max-width: 300px;
}

.card-title {
    color: #333;
    margin-bottom: 10px;
}

.card-text {
    color: #666;
    line-height: 1.5;
}

.card-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
}

.card-button:hover {
    background: #0056b3;
}
```

## Полезные ресурсы

- 📚 [MDN CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS)
- 🎮 [CSS Grid Garden](https://cssgridgarden.com/) - игра для изучения CSS Grid
- 🐸 [Flexbox Froggy](https://flexboxfroggy.com/) - игра для изучения Flexbox

## Домашнее задание

Создайте простую веб-страницу с:
1. Красивой карточкой профиля
2. Градиентным фоном
3. Адаптивным дизайном для мобильных

---

🎯 **Следующий этап:** Изучите JavaScript для добавления интерактивности!
