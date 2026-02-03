
const axios = require('axios');

async function debugMailTm() {
    try {
        console.log('--- Debugging mail.tm ---');
        
        // 1. Get Domains
        console.log('1. Fetching domains...');
        try {
            const domainsResp = await axios.get('https://api.mail.tm/domains');
            console.log('Domains Response Status:', domainsResp.status);
            const domains = domainsResp.data['hydra:member'];
            console.log('Available domains:', domains.map(d => d.domain));
            
            if (domains.length === 0) throw new Error('No domains found');
            
            const domain = domains[0].domain;
            
            // 2. Create Account
            const username = `dropwintest${Math.floor(Math.random() * 1000)}`;
            const email = `${username}@${domain}`;
            const password = 'password123';
            
            console.log(`2. Creating account: ${email}`);
            await axios.post('https://api.mail.tm/accounts', {
                address: email,
                password: password
            });
            console.log('Account created successfully');
            
            // 3. Get Token
            console.log('3. Getting token...');
            const tokenResp = await axios.post('https://api.mail.tm/token', {
                address: email,
                password: password
            });
            const token = tokenResp.data.token;
            console.log('Token received');
            
            // 4. Check Messages
            console.log('4. Checking messages endpoint...');
            const messagesResp = await axios.get('https://api.mail.tm/messages', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Messages response type:', typeof messagesResp.data);
            console.log('Is array?', Array.isArray(messagesResp.data['hydra:member']));
            console.log('Messages count:', messagesResp.data['hydra:member'] ? messagesResp.data['hydra:member'].length : 'N/A');
            
        } catch (e) {
            console.error('Step failed:', e.message);
            if (e.response) {
                console.error('Response status:', e.response.status);
                console.error('Response data:', JSON.stringify(e.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Global error:', error);
    }
}

debugMailTm();
