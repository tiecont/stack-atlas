import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog } from '../lib/content/loader.ts';
import type { Article } from '../lib/content/types.ts';

const ROOT = process.cwd();
const output = path.join(ROOT, 'docs/audits/canonical-duplicates.md');

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\d+[-_.\s]*/, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size && !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / (left.size + right.size - common);
}

function longestBlock(left: string, right: string): { left: number; right: number; size: number } {
  let previous = new Uint32Array(right.length + 1);
  let bestLeft = 0;
  let bestRight = 0;
  let bestSize = 0;
  for (let i = 0; i < left.length; i += 1) {
    const current = new Uint32Array(right.length + 1);
    for (let j = 0; j < right.length; j += 1) {
      if (left[i] !== right[j]) continue;
      current[j + 1] = previous[j] + 1;
      if (current[j + 1] > bestSize) {
        bestLeft = i + 1 - current[j + 1];
        bestRight = j + 1 - current[j + 1];
        bestSize = current[j + 1];
      }
    }
    previous = current;
  }
  return { left: bestLeft, right: bestRight, size: bestSize };
}

function matchingCharacters(left: string, right: string): number {
  const block = longestBlock(left, right);
  if (!block.size) return 0;
  return (
    block.size +
    matchingCharacters(left.slice(0, block.left), right.slice(0, block.right)) +
    matchingCharacters(left.slice(block.left + block.size), right.slice(block.right + block.size))
  );
}

function similarity(left: string, right: string): number {
  if (!left.length && !right.length) return 1;
  return (2 * matchingCharacters(left, right)) / (left.length + right.length);
}

type Candidate = {
  left: Article;
  right: Article;
  signals: string[];
  titleSimilarity: number;
  tagOverlap: number;
  descriptionOverlap: number;
};

function findCandidates(articles: Article[]): Candidate[] {
  const candidates: Candidate[] = [];
  const ordered = [...articles].sort(
    (left, right) => left.domain.localeCompare(right.domain) || left.id.localeCompare(right.id),
  );
  for (let i = 0; i < ordered.length; i += 1) {
    const left = ordered[i];
    for (const right of ordered.slice(i + 1)) {
      if (left.domain !== right.domain) continue;
      const leftTitle = normalize(left.title);
      const rightTitle = normalize(right.title);
      const titleSimilarity = similarity(leftTitle, rightTitle);
      const slugMatch =
        normalize(left.url.split('/').filter(Boolean).at(-1) ?? '') ===
        normalize(right.url.split('/').filter(Boolean).at(-1) ?? '');
      const tagOverlap = overlap(new Set(left.tags), new Set(right.tags));
      const descriptionOverlap = overlap(tokenSet(left.description), tokenSet(right.description));
      const signals: string[] = [];
      if (leftTitle === rightTitle) signals.push('same normalized title');
      if (slugMatch) signals.push('same slug after numeric-prefix removal');
      if (titleSimilarity >= 0.82) signals.push(`similar title (${titleSimilarity.toFixed(2)})`);
      if (tagOverlap >= 0.75) signals.push(`tag overlap (${tagOverlap.toFixed(2)})`);
      if (descriptionOverlap >= 0.55)
        signals.push(`description overlap (${descriptionOverlap.toFixed(2)})`);
      if (
        slugMatch ||
        leftTitle === rightTitle ||
        (titleSimilarity >= 0.82 && tagOverlap >= 0.25) ||
        (tagOverlap >= 0.75 && descriptionOverlap >= 0.55 && titleSimilarity >= 0.45)
      ) {
        candidates.push({ left, right, signals, titleSimilarity, tagOverlap, descriptionOverlap });
      }
    }
  }
  return candidates;
}

