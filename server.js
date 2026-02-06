const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/generate-email', async (req, res) => {
    try {
        // Получаем список доступных доменов
        const domainsResponse = await axios.get('https://www.1secmail.com/api/v1/?action=getDomainList');
        const domains = domainsResponse.data;
        
        if (!domains || domains.length === 0) {
            return res.json({ success: false, error: 'Нет доступных доменов' });
        }
        
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const username = generateRandomUsername();
        const email = `${username}@${domain}`;
        
        res.json({
            success: true,
            email: email,
            username: username,
            domain: domain
        });
    } catch (error) {
        console.error('Ошибка генерации email:', error);
        res.json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/get-messages', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.json({ success: false, error: 'Email не указан' });
        }
        
        const response = await axios.get('https://www.1secmail.com/api/v1/', {
            params: {
                action: 'getMessages',
                login: email.split('@')[0],
                domain: email.split('@')[1]
            }
        });
        
        res.json({
            success: true,
            messages: response.data || []
        });
    } catch (error) {
        console.error('Ошибка получения писем:', error);
        res.json({ success: false, error: 'Ошибка получения писем' });
    }
});

app.get('/api/read-message', async (req, res) => {
    try {
        const { email, id } = req.query;
        
        if (!email || !id) {
            return res.json({ success: false, error: 'Email или ID не указаны' });
        }
        
        const response = await axios.get('https://www.1secmail.com/api/v1/', {
            params: {
                action: 'readMessage',
                login: email.split('@')[0],
                domain: email.split('@')[1],
                id: id
            }
        });
        
        res.json({
            success: true,
            message: response.data
        });
    } catch (error) {
        console.error('Ошибка чтения письма:', error);
        res.json({ success: false, error: 'Ошибка чтения письма' });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 DropWin Mail сервер запущен на http://localhost:${PORT}`);
    console.log(`📧 API доступно по адресу http://localhost:${PORT}/api/`);
});

// Функция генерации случайного имени пользователя
function generateRandomUsername() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `dropwin_${result}`;
}