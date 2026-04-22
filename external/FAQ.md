# AccessibleMadeFlexible FAQ

## General

### What makes it different?
We cluster issues by component ("same button across 1,842 pages"), not just list violations. Source-level routing means fixes go to the right file.

### Is it WCAG compliant?
We scan against WCAG. Compliance is a legal determination, not a technical one.

### Do you guarantee compliance?
No. No tool can guarantee compliance. We produce evidence-grade documentation.

## Technical

### What scanners?
axe-core, Lighthouse, HTML_CodeSniffer, WAVE. All normalized into canonical issues.

### How does clustering work?
We fingerprint components by HTML structure + attributes. Same component = same issue ID.

### Remediation suggestions are AI?
Yes, using OpenAI. You can also disable or use local models.

## Support

### How to get help?
- Docs: /docs
- GitHub Issues
- Enterprise: Dedicated CSM
