import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import { mockProducts } from '@/data/products';
import type { Product } from '@/types/gdcl';
import styles from './index.module.scss';

interface SavedAddress {
  id: string;
  label: string;
  contactName: string;
  contactPhone: string;
  province: string;
  city: string;
  district: string;
  town: string;
  detail: string;
  fullAddress: string;
}

const DetailPage: React.FC = () => {
  const { proposeOrder, identity, addToCart, searchResults, directBuy } = useAppStore();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [address, setAddress] = useState('');
  const [receiveAddrs, setReceiveAddrs] = useState<SavedAddress[]>([]);
  const [showAddrPicker, setShowAddrPicker] = useState(false);
  const [mode, setMode] = useState<'buy' | 'view'>('buy');
  // 协商弹窗
  const [showNego, setShowNego] = useState(false);
  const [negoPrice, setNegoPrice] = useState('');
  const [negoNote, setNegoNote] = useState('');
  // 购买弹窗
  const [showBuy, setShowBuy] = useState(false);

  // 加载收货地址列表，设置默认收货地
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync('addr_receive');
      if (saved) {
        const list: SavedAddress[] = JSON.parse(saved);
        setReceiveAddrs(list);
        if (list.length > 0) {
          setAddress(list[0].fullAddress);
        }
      } else {
        const old = Taro.getStorageSync('my_receive_addr');
        if (old) setAddress(old);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    const sku = params?.sku;
    if (sku) {
      // 优先从 GDCL 搜索结果中找
      let found: Product | undefined = searchResults.find((p) => p.sku === sku);
      // 再从 mock 数据中找
      if (!found) {
        found = mockProducts.find((p) => p.sku === sku);
      }
      if (found) {
        setProduct(found);
        if (identity?.did && found.seller_did === identity.did) {
          setMode('view');
        }
      }
    }
  }, [identity, searchResults]);

  const total = product ? product.price * qty : 0;

  const handleBuy = () => {
    if (!address.trim()) {
      Taro.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }
    setShowBuy(true);
  };

  const confirmBuy = () => {
    if (!product) return;
    setShowBuy(false);
    const orderId = directBuy(product.sku, qty, product.price, product.name, product.seller_did);
    if (orderId) {
      Taro.showToast({ title: '下单成功', icon: 'success' });
      setTimeout(() => Taro.switchTab({ url: '/pages/orders/index' }), 800);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty,
      unit: product.unit,
      image: product.image,
      seller_did: product.seller_did,
      seller_name: product.seller_name,
    });
  };

  // 发起协商
  const openNego = () => {
    if (!product) return;
    setNegoPrice(product.price.toFixed(2));
    setNegoNote('');
    setShowNego(true);
  };

  const submitNego = () => {
    const askPrice = parseFloat(negoPrice);
    if (isNaN(askPrice) || askPrice <= 0) {
      Taro.showToast({ title: '请输入有效期望价格', icon: 'none' });
      return;
    }
    setShowNego(false);
    if (!product) return;
    // 使用协商价格创建提案
    const orderId = proposeOrder(product.sku, qty, askPrice, product.name, product.seller_did);
    if (orderId) {
      Taro.showToast({ title: '协商请求已发起', icon: 'success' });
      Taro.navigateTo({ url: `/pages/nego-detail/index?orderId=${orderId}` });
    }
  };

  if (!product) {
    return (
      <View className={styles.detailPage}>
        <View className={styles.backBtn} onClick={() => Taro.navigateBack()}>
          <Text className={styles.backIcon}>←</Text>
        </View>
        <View style={{ padding: '40rpx', textAlign: 'center' }}>
          <Text style={{ color: '#999', fontSize: '28rpx' }}>未找到商品信息</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.detailPage}>
      <View className={styles.backBtn} onClick={() => Taro.navigateBack()}>
        <Text className={styles.backIcon}>←</Text>
      </View>
      <ScrollView scrollY style={{ height: 'calc(100vh - 140rpx)' }}>
        <Image
          className={styles.heroImage}
          src={product.image}
          mode="aspectFill"
          onError={(e) => console.error('[Detail] 图片加载失败:', e)}
        />

        <View className={styles.content}>
          <Text className={styles.name}>{product.name}</Text>
          <View className={styles.priceRow}>
            <Text className={styles.price}>¥{product.price.toFixed(2)}</Text>
            <Text className={styles.unit}>/{product.unit}</Text>
          </View>
          <Text className={styles.stock}>库存: {product.stock.toLocaleString()}</Text>

          <View className={styles.infoCard}>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>发货地</Text>
              <Text className={styles.infoValue}>{product.shippingOrigin}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>产地</Text>
              <Text className={styles.infoValue}>{product.location}</Text>
            </View>
            <View className={styles.infoRow} onClick={() => setShowAddrPicker(true)}>
              <Text className={styles.infoLabel}>收货地</Text>
              <Text className={styles.infoValue}>
                {address || '请点击选择收货地址 >'}
              </Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>卖家</Text>
              <Text className={styles.infoValue}>{product.seller_name}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>数量</Text>
              <View className={styles.qtyControl}>
                <View
                  className={styles.qtyBtn}
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  <Text>-</Text>
                </View>
                <Text className={styles.qtyValue}>{qty}</Text>
                <View
                  className={styles.qtyBtn}
                  onClick={() => setQty(Math.min(product.stock, qty + 1))}
                >
                  <Text>+</Text>
                </View>
              </View>
            </View>
          </View>

          <View className={styles.descCard}>
            <Text className={styles.descTitle}>商品描述</Text>
            <Text className={styles.descText}>{product.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View className={styles.bottomBar}>
        <View className={styles.totalSection}>
          <Text className={styles.totalLabel}>单价</Text>
          <Text className={styles.totalPrice}>¥{product.price.toFixed(2)}/{product.unit}</Text>
        </View>
        {mode === 'buy' ? (
          <View className={styles.btnRow}>
            <View className={styles.negoBtn} onClick={openNego}>
              <Text style={{ color: '#b8860b', fontSize: '28rpx' }}>发起协商</Text>
            </View>
            <View className={styles.cartBtn} onClick={handleAddToCart}>
              <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>加入购物车</Text>
            </View>
            <View className={styles.buyBtn} onClick={handleBuy}>
              <Text style={{ color: '#fff', fontSize: '28rpx' }}>立即购买</Text>
            </View>
          </View>
        ) : (
          <View className={styles.viewBtn} onClick={() => Taro.navigateBack()}>
            <Text style={{ color: '#1a1a1a', fontSize: '32rpx' }}>这是我的商品</Text>
          </View>
        )}
      </View>

      {/* 收货地址选择弹窗 */}
      {showAddrPicker && (
        <View className={styles.editModal}>
          <View className={styles.editMask} onClick={() => setShowAddrPicker(false)} />
          <View className={styles.editPanel}>
            <View className={styles.editHeader}>
              <Text className={styles.editTitle}>选择收货地址</Text>
              <Text className={styles.editClose} onClick={() => setShowAddrPicker(false)}>✕</Text>
            </View>
            <ScrollView scrollY style={{ maxHeight: '600rpx' }} className={styles.editBody}>
              {receiveAddrs.length > 0 ? (
                receiveAddrs.map((addr) => (
                  <View
                    key={addr.id}
                    className={`${styles.addrPickerItem} ${address === addr.fullAddress ? styles.addrPickerItemActive : ''}`}
                    onClick={() => {
                      setAddress(addr.fullAddress);
                      setShowAddrPicker(false);
                    }}
                  >
                    <View className={styles.addrPickerHead}>
                      {addr.label ? <Text className={styles.addrPickerLabel}>{addr.label}</Text> : null}
                      <Text className={styles.addrPickerContact}>{addr.contactName} {addr.contactPhone}</Text>
                    </View>
                    <Text className={styles.addrPickerFull}>
                      {addr.province} {addr.city} {addr.district} {addr.town} {addr.detail}
                    </Text>
                    {address === addr.fullAddress && (
                      <Text className={styles.addrPickerCheck}>✓ 当前选择</Text>
                    )}
                  </View>
                ))
              ) : (
                <View className={styles.addrEmpty}>
                  <Text className={styles.addrEmptyText}>暂无收货地址，请先在「我的」页面添加</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ====== 协商弹窗 ====== */}
      {showNego && (
        <View className={styles.modal}>
          <View className={styles.modalMask} onClick={() => setShowNego(false)} />
          <View className={styles.modalPanel}>
            <View className={styles.modalHd}>
              <Text className={styles.modalTitle}>协商价格</Text>
              <Text className={styles.modalClose} onClick={() => setShowNego(false)}>✕</Text>
            </View>
            <View className={styles.modalBody}>
              <View className={styles.negoItem}>
                <Text className={styles.negoLabel}>商品</Text>
                <Text className={styles.negoVal}>{product.name}</Text>
              </View>
              <View className={styles.negoItem}>
                <Text className={styles.negoLabel}>当前单价</Text>
                <Text className={styles.negoVal}>¥{product.price.toFixed(2)}/{product.unit}</Text>
              </View>
              <View className={styles.negoItem}>
                <Text className={styles.negoLabel}>数量</Text>
                <Text className={styles.negoVal}>{qty}{product.unit}</Text>
              </View>
              <View className={styles.negoItem}>
                <Text className={styles.negoLabel}>期望单价</Text>
                <Input
                  className={styles.negoInput}
                  type="digit"
                  value={negoPrice}
                  onInput={(e) => setNegoPrice(e.detail.value)}
                  placeholder="输入期望价格"
                />
              </View>
              <View className={styles.negoNoteRow}>
                <Text className={styles.negoLabel}>备注</Text>
                <Input
                  className={styles.negoInput}
                  value={negoNote}
                  onInput={(e) => setNegoNote(e.detail.value)}
                  placeholder="可选备注"
                />
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.modalCancel} onClick={() => setShowNego(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.modalConfirm} onClick={submitNego}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>提交协商</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 购买确认弹窗 ====== */}
      {showBuy && (
        <View className={styles.modal}>
          <View className={styles.modalMask} onClick={() => setShowBuy(false)} />
          <View className={styles.modalPanel}>
            <View className={styles.modalHd}>
              <Text className={styles.modalTitle}>确认下单</Text>
              <Text className={styles.modalClose} onClick={() => setShowBuy(false)}>✕</Text>
            </View>
            <View className={styles.modalBody}>
              <View className={styles.buySummaryItem}>
                <Image className={styles.buySummaryImg} src={product.image} mode="aspectFill" />
                <View className={styles.buySummaryInfo}>
                  <Text className={styles.buySummaryName}>{product.name}</Text>
                  <View className={styles.buySummaryRow}>
                    <Text className={styles.buySummaryPrice}>¥{product.price.toFixed(2)} x {qty}</Text>
                    <Text className={styles.buySummarySub}>¥{total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              <View className={styles.buyAddrRow} onClick={() => setShowAddrPicker(true)}>
                <Text className={styles.buyAddrLabel}>收货地</Text>
                <Text className={styles.buyAddrVal}>{address || '请选择 >'}</Text>
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.buyTotal}>
                <Text className={styles.buyTotalLabel}>应付</Text>
                <Text className={styles.buyTotalPrice}>¥{total.toFixed(2)}</Text>
              </View>
              <View className={styles.modalConfirm} onClick={confirmBuy}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>确认购买</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default DetailPage;
