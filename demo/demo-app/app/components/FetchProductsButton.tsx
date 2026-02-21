"use client";

import { useState } from "react";

type Product = {
  id: number;
  name: string;
  price: number;
  formattedPrice: string;
};

export default function FetchProductsButton() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test");
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: Product[] = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Products API
      </h2>
      <button
        onClick={fetchProducts}
        disabled={loading}
        className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Fetching…" : "Fetch Products"}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {products && products.length > 0 && (
        <ul className="mt-3 space-y-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {p.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {p.formattedPrice}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
