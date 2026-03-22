import { describe, it, expect } from 'vitest';
import { clusterFindings, type ClusterInput } from '../engine';

describe('clusterFindings', () => {
  it('groups findings with the same rule and similar structure', () => {
    const findings: ClusterInput[] = [
      { id: '1', ruleId: 'image-alt', selector: 'header > img.logo', elementHtml: '<img class="logo" src="/logo.png">', pageUrl: '/page1' },
      { id: '2', ruleId: 'image-alt', selector: 'header > img.logo', elementHtml: '<img class="logo" src="/logo.png">', pageUrl: '/page2' },
      { id: '3', ruleId: 'image-alt', selector: 'header > img.logo', elementHtml: '<img class="logo" src="/logo.png">', pageUrl: '/page3' },
    ];

    const clusters = clusterFindings(findings);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3);
  });

  it('separates findings with different rules', () => {
    const findings: ClusterInput[] = [
      { id: '1', ruleId: 'image-alt', selector: 'img', elementHtml: '<img src="a.png">', pageUrl: '/p1' },
      { id: '2', ruleId: 'button-name', selector: 'button', elementHtml: '<button></button>', pageUrl: '/p1' },
    ];

    const clusters = clusterFindings(findings);
    expect(clusters).toHaveLength(2);
  });

  it('separates structurally different findings of the same rule', () => {
    const findings: ClusterInput[] = [
      { id: '1', ruleId: 'image-alt', selector: 'header > img.logo', elementHtml: '<img class="logo" src="/logo.png">', pageUrl: '/p1' },
      { id: '2', ruleId: 'image-alt', selector: 'article > figure > img', elementHtml: '<img src="/photo.jpg" width="800">', pageUrl: '/p2' },
    ];

    const clusters = clusterFindings(findings);
    expect(clusters).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(clusterFindings([])).toHaveLength(0);
  });

  it('returns single-member clusters for unique findings', () => {
    const findings: ClusterInput[] = [
      { id: '1', ruleId: 'label', selector: 'form > input#email', elementHtml: '<input id="email" type="email">', pageUrl: '/p1' },
    ];

    const clusters = clusterFindings(findings);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(1);
  });
});