const decisions = new Map<string, [string, string]>([
  [
    [
      'season-10-distributed-systems-10-consensus-problem',
      'season-21-consensus-coordination-01-consensus-problem',
    ]
      .sort()
      .join('|'),
    [
      'B',
      'Same concept, different depth. Keep both for now; rename the fundamentals lesson and state clearly that it covers agreement and safety while the other article develops quorum, epochs and production context.',
    ],
  ],
  [
    [
      'season-10-distributed-systems-04-consistency-models',
      'season-20-distributed-data-05-consistency-models',
    ]
      .sort()
      .join('|'),
    [
      'B',
      'Same concept, different depth. Preserve the broad consistency-contract treatment and the shorter data-store application lesson; make the latter scope explicit in its title and opening.',
    ],
  ],
  [
    [
      'season-10-distributed-systems-13-distributed-locks',
      'season-20-distributed-data-11-distributed-locks',
    ]
      .sort()
      .join('|'),
    [
      'B',
      'Same concept, different depth. Keep the failure-model overview and the focused lease/fencing treatment; rename the focused lesson so its additional scope is clear.',
    ],
  ],
  [
    [
      'season-10-distributed-systems-09-partitioning-sharding',
      'season-20-distributed-data-06-partitioning-sharding',
    ]
      .sort()
      .join('|'),
    [
      'B',
      'Same concept, different depth. Retain the concise hash-versus-range introduction and the broader lesson covering shard keys, consistent hashing, rebalancing, and production trade-offs; clarify these scopes in the titles or openings.',
    ],
  ],
  [
    ['season-03-concurrency-04-mutex', 'season-03-concurrency-05-rwmutex'].sort().join('|'),
    [
      'C',
      'Related but distinct synchronization tools. Keep both: the Mutex lesson covers exclusive critical sections and safe ownership, while RWMutex covers concurrent readers, exclusive writers, workload trade-offs, and benchmarking. Make the relationship explicit in cross-links.',
    ],
  ],
]);

const candidates = findCandidates(loadCatalog().articles);
if (process.argv.includes('--preview')) {
  candidates.forEach((candidate) =>
    process.stdout.write(
      `${candidate.left.id} <> ${candidate.right.id} | ${candidate.signals.join(', ')}\n`,
    ),
  );
  process.stdout.write(`${candidates.length} candidate pairs\n`);
} else {
  const missing = candidates.filter(
    (candidate) => !decisions.has([candidate.left.id, candidate.right.id].sort().join('|')),
  );
  if (missing.length) {
    process.stderr.write(
      `${missing.length} candidate pair(s) need manual classification; run with --preview.\n`,
    );
    process.exitCode = 1;
  } else {
    const lines = [
      '# Canonical article overlap audit',
      '',
      'Generated by `npm run audit:content`. Candidate generation is a review aid; it never merges articles or changes IDs, routes, content, or path membership.',
      '',
      '## Classification key',
      '',
      '- **A — True duplicate:** consolidate only after preserving unique material, memberships, and every historical URL.',
      '- **B — Same concept, different depth:** retain both and make their scopes explicit.',
      '- **C — Related but distinct:** retain both and explain the relationship.',
      '- **D — False positive:** no content change is needed.',
      '',
      '## Candidates and decisions',
      '',
      '| Classification | Candidate articles | Evidence | Decision / follow-up |',
      '|---|---|---|---|',
    ];
    for (const candidate of candidates) {
      const key = [candidate.left.id, candidate.right.id].sort().join('|');
      const [classification, decision] = decisions.get(key)!;
      const refs =
        '[`' +
        candidate.left.id +
        '`](' +
        candidate.left.url +
        ') / [`' +
        candidate.right.id +
        '`](' +
        candidate.right.url +
        ')';
      lines.push(
        `| **${classification}** | ${refs}<br>${candidate.left.title} / ${candidate.right.title} | ${candidate.signals.join('; ')} | ${decision} |`,
      );
    }
    lines.push(
      '',
      '## URL and content handling',
      '',
      'No consolidation is proposed by this audit. All current canonical IDs and URLs remain stable. Each historical lesson URL remains in the article’s `legacy_urls` metadata and is served as a native Next.js redirect. If a future consolidation is approved, move all useful material and path memberships to the retained article before redirecting the retired canonical URL; retain every old season URL as an alias.',
      '',
      `The current candidate set contains ${candidates.length} pairs across ${loadCatalog().articles.length} published article records.`,
      '',
    );
    writeFileSync(output, lines.join('\n'), 'utf8');
    process.stdout.write(
      `Wrote docs/audits/canonical-duplicates.md with ${candidates.length} classified candidate pairs.\n`,
    );
  }
}
