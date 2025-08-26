# Changelog

## v0.2.0 - 2025-07-25

### ✨ New Features
- feat: Update API request and response structure to use 'input' instead of 'messages' and enhance response handling (3567b01)

### 📚 Documentation
- docs: update documentation for v0.1.0 (82ee74e)

### 🔧 Other Changes
- Merge branch 'main' of https://github.com/uanwaar/llmgateway (2f5a0e2)
- Add load and stress testing suites for LLM Gateway (d14724a)
- Delete development directory (10ce7ef)

# Changelog

## v0.1.0 - 2025-07-25

### Initial Release

- Add Kubernetes manifests and deployment scripts for LLM Gateway (f61735d)
- Add basic usage examples and client key management for LLM Gateway (e20b588)
- feat: Implement cache service with memory and Redis backends (0e080d3)
- feat: Update server port to 8000 and configure cross-env for environment variables in scripts (239800d)
- feat: Enhance streaming response handling in ChatController and GeminiClient; update OpenAITransformer for chunk processing (d469ddf)
- feat: Implement RouterService for intelligent request routing with multiple strategies (864b67f)
- feat: Implement OpenAI-compatible API with embeddings, chat, audio, and health check endpoints (3033fa9)
- feat(openai): Enhance OpenAI integration with new response handling and model features (b461037)
- feat(openai): Implement OpenAI client, models, and transformer (6f99997)
- feat: Update OpenAI API documentation with available models and pricing details (517e8ab)
- feat: Implement response transformer for unified response formats (54819c1)
- feat: Initial commit of LLM Gateway project with core structure and configuration (6e51433)
