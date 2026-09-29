import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicGuide } from '@/features/content/components/public-guide';
import { examples, getExample } from '@/lib/examples/registry';

type ExamplePageProps = {
  params: Promise<{ example: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return examples.map(({ id }) => ({ example: id }));
}

export async function generateMetadata({ params }: ExamplePageProps): Promise<Metadata> {
  const { example: id } = await params;
  const example = getExample(id);
  if (!example) notFound();

  return {
    title: example.title,
    description: `Guide and public files for the ${example.title} example.`,
  };
}

export default async function ExamplePage({ params }: ExamplePageProps) {
  const { example: id } = await params;
  const example = getExample(id);
  if (!example) notFound();

  let guide: string;
  try {
    guide = await readFile(
      path.join(process.cwd(), 'examples', example.directory, example.guide),
      'utf8',
    );
  } catch {
    notFound();
  }

  return (
    <PublicGuide
      kind="examples"
      id={example.id}
      title={example.title}
      guide={guide}
      publicFiles={example.publicFiles}
    />
  );
}
