/**
 * Audio routes
 * 
 * OpenAI-compatible audio endpoints (Whisper transcription, TTS)
 */

const express = require('express');
const multer = require('multer');
const AudioController = require('../../controllers/audio.controller');
const validationMiddleware = require('../../middleware/validation.middleware');
const rateLimitMiddleware = require('../../middleware/rateLimit.middleware');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
      'audio/mp4', 'audio/webm', 'audio/flac', 'audio/ogg',
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|mp4|webm|flac|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'), false);
    }
  },
});

// Speech-to-text transcription
router.post('/transcriptions',
  rateLimitMiddleware.audio,
  upload.single('file'),
  validationMiddleware(validationMiddleware.schemas.audioTranscription),
  asyncCatch(AudioController.createTranscription),
);

// Speech-to-text translation (transcribe + translate to English)
router.post('/translations',
  rateLimitMiddleware.audio,
  upload.single('file'),
  asyncCatch(AudioController.createTranslation),
);

// Text-to-speech synthesis
router.post('/speech',
  rateLimitMiddleware.audio,
  validationMiddleware(validationMiddleware.schemas.audioSpeech),
  asyncCatch(AudioController.createSpeech),
);

module.exports = router;