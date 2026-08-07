import type { RepositoryImport } from './repository.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('detector');

export interface TechnologyReport {
  languages: string[];
  primaryLanguage: string;
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  databases: string[];
  orms: string[];
  frontend: string[];
  backend: string[];
  testing: string[];
  docker: boolean;
  cicd: string[];
  monorepo: boolean;
  linters: string[];
  typescript: boolean;
}

export function detectTechnology(repo: RepositoryImport): TechnologyReport {
  const fileNames = new Set(repo.files.map((f) => f.path.split('/').pop() || ''));
  const filePaths = repo.files.map((f) => f.path);
  const hasFile = (name: string) =>
    fileNames.has(name) || filePaths.some((p) => p.endsWith('/' + name) || p === name);
  const hasExt = (ext: string) => (repo.extensions[ext] || 0) > 0;
  const hasContent = (pattern: string) => repo.files.some((f) => f.content.includes(pattern));

  // Languages
  const languages: string[] = [];
  if (hasExt('.ts') || hasExt('.tsx')) languages.push('TypeScript');
  if (hasExt('.js') || hasExt('.jsx')) languages.push('JavaScript');
  if (hasExt('.py')) languages.push('Python');
  if (hasExt('.java')) languages.push('Java');
  if (hasExt('.go')) languages.push('Go');
  if (hasExt('.rs')) languages.push('Rust');
  if (hasExt('.rb')) languages.push('Ruby');
  if (hasExt('.cs')) languages.push('C#');
  if (hasExt('.php')) languages.push('PHP');
  if (hasExt('.swift')) languages.push('Swift');
  if (hasExt('.kt')) languages.push('Kotlin');

  // Primary language (most files)
  const extCounts = Object.entries(repo.extensions).sort((a, b) => b[1] - a[1]);
  let primaryLanguage = 'Unknown';
  if (extCounts.length > 0) {
    const topExt = extCounts[0][0];
    if (['.ts', '.tsx'].includes(topExt)) primaryLanguage = 'TypeScript';
    else if (['.js', '.jsx'].includes(topExt)) primaryLanguage = 'JavaScript';
    else if (topExt === '.py') primaryLanguage = 'Python';
    else if (topExt === '.java') primaryLanguage = 'Java';
    else if (topExt === '.go') primaryLanguage = 'Go';
    else primaryLanguage = languages[0] || 'Unknown';
  }

  // Frameworks
  const frameworks: string[] = [];
  if (hasContent('from fastapi') || hasContent('import fastapi')) frameworks.push('FastAPI');
  if (hasContent('from django') || hasContent('import django')) frameworks.push('Django');
  if (hasContent('from flask') || hasContent('import flask')) frameworks.push('Flask');
  if (hasContent("require('express')") || hasContent("from 'express'")) frameworks.push('Express');
  if (hasContent("from 'next'") || hasFile('next.config.js') || hasFile('next.config.ts'))
    frameworks.push('Next.js');
  if (hasContent("from 'react'") || hasContent("from 'react-dom'")) frameworks.push('React');
  if (hasContent("from 'vue'") || hasFile('vue.config.js')) frameworks.push('Vue');
  if (hasContent("from '@angular'")) frameworks.push('Angular');
  if (hasContent("from 'nestjs'") || hasContent("from '@nestjs'")) frameworks.push('NestJS');
  if (hasFile('pom.xml')) frameworks.push('Spring');

  // Package managers
  const packageManagers: string[] = [];
  if (hasFile('package.json')) packageManagers.push('npm');
  if (hasFile('yarn.lock')) packageManagers.push('yarn');
  if (hasFile('pnpm-lock.yaml')) packageManagers.push('pnpm');
  if (hasFile('requirements.txt') || hasFile('Pipfile')) packageManagers.push('pip');
  if (hasFile('pyproject.toml')) packageManagers.push('poetry');
  if (hasFile('go.mod')) packageManagers.push('go modules');
  if (hasFile('Cargo.toml')) packageManagers.push('cargo');
  if (hasFile('Gemfile')) packageManagers.push('bundler');

  // Build systems
  const buildSystems: string[] = [];
  if (hasFile('webpack.config.js') || hasFile('webpack.config.ts')) buildSystems.push('Webpack');
  if (hasFile('vite.config.ts') || hasFile('vite.config.js')) buildSystems.push('Vite');
  if (hasFile('tsconfig.json')) buildSystems.push('TypeScript Compiler');
  if (hasFile('Makefile')) buildSystems.push('Make');
  if (hasFile('build.gradle') || hasFile('build.gradle.kts')) buildSystems.push('Gradle');
  if (hasFile('pom.xml')) buildSystems.push('Maven');

  // Databases
  const databases: string[] = [];
  if (hasContent('postgresql') || hasContent('postgres') || hasContent("'pg'"))
    databases.push('PostgreSQL');
  if (hasContent('mongodb') || hasContent('mongoose')) databases.push('MongoDB');
  if (hasContent('mysql')) databases.push('MySQL');
  if (hasContent('redis')) databases.push('Redis');
  if (hasContent('sqlite')) databases.push('SQLite');

  // ORMs
  const orms: string[] = [];
  if (hasContent('prisma')) orms.push('Prisma');
  if (hasContent('typeorm') || hasContent('TypeORM')) orms.push('TypeORM');
  if (hasContent('sequelize')) orms.push('Sequelize');
  if (hasContent('drizzle')) orms.push('Drizzle');
  if (hasContent('sqlalchemy')) orms.push('SQLAlchemy');

  // Frontend/Backend
  const frontend = frameworks.filter((f) => ['React', 'Vue', 'Angular', 'Next.js'].includes(f));
  const backend = frameworks.filter((f) =>
    ['Express', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring'].includes(f),
  );

  // Testing
  const testing: string[] = [];
  if (hasContent('vitest') || hasFile('vitest.config.ts')) testing.push('Vitest');
  if (hasContent('jest') || hasFile('jest.config.js') || hasFile('jest.config.ts'))
    testing.push('Jest');
  if (hasContent('mocha')) testing.push('Mocha');
  if (hasContent('pytest')) testing.push('Pytest');
  if (hasContent('cypress')) testing.push('Cypress');
  if (hasContent('playwright')) testing.push('Playwright');

  // Docker
  const docker =
    hasFile('Dockerfile') || hasFile('docker-compose.yml') || hasFile('docker-compose.yaml');

  // CI/CD
  const cicd: string[] = [];
  if (filePaths.some((p) => p.includes('.github/workflows'))) cicd.push('GitHub Actions');
  if (hasFile('.gitlab-ci.yml')) cicd.push('GitLab CI');
  if (hasFile('Jenkinsfile')) cicd.push('Jenkins');
  if (hasFile('.circleci/config.yml')) cicd.push('CircleCI');

  // Monorepo
  const monorepo =
    hasFile('lerna.json') ||
    hasFile('pnpm-workspace.yaml') ||
    hasFile('turbo.json') ||
    hasContent('"workspaces"');

  // Linters
  const linters: string[] = [];
  if (hasFile('.eslintrc.js') || hasFile('.eslintrc.json') || hasFile('eslint.config.js'))
    linters.push('ESLint');
  if (hasFile('.prettierrc') || hasFile('.prettierrc.json')) linters.push('Prettier');
  if (hasFile('.stylelintrc')) linters.push('Stylelint');

  const typescript = hasFile('tsconfig.json');

  const report: TechnologyReport = {
    languages,
    primaryLanguage,
    frameworks,
    packageManagers,
    buildSystems,
    databases,
    orms,
    frontend,
    backend,
    testing,
    docker,
    cicd,
    monorepo,
    linters,
    typescript,
  };

  log.info(
    { primaryLanguage, frameworks: frameworks.length, databases: databases.length },
    'Technology detected',
  );
  return report;
}
