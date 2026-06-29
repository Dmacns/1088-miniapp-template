import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import OrderCard from '@/components/OrderCard';
import styles from './index.module.scss';

const OrdersPage: React.FC = () => {
  const { orders, offlineReceipts, identity, cancelOrder, confirmReceive, shipOrder, createDispute, submitReview, settleOrder, switchNego } = useAppStore();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [statusFilter, setStatusFilter] = useState('all');
  // 争议弹窗
  const [showDispute, setShowDispute] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  // 评价弹窗
  const [showReview, setShowReview] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState('');
  const [reviewSellerDid, setReviewSellerDid] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');

  // 发货处理
  const handleShip = (orderId: string) => {
    Taro.showModal({
      title: '输入物流单号',
      editable: true,
      placeholderText: '请输入快递单号',
      success: (res: any) => {
        if (res.confirm && res.content) {
          shipOrder(orderId, res.content.trim());
        }
      },
    } as any);
  };

  const buyOrders = orders.filter((o) => o.buyer_did === identity?.did);
  const sellOrders = orders.filter((o) => o.seller_did === identity?.did);
  const rawOrders = activeTab === 'buy' ? buyOrders : sellOrders;
  const currentOrders = statusFilter === 'all'
    ? rawOrders
    : rawOrders.filter((o) => o.status === statusFilter);

  const STATUS_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'confirmed', label: '待结算' },
    { value: 'pending', label: '待确认' },
    { value: 'accepted', label: '已接受' },
    { value: 'escrowed', label: '已托管' },
    { value: 'shipped', label: '已发货' },
    { value: 'received', label: '已收货' },
    { value: 'disputed', label: '争议中' },
  ];

  const handleClick = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order && !order.is_nego && order.status === 'confirmed') {
      Taro.showModal({
        title: '结算确认',
        content: `确认结算该订单？\n${order.product_name} x${order.qty}\n总额: ¥${order.total.toFixed(2)}`,
        success: (res) => {
          if (res.confirm) settleOrder(orderId);
        },
      });
    } else {
      Taro.navigateTo({ url: `/pages/nego-detail/index?orderId=${orderId}` });
    }
  };

  return (
    <View className={styles.ordersPage}>
      <View className={styles.tabBar}>
        <View
          className={`${styles.tab} ${activeTab === 'buy' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('buy')}
        >
          <Text style={{ fontSize: '28rpx' }}>我买的</Text>
        </View>
        <View
          className={`${styles.tab} ${activeTab === 'sell' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          <Text style={{ fontSize: '28rpx' }}>我卖的</Text>
        </View>
        {/* 导出CSV */}
        <View className={styles.exportBtn} onClick={() => {
          const data = currentOrders;
          if (data.length === 0) { Taro.showToast({ title: '无订单可导出', icon: 'none' }); return; }
          const csv = '订单ID,商品,数量,单价,总价,状态,创建时间\n' + data.map((o) =>
            `${o.order_id},${o.product_name},${o.qty},${o.price},${o.total},${o.status},${o.created_at}`
          ).join('\n');
          Taro.setClipboardData({ data: csv });
          Taro.showToast({ title: 'CSV已复制到剪贴板', icon: 'success' });
        }}>
          <Text style={{ fontSize: '24rpx', color: '#1a1a1a' }}>📥 导出</Text>
        </View>
      </View>

      <View className={styles.filterBar}>
        <ScrollView scrollX style={{ whiteSpace: 'nowrap' }}>
          {STATUS_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={`${styles.filterChip} ${statusFilter === opt.value ? styles.filterChipActive : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              <Text style={{
                fontSize: '24rpx',
                color: statusFilter === opt.value ? '#b8860b' : '#1a1a1a'
              }}>{opt.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView scrollY style={{ height: 'calc(100vh - 320rpx)' }}>
        {currentOrders.length > 0 ? (
          currentOrders.map((order) => (
            <OrderCard
                key={order.order_id}
                order={order}
                onClick={handleClick}
                onCancel={activeTab === 'buy' && (order.status === 'pending' || order.status === 'confirmed' || order.status === 'escrowed') ? cancelOrder : undefined}
                onShip={activeTab === 'sell' && order.status === 'escrowed' ? handleShip : undefined}
                onConfirm={activeTab === 'buy' && order.status === 'shipped' ? confirmReceive : undefined}
                onSettle={activeTab === 'buy' && order.status === 'confirmed' && !order.is_nego ? settleOrder : undefined}
                onSwitchNego={activeTab === 'buy' && order.status === 'confirmed' && !order.is_nego ? switchNego : undefined}
              onDispute={activeTab === 'buy' && (order.status === 'shipped' || order.status === 'received') ? (orderId) => {
                setDisputeOrderId(orderId);
                setDisputeReason('');
                setDisputeDesc('');
                setShowDispute(true);
              } : undefined}
              onReview={activeTab === 'buy' && order.status === 'received' ? (orderId) => {
                setReviewOrderId(orderId);
                setReviewSellerDid(order.seller_did);
                setReviewRating(5);
                setReviewContent('');
                setShowReview(true);
              } : undefined}
            />
          ))
        ) : (
          <View className={styles.empty}>
            <Text className={styles.emptyText}>
              {activeTab === 'buy' ? '暂无购买订单' : '暂无销售订单'}
            </Text>
          </View>
        )}

        {offlineReceipts.length > 0 && (
          <View className={styles.receiptSection}>
            <Text className={styles.sectionTitle}>离线收据</Text>
            {offlineReceipts.map((receipt, idx) => (
              <View key={idx} className={styles.receiptCard}>
                <View className={styles.receiptRow}>
                  <Text className={styles.receiptLabel}>订单ID</Text>
                  <Text className={styles.receiptValue}>{receipt.order_id}</Text>
                </View>
                <View className={styles.receiptRow}>
                  <Text className={styles.receiptLabel}>金额</Text>
                  <Text className={styles.receiptValue}>¥{receipt.amount.toFixed(2)}</Text>
                </View>
                <View className={styles.receiptRow}>
                  <Text className={styles.receiptLabel}>时间</Text>
                  <Text className={styles.receiptValue}>{receipt.timestamp}</Text>
                </View>
                <View className={styles.receiptRow}>
                  <Text className={styles.receiptLabel}>状态</Text>
                  <Text
                    className={`${styles.syncBadge} ${receipt.synced_tx_hash ? styles.synced : styles.notSynced}`}
                  >
                    {receipt.synced_tx_hash ? '已上链' : '待上链'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ====== 发起争议弹窗 ====== */}
      {showDispute && (
        <View className={styles.modal}>
          <View className={styles.modalMask} onClick={() => setShowDispute(false)} />
          <View className={styles.modalPanel}>
            <View className={styles.modalHd}>
              <Text className={styles.modalTitle}>发起争议</Text>
              <Text className={styles.modalClose} onClick={() => setShowDispute(false)}>✕</Text>
            </View>
            <View className={styles.modalBody}>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>争议原因</Text>
                <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
                  {['未收到货', '商品与描述不符', '质量问题', '数量不符', '其他'].map((r) => (
                    <View
                      key={r}
                      onClick={() => setDisputeReason(r)}
                      style={{
                        padding: '8rpx 24rpx', borderRadius: '32rpx', fontSize: '24rpx',
                        background: disputeReason === r ? '#b8860b' : '#f5f5f5',
                        color: disputeReason === r ? '#fff' : '#1a1a1a',
                      }}
                    >
                      <Text>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>详细说明</Text>
                <View
                  style={{
                    border: '1px solid #e0e0e0', borderRadius: '8rpx', padding: '16rpx',
                    minHeight: '120rpx',
                  }}
                >
                  <Text
                    style={{ color: disputeDesc ? '#1a1a1a' : '#999', fontSize: '28rpx' }}
                    onClick={() => {
                      // 用 Input 替代
                    }}
                  >
                    {disputeDesc || '请描述具体问题...'}
                  </Text>
                </View>
                {/* 简易输入 */}
                <View style={{ marginTop: '12rpx' }}>
                  <View
                    style={{ border: '1px solid #e0e0e0', borderRadius: '8rpx', padding: '8rpx 16rpx' }}
                    onClick={() => {
                      Taro.showModal({
                        title: '详细说明',
                        editable: true,
                        placeholderText: '请描述具体问题...',
                        success: (res: any) => {
                          if (res.confirm && res.content) setDisputeDesc(res.content);
                        },
                      } as any);
                    }}
                  >
                    <Text style={{ color: '#999', fontSize: '28rpx' }}>点击输入详细说明...</Text>
                  </View>
                </View>
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.modalCancel} onClick={() => setShowDispute(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.modalConfirm} onClick={() => {
                if (!disputeReason) { Taro.showToast({ title: '请选择争议原因', icon: 'none' }); return; }
                createDispute(disputeOrderId, disputeReason, disputeDesc);
                setShowDispute(false);
              }}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>提交争议</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 评价弹窗 ====== */}
      {showReview && (
        <View className={styles.modal}>
          <View className={styles.modalMask} onClick={() => setShowReview(false)} />
          <View className={styles.modalPanel}>
            <View className={styles.modalHd}>
              <Text className={styles.modalTitle}>评价</Text>
              <Text className={styles.modalClose} onClick={() => setShowReview(false)}>✕</Text>
            </View>
            <View className={styles.modalBody}>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>评分</Text>
                <View style={{ display: 'flex', gap: '12rpx' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View key={star} onClick={() => setReviewRating(star)}>
                      <Text style={{ fontSize: '48rpx', color: star <= reviewRating ? '#f5a623' : '#e0e0e0' }}>
                        ★
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>评价内容</Text>
                <View
                  style={{ border: '1px solid #e0e0e0', borderRadius: '8rpx', padding: '8rpx 16rpx' }}
                  onClick={() => {
                    Taro.showModal({
                      title: '评价内容',
                      editable: true,
                      placeholderText: '请输入评价...',
                      success: (res: any) => {
                        if (res.confirm && res.content) setReviewContent(res.content);
                      },
                    } as any);
                  }}
                >
                  <Text style={{ color: reviewContent ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>
                    {reviewContent || '点击输入评价内容...'}
                  </Text>
                </View>
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.modalCancel} onClick={() => setShowReview(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.modalConfirm} onClick={() => {
                submitReview(reviewOrderId, reviewSellerDid, reviewRating, reviewContent);
                setShowReview(false);
              }}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>提交评价</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default OrdersPage;
