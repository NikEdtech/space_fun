# SPACE Runner: Community Orbit

Мини-игра в жанре endless runner на чистом HTML5 Canvas (без сборщиков и библиотек).

## Локальный запуск

### Вариант A: просто открыть файл
1. Скачайте/клонируйте репозиторий.
2. Откройте `index.html` в браузере.

### Вариант B: через локальный сервер
1. Откройте терминал в папке проекта.
2. Запустите:

```bash
python3 -m http.server 8000
```

3. Откройте в браузере: `http://localhost:8000`

## Как залить проект в GitHub

```bash
git init
git add .
git commit -m "feat: add SPACE Runner canvas game"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## Как включить GitHub Pages

1. В репозитории GitHub откройте **Settings → Pages**.
2. В блоке **Build and deployment** выберите **Deploy from a branch**.
3. Укажите:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Сохраните настройки.
5. После публикации сайт появится по адресу вида:
   `https://<username>.github.io/<repo>/`

## Важно

Для аккаунта GitHub Free, если использовать GitHub Pages для репозитория проекта, сам репозиторий должен быть **публичным**. Это значит, что ссылку сможет открыть любой, у кого она есть.
index.html
index.html
New
+34
-0

<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SPACE Runner: Community Orbit</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="app">
      <header class="hud-top">
        <h1>🚀 SPACE Runner</h1>
        <div class="hud-inline">
          <span>💰 Бюджет: <b id="scoreValue">0</b></span>
          <span>👥 Комьюнити: <b id="communityValue">0</b></span>
          <span>⚡ Энергия: <b id="energyValue">3</b></span>
        </div>
      </header>

      <canvas id="gameCanvas" aria-label="SPACE Runner canvas" role="img"></canvas>

      <section class="bottom-bar">
        <p id="message">Готов к орбитальному забегу?</p>
        <p class="records">
          Рекорды — 💰 <b id="bestScoreValue">0</b>, 👥 <b id="bestCommunityValue">0</b>
        </p>
      </section>

      <div id="overlay" class="overlay"></div>
    </main>

    <script src="main.js"></script>
  </body>
</html>
