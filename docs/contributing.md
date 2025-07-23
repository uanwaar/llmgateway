# Contributing to LLM Gateway

## Welcome Contributors! 

Thank you for your interest in contributing to the LLM Gateway project. This document provides guidelines and information for contributors to help maintain code quality and project consistency.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be respectful**: Treat all contributors with respect and kindness
- **Be inclusive**: Welcome newcomers and help them get started
- **Be collaborative**: Work together to improve the project
- **Be constructive**: Provide helpful feedback and suggestions
- **Be professional**: Maintain professionalism in all interactions

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- Docker (optional but recommended)
- API keys for testing (OpenAI, Gemini)

### First-Time Setup

1. **Fork the repository**:
   - Go to https://github.com/your-org/llm-gateway
   - Click "Fork" to create your own copy

2. **Clone your fork**:
```bash
git clone https://github.com/YOUR_USERNAME/llm-gateway.git
cd llm-gateway
```

3. **Add upstream remote**:
```bash
git remote add upstream https://github.com/your-org/llm-gateway.git
```

4. **Install dependencies**:
```bash
npm install
```

5. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your API keys for testing
```

## Development Setup

### Running in Development Mode

```bash
# Start the development server
npm run dev

# Run with debug logging
DEBUG=* npm run dev

# Run with specific debug namespace
DEBUG=gateway:* npm run dev
```

### Using Docker for Development

```bash
# Build development image
docker-compose -f docker-compose.dev.yml build

# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run tests in container
docker-compose -f docker-compose.dev.yml run --rm app npm test
```

### Project Structure

```
llm-gateway/
├── src/
│   ├── adapters/          # Provider-specific adapters
│   ├── config/           # Configuration management
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   └── utils/            # Utility functions
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test data and mocks
├── config/               # Configuration files
├── docs/                 # Documentation
└── scripts/              # Build and utility scripts
```

## Contributing Process

### 1. Choose What to Work On

- Check [open issues](https://github.com/your-org/llm-gateway/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Propose new features by opening an issue first

### 2. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 3. Make Changes

- Follow the [Code Standards](#code-standards)
- Write tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 4. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Run linting
npm run lint

# Run type checking
npm run type-check

# Test with different providers
npm run test:providers
```

### 5. Submit Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create pull request on GitHub
# Use the PR template and provide detailed description
```

## Code Standards

### JavaScript/TypeScript Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format
```

### Coding Conventions

1. **File Naming**:
   - Use kebab-case for files: `provider-adapter.js`
   - Use PascalCase for classes: `class ProviderAdapter`
   - Use camelCase for functions: `function processRequest()`

2. **Function Guidelines**:
   - Keep functions small and focused
   - Use descriptive names
   - Prefer pure functions when possible
   - Handle errors explicitly

3. **Error Handling**:
```javascript
// Good: Explicit error handling
try {
  const result = await providerAPI.call();
  return result;
} catch (error) {
  logger.error('Provider API call failed', { error, provider: 'openai' });
  throw new ProviderError('Failed to process request', error);
}

// Bad: Unhandled promises
providerAPI.call().then(result => result);
```

4. **Logging**:
```javascript
// Good: Structured logging
logger.info('Processing request', {
  requestId,
  provider,
  model,
  duration: Date.now() - startTime
});

// Bad: String concatenation
console.log('Processing request for ' + provider);
```

### TypeScript Guidelines

- Use explicit types for function parameters and return values
- Prefer interfaces over types for object shapes
- Use strict mode configuration
- Leverage union types for provider-specific logic

```typescript
// Good: Explicit types
interface ProviderRequest {
  model: string;
  messages: Message[];
  provider?: string;
}

async function processRequest(request: ProviderRequest): Promise<ProviderResponse> {
  // Implementation
}

// Bad: Any types
function processRequest(request: any): any {
  // Implementation
}
```

## Testing Guidelines

### Test Structure

We use Jest for testing with the following patterns:

```javascript
describe('ProviderAdapter', () => {
  describe('translateRequest', () => {
    it('should translate unified request to OpenAI format', () => {
      // Arrange
      const unifiedRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Act
      const result = adapter.translateRequest(unifiedRequest);

      // Assert
      expect(result).toEqual({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test API endpoints and provider interactions
3. **Contract Tests**: Verify provider API compatibility

### Writing Good Tests

- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies
- Test both success and error cases
- Keep tests focused and fast

### Running Tests

```bash
# All tests
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test -- provider-adapter.test.js
```

## Documentation

### Code Documentation

- Use JSDoc comments for functions and classes
- Document complex business logic
- Include examples for public APIs

```javascript
/**
 * Translates a unified request to provider-specific format
 * @param {UnifiedRequest} request - The unified request object
 * @param {string} provider - The target provider ('openai' | 'gemini')
 * @returns {Promise<ProviderRequest>} The translated request
 * @throws {TranslationError} When translation fails
 * @example
 * const translated = await translateRequest(request, 'openai');
 */
async function translateRequest(request, provider) {
  // Implementation
}
```

### README and Guides

When updating documentation:
- Keep it clear and concise
- Include code examples
- Update table of contents
- Test all code examples

### API Documentation

- Use OpenAPI/Swagger specifications
- Include request/response examples
- Document error responses
- Keep documentation in sync with code

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Discord**: Real-time chat and community support
- **Email**: security@llm-gateway.org for security issues

### Issue Guidelines

When creating issues:

1. **Bug Reports**:
   - Use the bug report template
   - Include reproduction steps
   - Provide environment details
   - Include error logs if applicable

2. **Feature Requests**:
   - Use the feature request template
   - Explain the use case
   - Consider implementation approach
   - Check for existing similar requests

3. **Questions**:
   - Check existing documentation first
   - Use GitHub Discussions for general questions
   - Provide context and what you've tried

### Pull Request Guidelines

- Use the PR template
- Reference related issues
- Provide clear description of changes
- Include tests for new functionality
- Update documentation as needed
- Keep PRs focused and reasonably sized

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: Maintainers review code quality and design
3. **Testing**: Changes are tested in different environments
4. **Documentation**: Ensure documentation is updated
5. **Merge**: Approved changes are merged to main branch

### Release Process

- Follow semantic versioning (SemVer)
- Maintain changelog for each release
- Tag releases appropriately
- Update documentation for breaking changes

## Recognition

Contributors are recognized in several ways:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes for significant contributions
- Badge/role in Discord community
- Invitation to maintainer team for consistent contributors

## Getting Help

If you need help:

1. Check the [documentation](./README.md)
2. Search [existing issues](https://github.com/your-org/llm-gateway/issues)
3. Ask in [GitHub Discussions](https://github.com/your-org/llm-gateway/discussions)
4. Join our [Discord community](https://discord.gg/llm-gateway)

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to LLM Gateway! Your efforts help make LLM access more unified and accessible for everyone. 🚀