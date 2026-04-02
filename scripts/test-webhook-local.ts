import axios from 'axios';

async function testWebhook() {
  const payload = {
    object: 'whatsapp_ビジネス_アカウント',
    entry: [
      {
        id: '123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '123', phone_number_id: '123' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '34640291370' }],
              messages: [
                {
                  from: '34640291370',
                  id: 'wamid.test',
                  timestamp: '123',
                  text: { body: 'Hola LaSecre, vull el meu primer mes gratis.' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post('http://localhost:3000/whatsapp/webhook', payload);
    console.log('Response Status:', res.status);
    console.log('Response Data:', res.data);
  } catch (error: any) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testWebhook();
