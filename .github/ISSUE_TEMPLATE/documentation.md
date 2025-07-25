---
name: Documentation Issue
about: Report missing, incorrect, or unclear documentation
title: '[DOCS] '
labels: ['documentation', 'needs-triage']
assignees: ''
---

## Documentation Issue Type
What type of documentation issue is this:
- [ ] Missing documentation
- [ ] Incorrect/outdated information
- [ ] Unclear or confusing explanation
- [ ] Broken links or references
- [ ] Grammar/spelling errors
- [ ] Code examples don't work
- [ ] Missing code examples

## Location
Where is the documentation issue located:
- **File/Page**: [e.g. README.md, docs/api-validation.md, line 45]
- **URL**: [if applicable]
- **Section**: [specific section or heading]

## Current Documentation
What does the current documentation say (copy/paste or screenshot):
```markdown
Current text here...
```

## Issue Description
What is wrong or missing:
- What information is incorrect?
- What is unclear or confusing?
- What is missing that should be documented?

## Expected Documentation
What should the documentation say instead:
```markdown
Corrected/improved text here...
```

## Use Case
Why is this documentation important:
- Who needs this information?
- What are they trying to accomplish?
- How does the current issue impact users?

## Suggested Improvements
How could this be improved:
- [ ] Add code examples
- [ ] Add screenshots/diagrams
- [ ] Reorganize information
- [ ] Add cross-references
- [ ] Update for current version
- [ ] Add troubleshooting section

## Code Examples
If the issue involves code examples, provide working examples:

### Current Example (if broken)
```javascript
// Current non-working example
const example = require('example');
```

### Proposed Example
```javascript
// Working example that should be documented
const { OpenAI } = require('openai');
const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'your-api-key'
});
```

## Environment Context
If relevant to the documentation:
- **Operating System**: [e.g. Windows, macOS, Linux]
- **Installation Method**: [e.g. Docker, npm, Kubernetes]
- **Version**: [e.g. 1.2.3]

## Additional Context
Any other information that would help improve the documentation:
- Related documentation that works well
- Similar projects with good examples
- User feedback you've received
- Community questions you've seen

## Impact
How does this documentation issue affect users:
- [ ] Prevents new users from getting started
- [ ] Blocks specific use cases
- [ ] Causes confusion or errors
- [ ] Makes troubleshooting difficult
- [ ] Affects API integration

## Checklist
- [ ] I have searched existing issues to avoid duplicates
- [ ] I have checked the latest version of the documentation
- [ ] I have provided specific location information
- [ ] I have suggested concrete improvements