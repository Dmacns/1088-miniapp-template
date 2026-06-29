import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
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

const CartPage: React.FC = () => {
  const { cart, removeFromCart, clearCart, proposeOrder, addToCart } = useAppStore();
  const [checkoutMode, setCheckoutMode] = useState<'single' | 'all' | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<typeof cart[0] | null>(null);
  const [receiveAddrs, setReceiveAddrs] = useState<SavedAddress[]>([]);
  const [selAddr, setSelAddr] = useState('');
  const [showAddrPicker, setShowAddrPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = Taro.getStorageSync('addr_receive');
      if (saved) {
        const list: SavedAddress[] = JSON.parse(saved);
        setReceiveAddrs(list);
        if (list.length > 0) setSelAddr(list[0].fullAddress);
      }
    } catch { console.error('加载收货地址失败'); }
  }, []);

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const openCheckout = (mode: 'single' | 'all', item?: typeof cart[0]) => {
    if (mode === 'single' && item) {
      setCheckoutItem(item);
    }
    setCheckoutMode(mode);
  };

  const confirmCheckout = () => {
    if (!checkoutMode) return;
    if (checkoutMode === 'single' && checkoutItem) {
      const orderId = proposeOrder(checkoutItem.sku, checkoutItem.qty, checkoutItem.price, checkoutItem.name, checkoutItem.seller_did);
      if (orderId) {
        removeFromCart(checkoutItem.id);
        setCheckoutItem(null);
        setCheckoutMode(null);
        Taro.navigateTo({ url: `/pages/nego-detail/index?orderId=${orderId}` });
      }
    } else if (checkoutMode === 'all') {
      const items = [...cart];
      items.forEach((item) => {
        const orderId = proposeOrder(item.sku, item.qty, item.price, item.name, item.seller_did);
        if (orderId) removeFromCart(item.id);
      });
      setCheckoutMode(null);
      Taro.navigateTo({ url: `/pages/orders/index` });
    }
  };

  const checkoutSummary = checkoutMode === 'single' && checkoutItem
    ? [{ ...checkoutItem, subtotal: checkoutItem.price * checkoutItem.qty }]
    : cart.map((c) => ({ ...c, subtotal: c.price * c.qty }));
  const checkoutTotal = checkoutSummary.reduce((sum, c) => sum + c.subtotal, 0);

  return (
    <View className={styles.cartPage}>
      {/* 顶部栏 */}
      <View className={styles.header}>
        <Text className={styles.title}>购物车</Text>
        {cart.length > 0 && (
          <Text className={styles.clearBtn} onClick={clearCart}>清空</Text>
        )}
      </View>

      {cart.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>🛒</Text>
          <Text className={styles.emptyText}>购物车是空的</Text>
          <Text className={styles.emptyHint}>去商品页添加吧</Text>
          <View className={styles.goBuyBtn} onClick={() => Taro.switchTab({ url: '/pages/market/index' })}>
            <Text style={{ color: '#fff', fontSize: '28rpx' }}>去选购</Text>
          </View>
        </View>
      ) : (
        <>
          <ScrollView scrollY style={{ height: 'calc(100vh - 260rpx)' }}>
            {cart.map((item) => (
              <View key={item.id} className={styles.cartItem}>
                <Image
                  className={styles.itemImage}
                  src={item.image}
                  mode="aspectFill"
                />
                <View className={styles.itemInfo}>
                  <Text className={styles.itemName}>{item.name}</Text>
                  <Text className={styles.itemPrice}>
                    ¥{item.price.toFixed(2)}/{item.unit}
                  </Text>
                  <View className={styles.itemBottom}>
                    <View className={styles.qtyRow}>
                      <View
                        className={styles.qtyBtn}
                        onClick={() => addToCart({ ...item, qty: -1 })}
                      >
                        <Text>-</Text>
                      </View>
                      <Text className={styles.qtyVal}>{item.qty}</Text>
                      <View
                        className={styles.qtyBtn}
                        onClick={() => addToCart({ ...item, qty: 1 })}
                      >
                        <Text>+</Text>
                      </View>
                    </View>
                    <View className={styles.itemActions}>
                      <Text
                        className={styles.itemDel}
                        onClick={() => removeFromCart(item.id)}
                      >
                        删除
                      </Text>
                      <View className={styles.itemBuy} onClick={() => openCheckout('single', item)}>
                        <Text style={{ color: '#fff', fontSize: '24rpx' }}>结算</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* 底部结算栏 */}
          <View className={styles.footer}>
            <View className={styles.footerTotal}>
              <Text className={styles.footerLabel}>合计</Text>
              <Text className={styles.footerPrice}>¥{total.toFixed(2)}</Text>
            </View>
            <View className={styles.checkoutAllBtn} onClick={() => openCheckout('all')}>
              <Text style={{ color: '#fff', fontSize: '28rpx' }}>全部结算 ({cart.length})</Text>
            </View>
          </View>
        </>
      )}

      {/* ====== 结算确认弹窗 ====== */}
      {checkoutMode && (
        <View className={styles.modal}>
          <View className={styles.mask} onClick={() => setCheckoutMode(null)} />
          <View className={styles.panel}>
            <View className={styles.panelHd}>
              <Text className={styles.panelTitle}>确认结算</Text>
              <Text className={styles.panelClose} onClick={() => setCheckoutMode(null)}>✕</Text>
            </View>

            <ScrollView scrollY style={{ maxHeight: '500rpx' }} className={styles.panelBody}>
              {checkoutSummary.map((s) => (
                <View key={s.id || s.sku} className={styles.summaryItem}>
                  <Image className={styles.summaryImg} src={s.image} mode="aspectFill" />
                  <View className={styles.summaryInfo}>
                    <Text className={styles.summaryName}>{s.name}</Text>
                    <View className={styles.summaryRow}>
                      <Text className={styles.summaryPrice}>¥{s.price.toFixed(2)} x {s.qty}</Text>
                      <Text className={styles.summarySub}>¥{s.subtotal.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))}

              <View className={styles.addrRow} onClick={() => setShowAddrPicker(true)}>
                <Text className={styles.addrLabel}>收货地</Text>
                <Text className={styles.addrVal}>
                  {selAddr || '请选择收货地址 >'}
                </Text>
              </View>
            </ScrollView>

            <View className={styles.panelFt}>
              <View className={styles.panelTotal}>
                <Text className={styles.ftLabel}>应付</Text>
                <Text className={styles.ftPrice}>¥{checkoutTotal.toFixed(2)}</Text>
              </View>
              <View className={styles.confirmBtn} onClick={confirmCheckout}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>确认下单</Text>
              </View>
            </View>
          </View>

          {/* 内嵌地址选择 */}
          {showAddrPicker && (
            <View className={styles.addrModal}>
              <View className={styles.mask} onClick={() => setShowAddrPicker(false)} />
              <View className={styles.addrPanel}>
                <View className={styles.addrPanelHd}>
                  <Text className={styles.addrPanelTitle}>选择收货地址</Text>
                  <Text className={styles.addrPanelClose} onClick={() => setShowAddrPicker(false)}>✕</Text>
                </View>
                <ScrollView scrollY style={{ maxHeight: '500rpx' }}>
                  {receiveAddrs.length > 0 ? (
                    receiveAddrs.map((addr) => (
                      <View
                        key={addr.id}
                        className={`${styles.addrItem} ${selAddr === addr.fullAddress ? styles.addrItemActive : ''}`}
                        onClick={() => { setSelAddr(addr.fullAddress); setShowAddrPicker(false); }}
                      >
                        <View className={styles.addrItemHead}>
                          {addr.label ? <Text className={styles.addrTag}>{addr.label}</Text> : null}
                          <Text className={styles.addrContact}>{addr.contactName} {addr.contactPhone}</Text>
                        </View>
                        <Text className={styles.addrFull}>
                          {addr.province} {addr.city} {addr.district} {addr.town} {addr.detail}
                        </Text>
                        {selAddr === addr.fullAddress && (
                          <Text className={styles.addrCheck}>✓ 当前选择</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <View className={styles.addrEmptyTip}>
                      <Text style={{ color: '#999', fontSize: '28rpx' }}>暂无收货地址，请先在「我的」页面添加</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default CartPage;
