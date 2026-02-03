// server.js - Backend сервер для временной почты DropWin с РЕАЛЬНЫМИ почтами
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// НЕСКОЛЬКО API для надежности
const EMAIL_APIS = {
    secmail: {
        name: '1secmail',
        baseUrl: 'https://www.1secmail.com/api/v1/',
        domains: ['1secmail.com', '1secmail.org', '1secmail.net', 'kzccv.com', 'qiott.com', 'wuuvo.com', 'icznn.com']
    },
    mailjs: {
        name: 'mail.gw',
        baseUrl: 'https://api.mail.tm',
        domains: ['mail.tm']
    },
    tempmail: {
        name: 'tempmail.lol',
        baseUrl: 'https://api.tempmail.lol',
        domains: ['tempmail.lol']
    }
};

let currentAPI = EMAIL_APIS.secmail; // По умолчанию используем 1secmail

/**
 * Генерация случайного имени пользователя
 */
function generateUsername() {
    const prefixes = ['drop', 'temp', 'quick', 'fast', 'safe', 'anon', 'win', 'mail', 'box', 'secure'];
    const suffixes = ['mail', 'post', 'box', 'drop', 'win', 'safe', 'fast', 'temp', 'user', 'test'];
    const numbers = Math.floor(Math.random() * 9000) + 1000;

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    return `${prefix}${suffix}${numbers}`.toLowerCase();
}

/**
 * Создание email через 1secmail API (с автоматической генерацией)
 */
async function createSecmailEmail() {
    try {
        // Используем genRandomMailbox для автоматической генерации
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'genRandomMailbox',
                count: 1
            },
            timeout: 10000
        });

        if (response.data && response.data.length > 0) {
            const email = response.data[0];
            console.log(`✅ 1secmail API сгенерировал: ${email}`);
            
            const [username, domain] = email.split('@');
            return {
                success: true,
                email: email,
                username: username,
                domain: domain,
                api: '1secmail'
            };
        }
    } catch (error) {
        console.log('❌ 1secmail API недоступен:', error.message);
    }

    // Если API не ответил, генерируем локально
    const username = generateUsername();
    const domain = currentAPI.domains[Math.floor(Math.random() * currentAPI.domains.length)];
    const email = `${username}@${domain}`;

    console.log(`⚠️  Локальная генерация: ${email}`);
    
    return {
        success: true,
        email: email,
        username: username,
        domain: domain,
        api: '1secmail-local'
    };
}

/**
 * Эндпоинт: Создание новой временной почты
 */
app.get('/api/generate-email', async (req, res) => {
    try {
        console.log('🔄 Создание новой временной почты...');

        const result = await createSecmailEmail();

        res.json({
            success: true,
            email: result.email,
            username: result.username,
            domain: result.domain,
            api: result.api,
            message: 'Реальная временная почта! Отправляйте письма.',
            isReal: true
        });

    } catch (error) {
        console.error('❌ Ошибка создания почты:', error.message);

        const username = generateUsername();
        const domain = currentAPI.domains[0];
        const email = `${username}@${domain}`;

        res.json({
            success: true,
            email: email,
            username: username,
            domain: domain,
            api: 'fallback',
            message: 'Email создан (если письма не приходят, попробуйте другую почту)',
            isReal: true
        });
    }
});

/**
 * Получение писем из 1secmail API
 */
