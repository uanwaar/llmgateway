---
name: Bug Report
about: Create a report to help us improve
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''
---

## Bug Description
A clear and concise description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
A clear and concise description of what actually happened.

## Screenshots
If applicable, add screenshots to help explain your problem.

## Environment
Please complete the following information:
- **OS**: [e.g. Ubuntu 22.04, macOS 13.0, Windows 11]
- **Node.js Version**: [e.g. 18.17.0]
- **LLM Gateway Version**: [e.g. 1.2.3]
- **Deployment Method**: [e.g. Docker, Kubernetes, npm]
- **Provider(s)**: [e.g. OpenAI, Gemini, both]

## Configuration
Please provide relevant configuration (remove sensitive information):
```yaml
# config/default.yaml or environment variables
server:
  port: 8080
# ... other relevant config
```

## Logs
Please provide relevant log output:
```
# Paste relevant logs here
# Remove any sensitive information like API keys
```

## Request/Response Details
If the bug is related to API requests, please provide:

### Request
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Response
```json
{
  "error": {
    "message": "Error details here",
    "type": "invalid_request_error"
  }
}
```

## Additional Context
Add any other context about the problem here.

## Possible Solution
If you have ideas about what might be causing the issue or how to fix it, please share them here.

## Checklist
- [ ] I have searched existing issues to ensure this is not a duplicate
- [ ] I have provided all the requested information
- [ ] I have removed any sensitive information from logs and configuration
- [ ] I have tested this with the latest version of LLM Gateway