import type { Article, LearningPath, PathModule } from './types.ts';

export const ROOT = process.cwd();

export function orderedModules(learningPath: LearningPath): PathModule[] {
  return [...learningPath.modules].sort((left, right) => left.order - right.order);
}

export function pathSequence(learningPath: LearningPath): Article[] {
  return orderedModules(learningPath).flatMap((pathModule) => pathModule.articles);
}
