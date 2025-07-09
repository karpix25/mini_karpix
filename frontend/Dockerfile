# --- Стадия 1: Сборка React-приложения ---
FROM node:18-alpine AS build

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код приложения
COPY . .

# Собираем приложение для продакшена
RUN npm run build

# --- Стадия 2: Запуск на Nginx ---
FROM nginx:1.23-alpine

# Копируем собранные статические файлы из стадии 'build' в папку Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Удаляем стандартную конфигурацию Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Копируем нашу собственную конфигурацию
COPY nginx.conf /etc/nginx/conf.d

# Открываем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
