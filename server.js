// server.js - Backend сервер для временной почты DropWin с РЕАЛЬНЫМИ почтами
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3001;

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
    },
    mailtm: {
        name: 'mail.tm',
        baseUrl: 'https://api.mail.tm',
        domains: ['virgilian.com', 'mail.tm']
    }
};

// Настраиваем axios с User-Agent
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let currentAPI = EMAIL_APIS.tempmail; // По умолчанию tempmail.lol так как он работает стабильнее 

/**
 * Получение доменов для mail.tm
 */
async function getMailTmDomain() {
    try {
        const response = await axios.get(`${EMAIL_APIS.mailtm.baseUrl}/domains`);
        if (response.data['hydra:member'] && response.data['hydra:member'].length > 0) {
            // Берем первый активный домен
            return response.data['hydra:member'][0].domain;
        }
    } catch (error) {
        console.error('Ошибка получения домена mail.tm:', error.message);
    }
    // Fallback domain if API fails
    return 'virgilian.com';
}

/**
 * Создание email через mail.tm API (с префиксом DropWin)
 */
async function createMailTmEmail() {
    try {
        const domain = await getMailTmDomain();
        const randomNum = Math.floor(Math.random() * 90000) + 10000;
        const username = `dropwin${randomNum}`; // Реализуем пожелание пользователя (lowercase)
        const email = `${username}@${domain}`.toLowerCase();
        const password = `DropWin${randomNum}!`; // Простой пароль для доступа

        // 1. Создаем аккаунт
        await axios.post(`${EMAIL_APIS.mailtm.baseUrl}/accounts`, {
            address: email,
            password: password
        });

        // 2. Получаем токен
        const tokenResp = await axios.post(`${EMAIL_APIS.mailtm.baseUrl}/token`, {
            address: email,
            password: password
        });
        
        const token = tokenResp.data.token;

        console.log(`✅ mail.tm создан: ${email}`);

        return {
            success: true,
            email: email,
            username: username,
            domain: domain,
            token: token,
            password: password, // Можно вернуть, если нужно
            api: 'mail.tm'
        };

    } catch (error) {
        console.log('❌ mail.tm ошибка:', error.message);
        if (error.response) {
            console.log('   Детали:', error.response.data);
            if (error.response.status === 422) {
                 // Username taken or invalid format. Retry?
                 // Let's assume username taken, though random is high.
                 console.log('   (Скорее всего имя занято или формат неверен)');
            }
        }
    }
    return null;
}

/**
 * Генерация случайного имени пользователя
 */
function generateUsername() {
    const numbers = Math.floor(Math.random() * 90000) + 10000;
    return `dropwin${numbers}`; // СТРОГО dropwin + цифры
}

/**
 * Создание email через tempmail.lol API
 */
async function createTempMailLolEmail() {
    try {
        const response = await axios.get(`${currentAPI.baseUrl}/generate`);
        
        if (response.data && response.data.address) {
            const email = response.data.address;
            const token = response.data.token;
            console.log(`✅ tempmail.lol сгенерировал: ${email}`);
            
            const [username, domain] = email.split('@');
            return {
                success: true,
                email: email,
                username: username,
                domain: domain,
                token: token,
                api: 'tempmail.lol'
            };
        }
    } catch (error) {
        console.log('❌ tempmail.lol API недоступен:', error.message);
    }
    return null;
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

        let result;
        
        if (currentAPI.name === 'tempmail.lol') {
            result = await createTempMailLolEmail();
        } else if (currentAPI.name === 'mail.tm') {
            result = await createMailTmEmail();
        } else {
            result = await createSecmailEmail();
        }

        if (result && result.success) {
            res.json({
                success: true,
                email: result.email,
                username: result.username,
                domain: result.domain,
                token: result.token, // Важно для tempmail.lol
                api: result.api,
                message: 'Реальная временная почта! Отправляйте письма.',
                isReal: true
            });
        } else {
            throw new Error('Не удалось создать почту через API');
        }

    } catch (error) {
        console.error('❌ Ошибка создания почты:', error.message);

        // В случае ошибки мы НЕ ДОЛЖНЫ возвращать фейковый адрес mail.tm
        // Вместо этого мы должны попробовать другой API (tempmail.lol) полностью
        
        console.log('🔄 Пробуем Fallback (tempmail.lol)...');
        const fallbackResult = await createTempMailLolEmail();
        
        if (fallbackResult && fallbackResult.success) {
             res.json({
                success: true,
                email: fallbackResult.email,
                username: fallbackResult.username,
                domain: fallbackResult.domain,
                token: fallbackResult.token,
                api: fallbackResult.api,
                message: 'Создан резервный адрес (основной сервис перегружен)',
                isReal: true
            });
            return;
        }

        // Если совсем всё плохо
        res.status(500).json({
            success: false,
            error: 'Не удалось создать почту. Попробуйте позже.'
        });
    }
});

