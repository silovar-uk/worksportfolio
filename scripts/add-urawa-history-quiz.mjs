import { readFile, writeFile } from 'node:fs/promises';

const projectsUrl = new URL('../data/projects.json', import.meta.url);
const projects = JSON.parse(await readFile(projectsUrl, 'utf8'));
const id = 'urawa-history-quiz';

const canonical = {
  id,
  title: 'URAWA HISTORY QUIZ',
  subtitle: '浦和レッズの歴史を、クイズから「流れ」で覚える学習アプリ',
  summary: '浦和レッズの1992〜2025年の歴史を、年・選手・監督・ユニフォーム・出来事を結びつけるクイズとHistory導線で学ぶ、DB駆動の静的Webアプリ。',
  friction: '浦和レッズの歴史を年表や単発の知識として覚えても、選手・監督・ユニフォーム・出来事のつながりまで思い出せず、知識が点のまま残りやすかった。',
  firstBuild: '1992〜2025の34シーズン、players / managers / uniforms / sourcesの履歴データとDB-driven Quiz Engineを持つ初期MVPから始めた。',
  currentAnswer: 'Question → Answer → Memory Hook → History → Next Questionの学習ループで、TODAY / QUIZ / HISTORY / SEASON / PLAYER / YOUを行き来しながら、浦和の歴史を点ではなく流れとして覚える。',
  type: 'learning-tool',
  verbs: ['解く', '学ぶ', 'たどる'],
  status: 'development',
  editorialState: 'published',
  startedAt: '2026-09-07',
  createdAt: '2026-09-07',
  updatedAt: '2026-09-07',
  liveUrl: 'https://silovar-uk.github.io/urawa-history-quiz/',
  repositoryUrl: 'https://github.com/silovar-uk/urawa-history-quiz',
  technologies: ['HTML', 'CSS', 'JavaScript', 'JSON', 'localStorage', 'GitHub Pages'],
  documentationState: 'verified',
  relatedProjects: [
    { id: 'footballisfun', relation: 'サッカーを入口に知識と文脈を深める' }
  ],
  updates: [],
  aside: '',
  extension: null,
  searchAliases: ['URAWA HISTORY QUIZ', 'urawa-history-quiz', '浦和レッズ', '浦和歴史クイズ', 'レッズ歴史', '歴史クイズ']
};

const existing = projects.find((project) => project?.id === id);
if (existing) Object.assign(existing, canonical);
else projects.push(canonical);

projects.sort((a, b) => String(a.id).localeCompare(String(b.id)));
await writeFile(projectsUrl, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
console.log('Registered and published URAWA HISTORY QUIZ as a canonical project.');
