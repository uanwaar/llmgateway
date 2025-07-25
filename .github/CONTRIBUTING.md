# Contributing to LLM Gateway

Thank you for your interest in contributing to LLM Gateway! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm 9 or higher
- Docker (for testing)
- Git

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/llm-gateway.git
   cd llm-gateway
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys for testing
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

## How to Contribute

### Reporting Issues

Before creating an issue, please:
1. Search existing issues to avoid duplicates
2. Use the appropriate issue template
3. Provide detailed information

### Suggesting Features

1. Check [existing feature requests](https://github.com/your-org/llm-gateway/labels/enhancement)
2. Use the feature request template
3. Explain the use case and benefits
4. Consider discussing in [Discussions](https://github.com/your-org/llm-gateway/discussions) first

### Contributing Code

#### Before You Start
1. Check if there's an existing issue for your contribution
2. Comment on the issue to avoid duplicate work
3. For large changes, discuss the approach first

#### Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**
   - Follow the coding standards
   - Write or update tests
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   npm run lint
   npm run type-check
   npm test
   npm run test:integration
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
   
   Follow [Conventional Commits](https://conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `style:` for formatting changes
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request using the PR template.

## Development Guidelines

### Code Style

We use ESLint and Prettier for code formatting:
```bash
npm run lint        # Check for issues
npm run lint:fix    # Fix auto-fixable issues
npm run format      # Format code with Prettier
```

### Code Standards

- **ES6+ Features**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over promises
- **Error Handling**: Always handle errors appropriately
- **Logging**: Use the centralized logger
- **Security**: Follow security best practices
- **Performance**: Consider performance implications

### Testing

#### Unit Tests
- Located in `tests/unit/`
- Test individual functions and modules
- Use Jest framework
- Aim for high code coverage

```bash
npm run test:unit
```

#### Integration Tests
- Located in `tests/integration/`
- Test interactions between components
- Test API endpoints
- Use real Redis for caching tests

```bash
npm run test:integration
```

#### End-to-End Tests
- Located in `tests/e2e/`
- Test complete user workflows
- Use the full application stack

```bash
npm run test:e2e
```

### Documentation

- Update README.md for user-facing changes
- Update API documentation for endpoint changes
- Add JSDoc comments for new functions
- Update examples if APIs change

### Adding New Providers

To add a new LLM provider:

1. **Create Provider Directory**
   ```
   src/providers/your-provider/
   ├── index.js
   ├── your-provider.adapter.js
   ├── your-provider.client.js
   ├── your-provider.models.js
   └── your-provider.transformer.js
   ```

2. **Implement Required Interfaces**
   - Extend base adapter
   - Implement required methods
   - Add model definitions
   - Create request/response transformers

3. **Add Configuration**
   - Update `config/default.yaml`
   - Add provider settings
   - Document configuration options

4. **Write Tests**
   - Unit tests for all components
   - Integration tests with mocked API
   - Add to test suite

5. **Update Documentation**
   - Add provider documentation
   - Update examples
   - Add configuration guide

## Review Process

### What We Look For

- **Functionality**: Does it work as intended?
- **Code Quality**: Is it well-written and maintainable?
- **Tests**: Are there adequate tests?
- **Documentation**: Is it properly documented?
- **Security**: Are there any security concerns?
- **Performance**: Does it impact performance?
- **Compatibility**: Does it break existing functionality?

### Review Timeline

- **Simple fixes**: 1-2 days
- **Features**: 3-7 days
- **Complex changes**: 1-2 weeks

### Feedback and Changes

- Address reviewer feedback promptly
- Ask questions if feedback is unclear
- Make requested changes in new commits
- Don't force-push after review starts

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Schedule

- **Patch releases**: As needed for critical fixes
- **Minor releases**: Monthly (feature releases)
- **Major releases**: Quarterly or for breaking changes

## Community

### Getting Help

- [GitHub Discussions](https://github.com/your-org/llm-gateway/discussions) - Questions and general discussion
- [Discord/Slack](https://discord.gg/your-server) - Real-time chat
- [Stack Overflow](https://stackoverflow.com/questions/tagged/llm-gateway) - Technical questions

### Staying Updated

- Watch the repository for updates
- Follow [@LLMGateway](https://twitter.com/llmgateway) on Twitter
- Subscribe to our [blog](https://blog.your-domain.com)

## Recognition

Contributors will be recognized in:
- README.md contributor list
- Release notes (for significant contributions)
- Annual contributor recognition
- Conference speaking opportunities

## Legal

By contributing to LLM Gateway, you agree that:
- Your contributions will be licensed under the MIT License
- You have the right to submit the contributions
- Your contributions are your original work

---

Thank you for contributing to LLM Gateway! 🚀