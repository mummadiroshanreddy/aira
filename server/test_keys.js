require('dotenv').config();
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const testGroq = async () => {
  if (!process.env.GROQ_API_KEY) return console.log('Groq: NOT SET');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama-3.3-70b-specdec',
      max_tokens: 1
    });
    console.log('Groq: SUCCESS ✓');
  } catch (e) {
    console.error('Groq: FAILED ✗', e.message);
  }
};

const testGemini = async () => {
  if (!process.env.GEMINI_API_KEY) return console.log('Gemini: NOT SET');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('hi');
    console.log('Gemini: SUCCESS ✓');
  } catch (e) {
    console.error('Gemini: FAILED ✗', e.message);
  }
};

(async () => {
  console.log('--- API KEY TEST ---');
  await testGroq();
  await testGemini();
  console.log('--------------------');
})();
