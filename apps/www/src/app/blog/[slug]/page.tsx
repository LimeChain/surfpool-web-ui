import { getAllPosts, getPostBySlug } from '@/lib/blog';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  const siteUrl = 'https://surfpool.run';
  const postUrl = `${siteUrl}/blog/${slug}`;

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: postUrl,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: post.image
        ? [{ url: post.image, width: 1200, height: 675 }]
        : [{ url: '/og.png', width: 1200, height: 675 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.image ? [post.image] : ['/og.png'],
    },
    alternates: {
      canonical: postUrl,
    },
  };
}

/*
 * Typography Best Practices Applied:
 *
 * 1. Font size: 18px (text-lg) for body - optimal for long-form reading
 * 2. Line height: 1.8 (leading-[1.8]) - 180% for comfortable reading
 * 3. Line length: max-w-[680px] - keeps lines at 65-75 characters
 * 4. Paragraph spacing: mb-6 - 1.5x line height for clear separation
 * 5. Letter spacing: tracking-[0.01em] - slightly increased for body text
 *
 * Dark Mode Color Best Practices:
 * 1. Body text: #d4d4d8 (zinc-300) - not pure white, reduces eye strain
 * 2. Headings: #fafafa (zinc-50) - brighter for hierarchy
 * 3. Secondary: #a1a1aa (zinc-400) - for metadata and captions
 * 4. Links: Desaturated cyan - easier on eyes than saturated colors
 * 5. Code: Subtle background distinction without harsh contrast
 */

const components = {
  // Headings: Clear hierarchy, generous top margin for sections
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="mb-6 mt-16 text-[1.875rem] font-bold leading-tight tracking-tight text-zinc-50 first:mt-0 md:text-[2.25rem]"
      {...props}
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mb-4 mt-14 text-[1.5rem] font-semibold leading-tight tracking-tight text-zinc-50 md:text-[1.75rem]"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="mb-3 mt-10 text-[1.25rem] font-semibold leading-snug text-zinc-100"
      {...props}
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className="mb-2 mt-8 text-[1.125rem] font-medium leading-snug text-zinc-100"
      {...props}
    />
  ),

  // Body text: 18px, 180% line height, slight letter spacing
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className="mb-6 text-[1.125rem] leading-[1.8] tracking-[0.01em] text-zinc-300"
      {...props}
    />
  ),

  // Links: Desaturated cyan, clear hover state
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-[#5eead4] underline decoration-[#5eead4]/40 underline-offset-[3px] transition-colors hover:text-[#99f6e4] hover:decoration-[#99f6e4]/60"
      {...props}
    />
  ),

  // Lists: Consistent spacing, proper indentation
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mb-6 ml-1 list-disc space-y-3 pl-6 text-[1.125rem] leading-[1.8] tracking-[0.01em] text-zinc-300 marker:text-zinc-500"
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mb-6 ml-1 list-decimal space-y-3 pl-6 text-[1.125rem] leading-[1.8] tracking-[0.01em] text-zinc-300 marker:text-zinc-500"
      {...props}
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="pl-2" {...props} />
  ),

  // Blockquotes: Subtle background, clear left border
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-8 border-l-[3px] border-zinc-600 bg-zinc-900/30 py-4 pl-6 pr-5 text-[1.0625rem] leading-[1.75] text-zinc-400"
      {...props}
    />
  ),

  // Code: Inline vs block differentiation
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    const isInline = typeof props.children === 'string' && !props.children.includes('\n');
    if (isInline) {
      return (
        <code
          className="rounded-md bg-zinc-800/80 px-[0.4em] py-[0.2em] font-mono text-[0.9em] text-[#5eead4]"
          {...props}
        />
      );
    }
    return <code className="font-mono text-[0.875rem] leading-relaxed" {...props} />;
  },

  // Code blocks: More padding, subtle border
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-8 overflow-x-auto rounded-xl border border-zinc-800/80 bg-[#0c0c0c] p-5 font-mono text-[0.875rem] leading-relaxed"
      {...props}
    />
  ),

  // Horizontal rule: Generous spacing
  hr: () => <hr className="my-12 border-zinc-800" />,

  // Images: Rounded, full width with caption support
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="my-8 w-full rounded-xl"
      alt={props.alt || ''}
      {...props}
    />
  ),

  // Strong: Slightly brighter than body for emphasis
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-zinc-100" {...props} />
  ),

  // Em: Inherit color, true italic
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic" {...props} />
  ),
};

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.date,
    publisher: {
      '@type': 'Organization',
      name: 'Surfpool',
      url: 'https://surfpool.run',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://surfpool.run/blog/${slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/*
        Article container: max-w-[680px] for optimal line length (65-75 chars)
        Generous vertical padding for breathing room
      */}
      <article className="mx-auto max-w-[680px] px-6 py-16 md:py-24">
        {/* Header section */}
        <header className="mb-12 md:mb-16">
          <Link
            href="/blog"
            className="mb-10 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to blog
          </Link>

          {/* Meta information: date, reading time, author */}
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem] text-zinc-500">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-zinc-600">·</span>
            <span>{post.readingTime}</span>
            <span className="text-zinc-600">·</span>
            <span>{post.author}</span>
          </div>

          {/* Title: Large, bold, tight tracking */}
          <h1 className="mb-5 text-[2rem] font-bold leading-[1.2] tracking-tight text-zinc-50 md:text-[2.5rem]">
            {post.title}
          </h1>

          {/* Description: Larger secondary text */}
          <p className="text-[1.1875rem] leading-relaxed text-zinc-400 md:text-[1.3125rem]">
            {post.description}
          </p>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[0.8125rem] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Separator between header and content */}
        <div className="mb-12 border-t border-zinc-800/60 md:mb-14" />

        {/* Article content */}
        <div className="prose prose-invert max-w-none">
          <MDXRemote source={post.content} components={components} />
        </div>

        {/* Footer separator */}
        <div className="mt-16 border-t border-zinc-800/60 pt-8 md:mt-20">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[0.9375rem] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to all posts
          </Link>
        </div>
      </article>
    </>
  );
}
