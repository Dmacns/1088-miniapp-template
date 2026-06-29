import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import type { Product } from '@/types/gdcl';
import styles from './index.module.scss';

interface ProductCardProps {
  product: Product;
  onClick: (sku: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const stockLabel = product.stock > 100 ? '充足' : product.stock > 10 ? `${product.stock}件` : '即将售罄';
  const stockClass = product.stock > 100 ? styles.stockOk : product.stock > 10 ? styles.stockLow : styles.stockOut;

  return (
    <View className={styles.card} onClick={() => onClick(product.sku)}>
      <View className={styles.imgWrap}>
        <Image className={styles.image} src={product.image} mode="aspectFill" />
        <View className={`${styles.stockBadge} ${stockClass}`}>
          <Text className={styles.stockText}>{stockLabel}</Text>
        </View>
      </View>
      <View className={styles.info}>
        <Text className={styles.name}>{product.name}</Text>
        <View className={styles.priceRow}>
          <Text className={styles.price}>¥{product.price.toFixed(2)}</Text>
          <Text className={styles.unit}>/{product.unit}</Text>
        </View>
        <View className={styles.footer}>
          <Text className={styles.location}>📍 {product.location}</Text>
          {product.seller_name && (
            <Text className={styles.seller}>{product.seller_name}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default ProductCard;
