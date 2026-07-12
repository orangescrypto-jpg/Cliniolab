'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { Category, Subcategory } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      });
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Categories</h1>
      <p className="mt-2 text-ink-500">Browse quizzes by subject area.</p>

      <div className="mt-10 space-y-10">
        {categories.map((category) => (
          <div key={category.id}>
            <h2 className="font-display text-xl font-semibold text-ink-800">{category.name}</h2>
            <div className="chart-strip mt-2 mb-4 text-ink-300" aria-hidden />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subcategories
                .filter((s) => s.categoryId === category.id)
                .map((sub) => (
                  <Link key={sub.id} href={`/categories/${sub.slug}?category=${category.slug}`}>
                    <Card className="p-4 transition-shadow hover:shadow-md">
                      <span className="text-sm font-medium text-ink-700">{sub.name}</span>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
