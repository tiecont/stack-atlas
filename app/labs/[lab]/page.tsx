import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicGuide } from '@/features/content/components/public-guide';
import { getLab, labs } from '@/lib/labs/registry';

type LabPageProps = {
  params: Promise<{ lab: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return labs.map(({ id }) => ({ lab: id }));
}

export async function generateMetadata({ params }: LabPageProps): Promise<Metadata> {
  const { lab: id } = await params;
  const lab = getLab(id);
  if (!lab) notFound();

  return {
    title: `${lab.title} lab`,
    description: `Learning guide and public files for the ${lab.title} lab.`,
  };
}

export default async function LabPage({ params }: LabPageProps) {
  const { lab: id } = await params;
  const lab = getLab(id);
  if (!lab) notFound();

  let guide: string;
  try {
    guide = await readFile(path.join(process.cwd(), 'labs', lab.directory, lab.guide), 'utf8');
  } catch {
    notFound();
  }

  return (
    <PublicGuide
      kind="labs"
      id={lab.id}
      title={lab.title}
      guide={guide}
      publicFiles={lab.publicFiles}
    />
  );
}
