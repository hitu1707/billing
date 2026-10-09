import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ollama } from 'ollama';
import logger from '../config/logger.js';
import { aiRequestCounter, aiExtractionDuration } from '../middleware/metrics.js';

const ollama = new Ollama();

// Model output is attacker-influenced (they control the uploaded image), so strip
// line breaks before logging to prevent log forging.
const logSafe = (val) => String(val ?? '').replace(/[\r\n]+/g, ' ');

const EXTRACTION_PROMPT = `Analyze this bill or receipt image carefully and extract all product and warranty details.
Return ONLY a valid JSON object without markdown formatting, code blocks, or extra text.

JSON Structure:
{
  "productName": "main product name",
  "productModel": "string or null",
  "category": "Electronics, Grocery, Appliance, Medical, etc.",
  "quantity": 1,
  "purchaseDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "manufacturingDate": "YYYY-MM-DD or null",
  "warrantyPeriod": "e.g. '2 years' or null",
  "warrantyEndDate": "YYYY-MM-DD or null",
  "price": number or null,
  "tax": number or null,
  "totalPrice": number or null,
  "vendorName": "store name or null",
  "vendorAddress": "store address or null",
  "vendorPhone": "phone or null",
  "billNumber": "bill/invoice number or null",
  "paymentMethod": "UPI, Card, Cash, etc. or null"
}`;

async function tryGemini(base64Image) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_')) {
    logger.warn('Gemini API key not configured. Skipping.');
    return null;
  }

  const startTime = Date.now();

  try {
    logger.info('🤖 [Primary] Trying Google Gemini...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('Gemini returned invalid JSON');

    const parsed = JSON.parse(jsonMatch[0]);
    const durationSec = (Date.now() - startTime) / 1000;

    aiRequestCounter.inc({ provider: 'gemini', status: 'success' });
    aiExtractionDuration.observe({ provider: 'gemini' }, durationSec);

    logger.info(`✅ Gemini Success (${durationSec.toFixed(1)}s): "${logSafe(parsed.productName)}"`);
    return parsed;
  } catch (err) {
    const durationSec = (Date.now() - startTime) / 1000;

    aiRequestCounter.inc({ provider: 'gemini', status: 'error' });
    aiExtractionDuration.observe({ provider: 'gemini' }, durationSec);

    // Redact the API key in case the provider error embeds the request URL.
    const safeMessage = String(err.message).split(apiKey).join('[REDACTED]');
    logger.warn(`⚠️ Gemini failed (${durationSec.toFixed(1)}s): ${safeMessage}`);
    return null;
  }
}

async function tryOllamaLlava(base64Image) {
  const startTime = Date.now();

  try {
    logger.info('🤖 [Fallback] Trying local Ollama + Llava...');

    const response = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'llava',
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT,
          images: [base64Image]
        }
      ]
    });

    const rawText = response.message.content.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('Ollama returned invalid JSON');

    const parsed = JSON.parse(jsonMatch[0]);
    const durationSec = (Date.now() - startTime) / 1000;

    aiRequestCounter.inc({ provider: 'llava', status: 'success' });
    aiExtractionDuration.observe({ provider: 'llava' }, durationSec);

    logger.info(`✅ Llava Success (${durationSec.toFixed(1)}s): "${logSafe(parsed.productName)}"`);
    return parsed;
  } catch (err) {
    const durationSec = (Date.now() - startTime) / 1000;

    aiRequestCounter.inc({ provider: 'llava', status: 'error' });
    aiExtractionDuration.observe({ provider: 'llava' }, durationSec);

    logger.warn(`⚠️ Llava failed (${durationSec.toFixed(1)}s): ${err.message}`);
    return null;
  }
}

export const extractBillData = async (imagePath) => {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  let result = await tryGemini(base64Image);
  if (result) return result;

  result = await tryOllamaLlava(base64Image);
  if (result) return result;

  throw new Error('Both Gemini and Ollama failed. Please try again later.');
};
