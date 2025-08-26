/*
  Node.js examples for listing and filtering models from LLM Gateway
*/

const fetch = require('node-fetch');

const GATEWAY_URL = process.env.LLM_GATEWAY_URL || 'http://localhost:8080/v1';
const API_KEY = process.env.LLM_GATEWAY_API_KEY || 'your-api-key-here'; // optional if gateway uses provider keys

async function get(path) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

async function run() {
  console.log('1) All models');
  console.log(await get('/models'));

  console.log('\n2) Realtime models (query param)');
  console.log(await get('/models?realtime=true'));

  console.log('\n2b) Realtime models (capability route)');
  console.log(await get('/models/capability/realtime'));

  console.log('\n3) Chat/completion models (capability=chat)');
  console.log(await get('/models?capability=chat'));

  console.log('\n4) STT / transcription models (capability=stt)');
  console.log(await get('/models?capability=stt'));

  console.log('\n5) TTS models');
  console.log(await get('/models?capability=tts'));

  console.log('\n6) Provider=openai,gemini AND type=transcription');
  console.log(await get('/models?provider=openai,gemini&type=transcription'));

  console.log("\n7) Search for 'realtime' in id");
  console.log(await get('/models?search=realtime'));

  const target = 'gpt-4o-mini';
  console.log(`\n8) Single model: ${target}`);
  console.log(await get(`/models/${target}`));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
