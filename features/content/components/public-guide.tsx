import { SiteShell } from '@/components/site-shell';
import { Breadcrumbs } from '@/features/content/components/content';
import { sitePath } from '@/lib/site-path';

type PublicGuideProps = {
  kind: 'labs' | 'examples';
  id: string;
  title: string;
  guide: string;
  publicFiles: readonly string[];
};

export function PublicGuide({ kind, id, title, guide, publicFiles }: PublicGuideProps) {
  const label = kind === 'labs' ? 'Hands-on lab' : 'Example project';

  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs
          items={[
            { label: kind === 'labs' ? 'Labs' : 'Examples' },
            { label: title },
          ]}
        />
        <header className="page-intro">
          <span className="eyebrow">{label}</span>
          <h1>{title}</h1>
          <p>Learning content and project files for this guide.</p>
        </header>
        <article className="guide-source">
          <pre>{guide}</pre>
        </article>
        {publicFiles.length > 0 && (
          <section className="guide-files" aria-labelledby="guide-files-title">
            <h2 id="guide-files-title">Downloadable files</h2>
            <ul>
              {publicFiles.map((file) => (
                <li key={file}>
                  <a href={sitePath(`/${kind}/${id}/files/${file}`)}>{file}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </SiteShell>
  );
}
