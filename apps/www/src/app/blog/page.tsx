import { getAllPosts } from '@/lib/blog';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, tutorials, and updates from the Surfpool team.',
  openGraph: {
    title: 'Surfpool Blog',
    description: 'News, tutorials, and updates from the Surfpool team.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 675 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Surfpool Blog',
    description: 'News, tutorials, and updates from the Surfpool team.',
    images: ['/og.png'],
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-4xl px-6 py-24">
      <header className="mb-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Blog</h1>
        <p className="text-xl text-zinc-400">News, tutorials, and updates from the Surfpool team.</p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-400">No posts yet. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 transition-colors hover:border-zinc-700"
            >
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="mb-3 flex items-center gap-3 text-sm text-zinc-500">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span>·</span>
                  <span>{post.readingTime}</span>
                </div>
                <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white group-hover:text-[#00D4FF]">
                  {post.title}
                </h2>
                <p className="mb-4 text-zinc-400">{post.description}</p>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
