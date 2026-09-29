import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, ModuleList } from '@/features/content/components/content';
import { PathProgress } from '@/features/progress/components/learning-progress';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog, orderedModules, pathSequence } from '@/lib/content/loader';
import { canonicalUrl } from '@/lib/content/urls';

type Props = { params: Promise<{ path: string }> };

export function generateStaticParams() {
  return loadCatalog().paths.map((learningPath) => ({ path: learningPath.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path: id } = await params;
  const learningPath = loadCatalog().pathById.get(id);
  if (!learningPath) return { title: 'Not found' };
  return {
    title: learningPath.title,
    description: learningPath.description,
    alternates: { canonical: canonicalUrl(`/paths/${learningPath.id}/`) },
    openGraph: {
      title: learningPath.title,
      description: learningPath.description,
      type: 'website',
    },
  };
}

export default async function PathPage({ params }: Props) {
  const { path: id } = await params;
  const catalog = loadCatalog();
  const learningPath = catalog.pathById.get(id);
  if (!learningPath) notFound();
  const modules = orderedModules(learningPath);
  const sequence = pathSequence(learningPath);
  const groups = [...new Set(modules.map((pathModule) => pathModule.group ?? 'Learning path'))];
  return (
    <SiteShell>
      <main id="main" className="page-shell path-page" data-progress-path={learningPath.id}>
        <Breadcrumbs
          items={[{ label: 'Learning Paths', href: '/paths/' }, { label: learningPath.title }]}
        />
        <header className="path-hero">
          <div>
            <span className="eyebrow">Learning Path · {modules.length} modules</span>
            <h1>{learningPath.title}</h1>
            <p>{learningPath.description}</p>
            <div className="path-stats">
              <span>{sequence.length} lessons</span>
              <span>Progress saved on this device</span>
            </div>
          </div>
          <PathProgress
            pathId={learningPath.id}
            articleIds={sequence.map((article) => article.id)}
            lessonCount={sequence.length}
          />
        </header>
        <div className="path-content">
          {groups.map((group) => {
            const groupedModules = modules.filter(
              (module) => (module.group ?? 'Learning path') === group,
            );
            return (
              <section className="path-group" key={group}>
                <div className="group-heading">
                  <div>
                    <span className="eyebrow">Learning path section</span>
                    <h2>{group}</h2>
                  </div>
                </div>
                <ModuleList modules={groupedModules} pathId={learningPath.id} catalog={catalog} />
              </section>
            );
          })}
        </div>
      </main>
    </SiteShell>
  );
}
