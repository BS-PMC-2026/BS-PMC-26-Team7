import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ProductResponse } from '@/services/productService';

interface ProductCardProps {
  product: ProductResponse;
  showEditButton?: boolean;
}

export default function ProductCard({ product, showEditButton = false }: ProductCardProps) {
  const outOfStock = product.AllocatedQuantity === 0;

  return (
    <Card
      className={`overflow-hidden flex flex-col transition rounded-2xl ${
        outOfStock ? 'opacity-50 hover:shadow-none' : 'hover:shadow-md'
      }`}
    >
      <div className="relative w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {product.ImageUrl ? (
          <img
            src={product.ImageUrl}
            alt={product.ProductName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement as HTMLElement;
              parent.innerHTML = '<span style="font-size:2.5rem">🛒</span>';
            }}
          />
        ) : (
          <span className="text-5xl opacity-30">🛒</span>
        )}

        {outOfStock && (
          <span className="absolute top-2 left-2 rounded-full bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
            Out of stock
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{product.ProductName}</h3>
          {product.Category && (
            <Badge className="bg-gray-100 text-gray-600 border border-gray-200 shrink-0">{product.Category}</Badge>
          )}
        </div>

        {product.ProductDescription && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-0.5">{product.ProductDescription}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <p className="text-sm font-bold text-gray-900">${Number(product.Price).toFixed(2)}</p>
          <p className={`text-xs font-medium ${outOfStock ? 'text-red-600' : 'text-gray-600'}`}>
            {outOfStock ? 'Out of stock' : `${product.AllocatedQuantity} left`}
          </p>
        </div>

        {showEditButton && (
          <Link
            href={`/manager/products/${product.ProductId}/edit`}
            className="mt-2 w-full text-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            ✏️ Edit
          </Link>
        )}
      </div>
    </Card>
  );
}