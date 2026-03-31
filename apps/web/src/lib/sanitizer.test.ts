import { describe, expect, it } from 'vitest';
import { sanitizeAiCode, escapeHtml, wrapCodePreview } from './sanitizer';

describe('sanitizeAiCode', () => {
  it('returns empty string for falsy or empty input', () => {
    expect(sanitizeAiCode('')).toBe('');
  });

  it('removes script tags and their content completely', () => {
    const input = '<div>Hello <script>alert("xss")</script>World</div>';
    expect(sanitizeAiCode(input)).toBe('<div>Hello World</div>');
  });

  it('removes style tags and their content to prevent CSS injection', () => {
    const input = '<p>Test</p><style>body { background: red; }</style>';
    expect(sanitizeAiCode(input)).toBe('<p>Test</p>');
  });

  it('removes inline event handlers (on*)', () => {
    const input = '<button onclick="alert(\'xss\')" onmouseover=\'foo()\' onfocus=bar>Click me</button>';
    expect(sanitizeAiCode(input)).toBe('<button>Click me</button>');
  });

  it('removes dangerous protocols (javascript:, data:, etc.) from URL attributes', () => {
    const input = '<a href="javascript:alert(1)">Link</a> <img src="data:image/png;base64,123">';
    expect(sanitizeAiCode(input)).toBe('<a>Link</a> <img />');
  });

  it('removes dangerous tags like iframe, object, embed completely', () => {
    const input = '<iframe src="evil.com"></iframe><object data="evil.swf"></object><embed src="evil.swf"><p>Safe</p>';
    expect(sanitizeAiCode(input)).toBe('<p>Safe</p>');
  });

  it('handles combinations of malicious vectors gracefully', () => {
    const input = '<a href="  JaVaScRiPt: alert(1)" onclick="steal()">Click <script>doEvil()</script></a><iframe src="x"></iframe>';
    expect(sanitizeAiCode(input)).toBe('<a href="#">Click </a>');
  });
});

describe('escapeHtml', () => {
  it('escapes special HTML characters to their entity equivalents', () => {
    const input = '<div class="test" data-id=\'1\'>&</div>';
    expect(escapeHtml(input)).toBe('&lt;div class=&quot;test&quot; data-id=&#039;1&#039;&gt;&amp;&lt;/div&gt;');
  });
});

describe('wrapCodePreview', () => {
  it('returns empty string for falsy input', () => {
    expect(wrapCodePreview('')).toBe('');
  });

  it('wraps code in a sandboxed iframe and escapes the srcdoc content', () => {
    const input = '<h1>Title</h1><script>alert(1)</script>';
    const result = wrapCodePreview(input);
    expect(result).toContain('<iframe sandbox="allow-same-origin"');
    expect(result).toContain('srcdoc="&lt;h1&gt;Title&lt;/h1&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
  });
});