/**
 * Получение писем из 1secmail API
 */
app.get('/api/get-messages', async (req, res) => {
    try {
        const { email, token, api } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email адрес не указан'
            });
        }

        console.log(`📬 Проверка писем для: ${email}`);
        let messages = [];

        // Определяем целевой API
        let targetAPI = currentAPI.name;
        
        // Более точное определение API по домену или токену
        if (token && (email.includes('virgilian.com') || email.includes('mail.tm'))) {
            targetAPI = 'mail.tm';
        } else if (token && (email.includes('tempmail.lol') || email.includes('chessgamingworld.com') || email.includes('leadharbor.org'))) {
             // Список доменов tempmail.lol может меняться, но если не mail.tm и есть токен, скорее всего это tempmail.lol
             targetAPI = 'tempmail.lol';
        } else if (api) {
            targetAPI = api; // Если клиент передал тип API явно
        } else if (token && !email.includes('virgilian') && !email.includes('mail.tm')) {
             // Fallback: если есть токен и не mail.tm, считаем tempmail.lol
             targetAPI = 'tempmail.lol';
        } else {
             targetAPI = '1secmail';
        }
        
        console.log(`🔎 Определен API: ${targetAPI} для ${email}`);

        if (targetAPI === 'mail.tm') {
            if (!token) {
                 return res.json({ success: true, messages: [], count: 0 });
            }

            try {
                const response = await axios.get(`${EMAIL_APIS.mailtm.baseUrl}/messages`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { page: 1, itemsPerPage: 100 }, // Запрашиваем больше писем
                    timeout: 15000
                });
                
                if (response.data && Array.isArray(response.data['hydra:member'])) {
                    messages = response.data['hydra:member'];
                } else {
                    console.log('⚠️ mail.tm вернул странный ответ:', JSON.stringify(response.data).substring(0, 100));
                    messages = [];
                }
            } catch (e) {
                console.error('Ошибка проверки почты mail.tm:', e.message);
                // Если токен невалиден (401), можно вернуть ошибку, чтобы клиент знал
                if (e.response && e.response.status === 401) {
                     return res.status(401).json({ success: false, error: 'Сессия истекла' });
                }
                // Не возвращаем success: true, если произошла ошибка сети
                return res.status(500).json({ success: false, error: 'Ошибка сети mail.tm' });
            }

        } else if (targetAPI === 'tempmail.lol' || currentAPI.name === 'tempmail.lol') {
            if (!token) {
                 // Если токена нет, мы не можем проверить почту на tempmail.lol
                 // Но может это старая почта 1secmail?
                 // Попробуем логику для fallback или вернем ошибку
                 console.log('⚠️ Нет токена для tempmail.lol');
                 return res.json({ success: true, messages: [], count: 0 });
            }

            const response = await axios.get(`${EMAIL_APIS.tempmail.baseUrl}/auth/${token}`, {
                timeout: 15000
            });
            
            // tempmail.lol возвращает { email: [...] }
            messages = response.data.email || [];
            
        } else {
            // Logic for 1secmail
            const [username, domain] = email.split('@');
            if (!username || !domain) {
                return res.status(400).json({ success: false, error: 'Неверный формат email' });
            }

            const response = await axios.get(currentAPI.baseUrl, {
                params: {
                    action: 'getMessages',
                    login: username,
                    domain: domain
                },
                timeout: 15000
            });
            messages = response.data || [];
        }

        console.log(`📩 Найдено писем: ${Array.isArray(messages) ? messages.length : 'Ошибка (не массив)'}`);

        if (!Array.isArray(messages)) {
            console.log('⚠️ Warning: messages is not an array:', messages);
            messages = [];
        }

        if (messages.length > 0) {
            console.log('   Письма:');
            messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. От: ${msg.from} | Тема: ${msg.subject}`);
            });
        }

        // Форматируем сообщения
        const formattedMessages = messages.map((msg, index) => {
            // Улучшенная генерация ID
            let uniqueId = msg.id || msg._id;
            if (!uniqueId) {
                // Если нет ID, генерируем на основе контента и времени
                // Убираем index из хэша, чтобы ID был стабильным при изменении порядка сортировки
                // Но добавляем часть body, чтобы различать одинаковые письма
                const bodyPart = (msg.body || msg.textBody || msg.htmlBody || '').substring(0, 20);
                const uniqueStr = `${msg.subject || ''}${msg.date || ''}${msg.from ? (msg.from.address || msg.from) : ''}${bodyPart}`;
                uniqueId = Buffer.from(uniqueStr).toString('base64');
            }

            return {
                id: uniqueId,
                from: msg.from.address ? `${msg.from.name} <${msg.from.address}>` : (msg.from || 'Неизвестно'),
                subject: msg.subject || '(Без темы)',
                date: msg.date || new Date().toISOString(),
                body: msg.body || msg.textBody || msg.htmlBody || '',
                textBody: msg.body || msg.textBody || '',
                htmlBody: msg.htmlBody || msg.body || ''
            };
        });

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
        const { email, id, token, api } = req.query; // Добавляем api

        if (!email || !id) {
            return res.status(400).json({
                success: false,
                error: 'Email или ID письма не указаны'
            });
        }

        const [username, domain] = email.split('@');

        console.log(`📖 Чтение письма ID ${id} для: ${email}`);
        
        let message = null;
        
        // Определяем API
        let targetAPI = currentAPI.name;
        
        // Более точное определение API по домену или токену
        if (token && (email.includes('virgilian.com') || email.includes('mail.tm'))) {
            targetAPI = 'mail.tm';
        } else if (token && (email.includes('tempmail.lol') || email.includes('chessgamingworld.com') || email.includes('leadharbor.org'))) {
             targetAPI = 'tempmail.lol';
        } else if (api) {
            targetAPI = api;
        } else if (token && !email.includes('virgilian') && !email.includes('mail.tm')) {
             targetAPI = 'tempmail.lol';
        } else {
             targetAPI = '1secmail';
        }

        if (targetAPI === 'mail.tm') {
            if (!token) return res.status(400).json({ success: false, error: 'Токен не указан' });
            
            try {
                const response = await axios.get(`${EMAIL_APIS.mailtm.baseUrl}/messages/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 15000
                });
                message = response.data;
                // Нормализация
                message.htmlBody = message.html ? message.html[0] : (message.text ? `<pre>${message.text}</pre>` : '');
                message.textBody = message.text || '';
                message.from = message.from.address ? `${message.from.name} <${message.from.address}>` : message.from;
            } catch (e) {
                throw new Error('Письмо не найдено в mail.tm');
            }

        } else if (targetAPI === 'tempmail.lol') {
             if (!token) {
                  return res.status(400).json({ success: false, error: 'Токен не указан' });
             }
             // Для tempmail.lol получаем все письма и ищем нужное
             const response = await axios.get(`${EMAIL_APIS.tempmail.baseUrl}/auth/${token}`, {
                timeout: 15000
             });
             const messages = response.data.email || [];
             // Ищем письмо. ID может быть строкой или числом
             message = messages.find(m => (m._id || m.id) == id);
             
             if (!message) {
                 throw new Error('Письмо не найдено');
             }
             
             // Нормализуем структуру для tempmail.lol
             message.htmlBody = message.htmlBody || message.body; 
             message.textBody = message.textBody || message.body;

        } else {
            // Запрос к 1secmail API
            const response = await axios.get(EMAIL_APIS.secmail.baseUrl, {
                params: {
                    action: 'readMessage',
                    login: username,
                    domain: domain,
                    id: id
                },
                timeout: 15000
            });
            message = response.data;
        }

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