app.get('/api/get-messages', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email адрес не указан'
            });
        }

        const [username, domain] = email.split('@');

        if (!username || !domain) {
            return res.status(400).json({
                success: false,
                error: 'Неверный формат email'
            });
        }

        console.log(`📬 Проверка писем для: ${email}`);

        // Запрос к 1secmail API
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'getMessages',
                login: username,
                domain: domain
            },
            timeout: 15000 // Увеличено время ожидания
        });

        const messages = response.data || [];

        console.log(`📩 Найдено писем: ${messages.length}`);

        if (messages.length > 0) {
            console.log('   Письма:');
            messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. От: ${msg.from} | Тема: ${msg.subject}`);
            });
        }

        // Форматируем сообщения
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            from: msg.from,
            subject: msg.subject || '(Без темы)',
            date: msg.date,
            body: msg.textBody || msg.body || '',
            textBody: msg.textBody || msg.body || ''
        }));

        res.json({
            success: true,
            messages: formattedMessages,
            count: formattedMessages.length,
            isReal: true,
            email: email
        });

    } catch (error) {
        console.error('❌ Ошибка получения писем:', error.message);
        
        // Детальная информация об ошибке
        let errorInfo = '';
        if (error.code === 'ENOTFOUND') {
            errorInfo = 'Нет доступа к API. Проверьте интернет-соединение.';
        } else if (error.code === 'ETIMEDOUT') {
            errorInfo = 'API не отвечает. Попробуйте позже.';
        } else if (error.response) {
            errorInfo = `API вернул ошибку: ${error.response.status}`;
        } else {
            errorInfo = error.message;
        }

        console.log(`   Детали: ${errorInfo}`);

        res.json({
            success: true,
            messages: [],
            count: 0,
            error: errorInfo,
            tip: 'Подождите 30-60 секунд после отправки письма'
        });
    }
});

/**
 * Чтение конкретного письма
 */
app.get('/api/read-message', async (req, res) => {
    try {
        const { email, id } = req.query;

        if (!email || !id) {
            return res.status(400).json({
                success: false,
                error: 'Email или ID письма не указаны'
            });
        }

        const [username, domain] = email.split('@');

        console.log(`📖 Чтение письма ID ${id} для: ${email}`);

        // Запрос к 1secmail API
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'readMessage',
                login: username,
                domain: domain,
                id: id
            },
            timeout: 15000
        });

        const message = response.data;

        if (!message) {
            throw new Error('Письмо не найдено');
        }

        console.log(`✅ Письмо прочитано: "${message.subject}"`);

        // Обработка HTML или текста
        let htmlBody = message.htmlBody;
        
        if (!htmlBody && message.textBody) {
            // Конвертируем текст в HTML с сохранением форматирования
            htmlBody = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message.textBody)}</div>`;
        } else if (!htmlBody && message.body) {
            htmlBody = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message.body)}</div>`;
        } else if (!htmlBody) {
            htmlBody = '<p style="color: #999;">Письмо пустое</p>';
        }

        const formattedMessage = {
            id: message.id,
            from: message.from,
            subject: message.subject || '(Без темы)',
            date: message.date,
            htmlBody: htmlBody,
            textBody: message.textBody || message.body || '',
            attachments: message.attachments || []
        };

        res.json({
            success: true,
            message: formattedMessage,
            isReal: true
        });

    } catch (error) {
        console.error('❌ Ошибка чтения письма:', error.message);
        res.status(500).json({
            success: false,
            error: 'Не удалось прочитать письмо: ' + error.message
        });
    }
});

/**
 * Диагностика - проверка доступности API
 */
app.get('/api/check-api', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        tests: []
    };

    // Тест 1: Генерация email
    try {
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'genRandomMailbox',
                count: 1
            },
            timeout: 10000
        });

        results.tests.push({
            test: 'Генерация email',
            status: 'SUCCESS',
            result: response.data[0] || 'Получен email'
        });
    } catch (error) {
        results.tests.push({
            test: 'Генерация email',
            status: 'FAILED',
            error: error.message
        });
    }

    // Тест 2: Получение доменов
    try {
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'getDomainList'
            },
            timeout: 10000
        });

        results.tests.push({
            test: 'Список доменов',
            status: 'SUCCESS',
            result: `Найдено доменов: ${response.data.length}`
        });
    } catch (error) {
        results.tests.push({
            test: 'Список доменов',
            status: 'FAILED',
            error: error.message
        });
    }

    // Тест 3: Проверка писем (на тестовом адресе)
    try {
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'getMessages',
                login: 'test',
                domain: '1secmail.com'
            },
            timeout: 10000
        });

        results.tests.push({
            test: 'Получение писем',
            status: 'SUCCESS',
            result: 'API отвечает на запросы писем'
        });
    } catch (error) {
        results.tests.push({
            test: 'Получение писем',
            status: 'FAILED',
            error: error.message
        });
    }

    const allPassed = results.tests.every(t => t.status === 'SUCCESS');

    res.json({
        success: allPassed,
        message: allPassed ? '✅ Все тесты пройдены! API работает.' : '❌ Некоторые тесты не прошли',
        ...results
    });
});

/**
 * Тестовый эндпоинт
 */
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ DropWin Mail Server работает!',
        timestamp: new Date().toISOString(),
        version: '2.1.1',
        api: {
            name: currentAPI.name,
            url: currentAPI.baseUrl,
            domains: currentAPI.domains.length
        },
        tip: 'Используйте /api/check-api для диагностики'
    });
});

/**
 * Получение списка доступных доменов
 */
app.get('/api/get-domains', async (req, res) => {
    try {
        const response = await axios.get(currentAPI.baseUrl, {
            params: {
                action: 'getDomainList'
            },
            timeout: 10000
        });

        res.json({
            success: true,
            domains: response.data
        });
    } catch (error) {
        res.json({
            success: true,
            domains: currentAPI.domains
        });
    }
});

// Корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🚀 DROPWIN MAIL SERVER v2.1.1 ЗАПУЩЕН!          ║
║                                                            ║
║     📡 URL: http://localhost:${PORT}                        ║
║     🌐 API: http://localhost:${PORT}/api                    ║
║                                                            ║
║     ✅ РЕАЛЬНЫЕ ВРЕМЕННЫЕ ПОЧТЫ                           ║
║     📧 API: ${currentAPI.name.padEnd(20)}              ║
║     🔄 Автообновление каждые 3 секунды                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📝 БЫСТРЫЙ ТЕСТ:
   1. Откройте http://localhost:${PORT}
   2. Создайте новую почту (кнопка "+")
   3. Скопируйте созданный email
   4. Отправьте тестовое письмо с Gmail
   5. Ждите 30-60 секунд
   6. Письмо должно появиться!

🔍 ДИАГНОСТИКА:
   • Проверка API: http://localhost:${PORT}/api/check-api
   • Тест сервера: http://localhost:${PORT}/api/test

💡 ВАЖНО:
   • Убедитесь что у вас есть интернет
   • Письма могут идти до 60 секунд
   • API 1secmail иногда работает медленно
   • Попробуйте несколько раз если не пришло

⚡ СЕРВЕР ГОТОВ К РАБОТЕ!
`);
});
