import React, { useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import ProductCard from '@/components/ProductCard';
import CountdownTimer from '@/components/CountdownTimer';
import { mockProducts } from '@/data/products';
import type { Product } from '@/types/gdcl';
import styles from './index.module.scss';

const CATEGORIES = [
  { key: 'all', icon: '🏪', label: '全部' },
  { key: '校园二手', icon: '📚', label: '校园二手' },
  { key: '家乡特产', icon: '🎁', label: '家乡特产' },
  { key: '个人技能', icon: '💡', label: '个人技能' },
];

const MarketPage: React.FC = () => {
  const { searchResults, searchProducts, isConnected, cart } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [localResults, setLocalResults] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  const [activeCat, setActiveCat] = useState('all');

  const displayProducts = searchResults.length > 0
    ? searchResults
    : (searched ? localResults : mockProducts);

  const handleSearch = () => {
    if (!keyword.trim()) return;
    setSearched(true);
    const q = keyword.trim().toLowerCase();
    setLocalResults(mockProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
    ));
    if (isConnected) searchProducts(keyword.trim());
  };

  const handleCatTap = (cat: string) => {
    setActiveCat(cat);
    if (cat === 'all') {
      setSearched(false);
      return;
    }
    setSearched(true);
    const q = cat;
    setLocalResults(mockProducts.filter(
      (p) => p.name.includes(cat) || p.description.includes(cat)
    ));
  };

  return (
    <View className={styles.page}>
      {/* 品牌Hero */}
      <View className={styles.hero}>
        <View className={styles.heroContent}>
          <Text className={styles.heroTitle}>🔥 星火计划</Text>
          <Text className={styles.heroSub}>大学生创业大赛 · 一个人就是一家店</Text>
          <View className={styles.heroTimer}>
            <CountdownTimer />
          </View>
        </View>
      </View>

      {/* 分类入口 */}
      <View className={styles.categories}>
        {CATEGORIES.map((cat) => (
          <View
            key={cat.key}
            className={`${styles.catItem} ${activeCat === cat.key ? styles.catActive : ''}`}
            onClick={() => handleCatTap(cat.key)}
          >
            <Text className={styles.catIcon}>{cat.icon}</Text>
            <Text className={styles.catLabel}>{cat.label}</Text>
          </View>
        ))}
      </View>

      {/* 搜索栏 */}
      <View className={styles.searchBar}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            placeholder="搜搜好货..."
            placeholderStyle="color: #94a3b8"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={handleSearch}
          />
        </View>
        <View className={styles.cartBtn} onClick={() => Taro.navigateTo({ url: '/pages/cart/index' })}>
          <Text className={styles.cartEmoji}>🛒</Text>
          {cart.length > 0 && <View className={styles.cartBadge}><Text className={styles.cartBadgeText}>{cart.length}</Text></View>}
        </View>
      </View>

      {/* 商品列表 */}
      <ScrollView scrollY className={styles.scroll}>
        {displayProducts.length > 0 ? (
          <View className={styles.grid}>
            {displayProducts.map((product) => (
              <View key={product.sku} className={styles.gridItem}>
                <ProductCard product={product} onClick={(sku) => Taro.navigateTo({ url: `/pages/detail/index?sku=${sku}` })} />
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.empty}>
            <Text className={styles.emptyIcon}>📦</Text>
            <Text className={styles.emptyText}>
              {searched ? '没有找到相关商品' : '下拉搜索发现好货'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default MarketPage;
