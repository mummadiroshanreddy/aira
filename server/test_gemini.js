require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('hi');
    console.log('Gemini: SUCCESS');
  } catch (e) {
    console.log('Gemini: FAILED');
    console.log('Error Message:', e.message);
  }
}
test();
