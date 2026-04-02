import axios from 'axios';

async function simulateOnboarding() {
  const payload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "mock-id",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15551542879",
                "phone_number_id": "983783108162585"
              },
              "messages": [
                {
                  "from": "34999000000",
                  "id": "wamid.mock_" + Date.now(),
                  "timestamp": Math.floor(Date.now() / 1000),
                  "text": {
                    "body": "Hola LaSecre, quiero mi primer mes gratis."
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  try {
    console.log('Sending mock onboarding webhook...');
    const response = await axios.post('http://localhost:3000/whatsapp/webhook', payload);
    console.log('Response status:', response.status);
    console.log('Check your server logs for the message sequence.');
  } catch (error: any) {
    if (error.response) {
       console.error('Error simulating onboarding:', error.response.status, JSON.stringify(error.response.data));
    } else {
       console.error('Error simulating onboarding:', error.message);
    }
  }
}

simulateOnboarding();
