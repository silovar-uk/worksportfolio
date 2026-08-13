(() => {
  'use strict';

  const data = window.BUILD_DIARY_DATA;
  if (!data || !Array.isArray(data.projects)) return;

  const knownTypes = new Set([
    'web-app',
    'chrome-extension',
    'learning-tool',
    'design-system',
    'content-page',
    'data-tool',
    'utility',
    'experiment'
  ]);
  const typeAliases = {
    extension: 'chrome-extension',
    'browser-extension': 'chrome-extension',
    web: 'web-app',
    app: 'web-app',
    learning: 'learning-tool',
    content: 'content-page',
    data: 'data-tool',
    tool: 'utility'
  };
  const knownStatuses = new Set(['development', 'active', 'prototype', 'dormant', 'legacy']);
  const knownDocumentation = new Set(['verified', 'inferred', 'unreviewed']);
  const issues = {
    duplicateIds: [],
    droppedProjects: 0,
    brokenRelations: 0,
    brokenPeriodReferences: 0,
    brokenSettingReferences: 0,
    unknownTypes: [],
    unknownStatuses: []
  };

  const uniqueStrings = (values) => [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
  const projectMap = new Map();

  data.projects.forEach((source) => {
    if (!source || typeof source.id !== 'string' || !source.id.trim()) {
      issues.droppedProjects += 1;
      return;
    }
    const project = { ...source, id: source.id.trim() };
    const alias = typeAliases[project.type];
    if (alias) project.type = alias;
    if (!knownTypes.has(project.type)) {
      issues.unknownTypes.push(project.type || '(未設定)');
      project.type = 'utility';
    }
    if (!knownStatuses.has(project.status)) {
      issues.unknownStatuses.push(project.status || '(未設定)');
      project.status = 'prototype';
    }
    if (!knownDocumentation.has(project.documentationState)) project.documentationState = 'unreviewed';
    project.verbs = uniqueStrings(project.verbs);
    project.technologies = uniqueStrings(project.technologies);
    project.relatedProjects = Array.isArray(project.relatedProjects) ? project.relatedProjects : [];
    if (projectMap.has(project.id)) issues.duplicateIds.push(project.id);
    projectMap.set(project.id, project);
  });

  data.projects = [...projectMap.values()];
  const validIds = new Set(data.projects.map((project) => project.id));

  data.projects.forEach((project) => {
    const before = project.relatedProjects.length;
    project.relatedProjects = project.relatedProjects.filter((relation) => relation && validIds.has(relation.id) && relation.id !== project.id);
    issues.brokenRelations += before - project.relatedProjects.length;
  });

  if (Array.isArray(data.periods)) {
    data.periods = data.periods.map((period) => {
      const projectIds = Array.isArray(period.projectIds) ? period.projectIds : [];
      const filtered = [...new Set(projectIds.filter((id) => validIds.has(id)))];
      issues.brokenPeriodReferences += projectIds.length - filtered.length;
      return { ...period, projectIds: filtered };
    });
  }

  if (data.settings && typeof data.settings === 'object') {
    ['featuredProjectIds', 'recentProjectIds'].forEach((key) => {
      if (!Array.isArray(data.settings[key])) return;
      const filtered = [...new Set(data.settings[key].filter((id) => validIds.has(id)))];
      issues.brokenSettingReferences += data.settings[key].length - filtered.length;
      data.settings[key] = filtered;
    });
  }

  const countBy = (key) => data.projects.reduce((result, project) => {
    const value = project[key] || 'unknown';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  const counts = {
    total: data.projects.length,
    repositories: data.projects.filter((project) => Boolean(project.repositoryUrl)).length,
    livePages: data.projects.filter((project) => Boolean(project.liveUrl)).length,
    localOnly: data.projects.filter((project) => !project.liveUrl && !project.repositoryUrl).length,
    byType: countBy('type'),
    byStatus: countBy('status'),
    byDocumentation: countBy('documentationState')
  };

  window.WORKS_PORTFOLIO_AUDIT = {
    generatedAt: new Date().toISOString(),
    counts,
    issues: {
      ...issues,
      duplicateIds: [...new Set(issues.duplicateIds)],
      unknownTypes: [...new Set(issues.unknownTypes)],
      unknownStatuses: [...new Set(issues.unknownStatuses)]
    }
  };

  function replaceStaticCounts() {
    const selectors = [
      'header',
      '.hero',
      '[class*="hero"]',
      '[class*="stat"]',
      '[class*="summary"]'
    ];
    const roots = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        let text = node.nodeValue || '';
        text = text.replace(/\d+のリポジトリも、/g, `公開中の${counts.total}作品を、`);
        text = text.replace(/GitHub上の\d+リポジトリと、自作したChrome拡張を統合しています。/g, `GitHubと手元の制作物、全${counts.total}件を公開対象に合わせて整理しています。`);
        text = text.replace(/\d+\s*作品/g, `${counts.total}作品`);
        text = text.replace(/\d+\s*リポジトリ/g, `${counts.repositories}リポジトリ`);
        node.nodeValue = text;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', replaceStaticCounts, { once: true });
  else replaceStaticCounts();
  document.dispatchEvent(new CustomEvent('worksportfolio:audit', { detail: window.WORKS_PORTFOLIO_AUDIT }));
})();
