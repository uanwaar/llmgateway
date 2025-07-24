/**
 * Audio controller
 * 
 * Handles OpenAI-compatible audio endpoints (Whisper, TTS)
 */

const gatewayService = require('../services/gateway.service');
const { ModelNotFoundError, ValidationError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

class AudioController {
  /**
   * Create transcription (speech-to-text)
   */
  static async createTranscription(req, res) {
    const { 
      model = 'whisper-1', 
      language, 
      prompt, 
      response_format = 'json', 
      temperature = 0, 
    } = req.body;
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new BadRequestError('Audio file is required', {
          field: 'file',
          message: 'No audio file provided in the request',
        });
      }
      
      logger.info('Audio transcription request', {
        requestId: req.id,
        model,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        language,
        responseFormat: response_format,
      });
      
      // Prepare request for gateway service
      const request = {
        model,
        file: req.file,
        language,
        prompt,
        response_format,
        temperature,
      };
      
      // Use gateway service for transcription processing
      const transformedResponse = await gatewayService.createTranscription(request, {
        requestId: req.id,
      });
      
      // Set appropriate content type based on response format
      if (response_format === 'text') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(transformedResponse);
      } else {
        res.json(transformedResponse);
      }
      
      logger.info('Audio transcription completed', {
        requestId: req.id,
        model,
        fileSize: req.file.size,
        textLength: typeof transformedResponse === 'string' 
          ? transformedResponse.length 
          : transformedResponse.text?.length || 0,
      });
      
    } catch (error) {
      logger.error('Audio transcription error', {
        requestId: req.id,
        model,
        error: error.message,
        provider: req.provider,
        fileSize: req.file?.size,
      });
      
      throw error;
    }
  }
  
  /**
   * Create translation (speech-to-text in English)
   */
  static async createTranslation(req, res) {
    const { 
      model = 'whisper-1', 
      prompt, 
      response_format = 'json', 
      temperature = 0, 
    } = req.body;
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new BadRequestError('Audio file is required', {
          field: 'file',
          message: 'No audio file provided in the request',
        });
      }
      
      logger.info('Audio translation request', {
        requestId: req.id,
        model,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        responseFormat: response_format,
      });
      
      // Prepare request for gateway service (translation always outputs English)
      const request = {
        model,
        file: req.file,
        language: 'en', // Force English output for translation
        prompt,
        response_format,
        temperature,
        task: 'translate', // Indicate this is a translation task
      };
      
      // Use gateway service for translation processing
      const response = await gatewayService.createTranscription(request, {
        requestId: req.id,
      });
      
      // Gateway service returns already transformed response
      const transformedResponse = response;
      
      // Set appropriate content type based on response format
      if (response_format === 'text') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(transformedResponse);
      } else {
        res.json(transformedResponse);
      }
      
      logger.info('Audio translation completed', {
        requestId: req.id,
        model,
        fileSize: req.file.size,
        textLength: typeof transformedResponse === 'string' 
          ? transformedResponse.length 
          : transformedResponse.text?.length || 0,
      });
      
    } catch (error) {
      logger.error('Audio translation error', {
        requestId: req.id,
        model,
        error: error.message,
        provider: req.provider,
        fileSize: req.file?.size,
      });
      
      throw error;
    }
  }
  
  /**
   * Create speech (text-to-speech)
   */
  static async createSpeech(req, res) {
    const { model, input, voice, response_format = 'mp3', speed = 1.0 } = req.body;
    
    try {
      logger.info('Text-to-speech request', {
        requestId: req.id,
        model,
        voice,
        inputLength: input?.length || 0,
        responseFormat: response_format,
        speed,
      });
      
      // Get provider for the model (TODO: Add TTS support to gateway service)
      const providerInfo = gatewayService.getProviderForModel(model);
      if (!providerInfo) {
        throw new ModelNotFoundError(model, {
          availableModels: gatewayService.getAvailableModels()
            .filter(m => m.capabilities.includes('tts'))
            .map(m => m.id),
          requestedModel: model,
        });
      }
      
      // Add provider info to request for metrics
      req.provider = providerInfo.name;
      
      // Validate model supports TTS
      const modelInfo = gatewayService.getModelInfo(model);
      if (!modelInfo || !modelInfo.capabilities.includes('tts')) {
        throw new ValidationError(
          `Model ${model} does not support text-to-speech`,
          'model',
          model,
          {
            modelCapabilities: modelInfo?.capabilities || [],
            requiredCapability: 'tts',
          },
        );
      }
      
      // Prepare request for provider
      const providerRequest = {
        model,
        input,
        voice,
        response_format,
        speed,
      };
      
      // Get speech from provider
      const audioStream = await providerInfo.adapter.generateSpeech(providerRequest);
      
      // Set appropriate headers for audio response
      const mimeTypes = {
        mp3: 'audio/mpeg',
        opus: 'audio/opus',
        aac: 'audio/aac',
        flac: 'audio/flac',
        wav: 'audio/wav',
        pcm: 'audio/pcm',
      };
      
      res.setHeader('Content-Type', mimeTypes[response_format] || 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="speech.${response_format}"`);
      
      // Stream audio response
      audioStream.pipe(res);
      
      audioStream.on('end', () => {
        logger.info('Text-to-speech completed', {
          requestId: req.id,
          model,
          provider: provider.name,
          voice,
          inputLength: input.length,
          format: response_format,
        });
      });
      
      audioStream.on('error', (error) => {
        logger.error('Audio stream error', {
          requestId: req.id,
          model,
          error: error.message,
          provider: provider.name,
        });
        
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: 'Audio generation failed',
              type: 'audio_generation_error',
              code: 'audio_generation_error',
            },
          });
        }
      });
      
    } catch (error) {
      logger.error('Text-to-speech error', {
        requestId: req.id,
        model,
        error: error.message,
        provider: req.provider,
      });
      
      throw error;
    }
  }
}

module.exports = AudioController;