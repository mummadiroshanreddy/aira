require('dotenv').config();
const Groq = require('groq-sdk');

const test = async () => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3-8b-8192',
      max_tokens: 1
    });
    console.log('Groq 8B: SUCCESS ✓');
  } catch (e) {
    console.log('Groq 8B: FAILED ✗');
    console.log('Error Message:', e.message);
  }
};
test();
