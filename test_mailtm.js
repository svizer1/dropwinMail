
const axios = require('axios');

async function testMailTm() {
    try {
        console.log('Testing mail.tm API...');
        
        // 1. Get Domains
        console.log('1. Getting domains...');
        const domainsResp = await axios.get('https://api.mail.tm/domains');
        const domain = domainsResp.data['hydra:member'][0].domain;
        console.log('Domain:', domain);

        // 2. Create Account with Custom Name
        const username = `dropwin${Math.floor(Math.random() * 1000)}`;
        const email = `${username}@${domain}`;
        const password = 'password123';
        
        console.log(`2. Creating account: ${email}`);
        
        await axios.post('https://api.mail.tm/accounts', {
            address: email,
            password: password
        });
        console.log('Account created!');

        // 3. Get Token
        console.log('3. Getting token...');
        const tokenResp = await axios.post('https://api.mail.tm/token', {
            address: email,
            password: password
        });
        const token = tokenResp.data.token;
        console.log('Token received:', token.substring(0, 20) + '...');

        // 4. Get Messages
        console.log('4. Checking messages...');
        const messagesResp = await axios.get('https://api.mail.tm/messages', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Messages:', messagesResp.data['hydra:member']);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testMailTm();
