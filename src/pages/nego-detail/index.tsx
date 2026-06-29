import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import styles from './index.module.scss';

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  escrowed: '已托管',
  shipped: '已发货',
  received: '已收货',
  disputed: '争议中',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#ff7d00',
  escrowed: '#3b82f6',
  shipped: '#165dff',
  received: '#00b42a',
  disputed: '#f53f3f',
};

const NegoDetailPage: React.FC = () => {
  const { identity, orders, disputes, acceptProposal, rejectProposal, counterOffer, buyerCounterOffer, shipOrder, createDispute, submitAppeal } = useAppStore();
  const orderId = Taro.getCurrentInstance().router?.params?.orderId || '';

  const order = useMemo(
    () => orders.find((o) => o.order_id === orderId) || null,
    [orders, orderId]
  );

  // 该订单关联的争议
  const orderDispute = useMemo(
    () => disputes.find((d) => d.order_id === orderId) || null,
    [disputes, orderId]
  );

  // 还价弹窗
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [counterRole, setCounterRole] = useState<'seller' | 'buyer'>('seller');

  // 争议弹窗
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');

  if (!order) {
    return (
      <View className={styles.page}>
        <View className={styles.empty}>
          <Text className={styles.emptyText}>协商不存在或已被删除</Text>
        </View>
      </View>
    );
  }

  const isSeller = identity?.did === order.seller_did;
  const isBuyer = identity?.did === order.buyer_did;
  const isPending = order.status === 'pending';

  const handleAccept = () => {
    Taro.showModal({
      title: '确认接受',
      content: '接受后协商将进入合约托管阶段，不可撤销。确定吗？',
      success: (res) => {
        if (res.confirm) acceptProposal(order.order_id);
      },
    });
  };

  const handleReject = () => {
    Taro.showModal({
      title: '确认拒绝',
      content: '拒绝后协商将取消，不可恢复。确定吗？',
      success: (res) => {
        if (res.confirm) rejectProposal(order.order_id);
      },
    });
  };

  // 卖家还价
  const handleSellerCounter = () => {
    setCounterRole('seller');
    setCounterPrice(order.price.toFixed(2));
    setCounterNote('');
    setShowCounter(true);
  };

  // 买家再次还价
  const handleBuyerCounter = () => {
    setCounterRole('buyer');
    setCounterPrice(order.price.toFixed(2));
    setCounterNote('');
    setShowCounter(true);
  };

  // 提交还价
  const submitCounter = () => {
    const newPrice = parseFloat(counterPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      Taro.showToast({ title: '请输入有效价格', icon: 'none' });
      return;
    }
    if (counterRole === 'seller') {
      counterOffer(order.order_id, newPrice, counterNote);
    } else {
      buyerCounterOffer(order.order_id, newPrice, counterNote);
    }
    setShowCounter(false);
  };

  // 发起争议
  const handleDispute = () => {
    setDisputeReason('');
    setDisputeDesc('');
    setShowDispute(true);
  };

  const submitDispute = () => {
    if (!disputeReason) { Taro.showToast({ title: '请选择争议原因', icon: 'none' }); return; }
    createDispute(order.order_id, disputeReason, disputeDesc);
    setShowDispute(false);
  };

  // 申诉
  const handleAppeal = () => {
    Taro.showModal({
      title: '申诉',
      editable: true,
      placeholderText: '请输入申诉理由...',
      success: (res: any) => {
        if (res.confirm && res.content && orderDispute) {
          submitAppeal(orderDispute.dispute_id, res.content);
        }
      },
    } as any);
  };

  // 发货
  const handleShip = () => {
    Taro.showModal({
      title: '输入物流单号',
      editable: true,
      placeholderText: '请输入快递单号',
      success: (res: any) => {
        if (res.confirm && res.content) {
          shipOrder(order.order_id, res.content.trim());
        }
      },
    } as any);
  };

  return (
    <View className={styles.page}>
      <ScrollView scrollY style={{ height: '100vh' }}>
        {/* 状态卡片 */}
        <View className={styles.statusCard} style={{ borderLeftColor: STATUS_COLORS[order.status] || '#1a1a1a' }}>
          <View className={styles.statusRow}>
            <Text className={styles.statusLabel}>协商状态</Text>
            <Text className={styles.statusValue} style={{ color: STATUS_COLORS[order.status] || '#1a1a1a' }}>
              {orderDispute ? '争议中' : (STATUS_LABELS[order.status] || order.status)}
            </Text>
          </View>
          <Text className={styles.orderId}>编号: {order.order_id}</Text>
        </View>

        {/* 商品信息 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>商品信息</Text>
          <View className={styles.infoCard}>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>商品名称</Text>
              <Text className={styles.infoValue}>{order.product_name || order.sku}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>SKU</Text>
              <Text className={styles.infoValue}>{order.sku}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>数量</Text>
              <Text className={styles.infoValue}>x{order.qty}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>单价</Text>
              <Text className={styles.infoValue}>¥{order.price.toFixed(2)}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>总额</Text>
              <Text className={styles.infoPrice}>¥{order.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 买卖方信息 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>交易方</Text>
          <View className={styles.infoCard}>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>
                买方
                {isBuyer ? <Text style={{ color: '#d4a843', fontSize: '22rpx' }}> (我)</Text> : null}
              </Text>
              <Text className={styles.infoValue}>{order.buyer_did?.substring(0, 16)}...</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>
                卖方
                {isSeller ? <Text style={{ color: '#d4a843', fontSize: '22rpx' }}> (我)</Text> : null}
              </Text>
              <Text className={styles.infoValue}>{order.seller_did?.substring(0, 16)}...</Text>
            </View>
          </View>
        </View>

        {/* 时间记录 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>时间记录</Text>
          <View className={styles.infoCard}>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>创建时间</Text>
              <Text className={styles.infoValue}>{order.created_at}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>最后更新</Text>
              <Text className={styles.infoValue}>{order.updated_at}</Text>
            </View>
            {order.tx_hash ? (
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>链上哈希</Text>
                <Text className={styles.infoValue}>{order.tx_hash.substring(0, 16)}...</Text>
              </View>
            ) : null}
            {order.tracking_no ? (
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>物流单号</Text>
                <Text className={styles.infoValue}>{order.tracking_no}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 争议详情（如果有） */}
        {orderDispute && (
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>争议详情</Text>
            <View className={styles.infoCard}>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>争议ID</Text>
                <Text className={styles.infoValue}>#{orderDispute.dispute_id.substring(0, 8)}</Text>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>原因</Text>
                <Text className={styles.infoValue}>{orderDispute.reason}</Text>
              </View>
              {orderDispute.description ? (
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>说明</Text>
                  <Text className={styles.infoValue}>{orderDispute.description}</Text>
                </View>
              ) : null}
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>争议状态</Text>
                <Text className={styles.infoValue} style={{
                  color: orderDispute.status === 'resolved' ? '#00b42a' : orderDispute.status === 'appealed' ? '#f5a623' : '#f53f3f',
                }}>
                  {orderDispute.status === 'open' ? '待处理' : orderDispute.status === 'resolved' ? '已解决' : orderDispute.status === 'appealed' ? '已申诉' : orderDispute.status}
                </Text>
              </View>
              {orderDispute.ruling ? (
                <View className={styles.infoRow}>
                  <Text className={styles.infoLabel}>裁决</Text>
                  <Text className={styles.infoValue} style={{ color: '#b8860b' }}>{orderDispute.ruling}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* 买方提示 */}
        {isBuyer && isPending && !orderDispute && (
          <View className={styles.hintCard}>
            <Text className={styles.hintText}>协商已发起，等待卖方确认。卖方接受后订单将进入合约托管阶段。</Text>
          </View>
        )}
        {isBuyer && order.status === 'escrowed' && !orderDispute && (
          <View className={styles.hintCard}>
            <Text className={styles.hintText}>订单已托管，等待卖方发货。</Text>
          </View>
        )}
        {isBuyer && order.status === 'shipped' && !orderDispute && (
          <View className={styles.hintCard}>
            <Text className={styles.hintText}>商品已发货，请注意查收。</Text>
          </View>
        )}

        {/* 底部操作栏 - 卖家 */}
        {isSeller && isPending && !orderDispute && (
          <View className={styles.bottomBar}>
            <View className={styles.counterBtn} onClick={handleSellerCounter}>
              <Text className={styles.counterBtnText}>还价</Text>
            </View>
            <View className={styles.rejectBtn} onClick={handleReject}>
              <Text className={styles.rejectBtnText}>拒绝</Text>
            </View>
            <View className={styles.acceptBtn} onClick={handleAccept}>
              <Text className={styles.acceptBtnText}>接受</Text>
            </View>
          </View>
        )}

        {/* 底部操作栏 - 卖家已托管待发货 */}
        {isSeller && order.status === 'escrowed' && !orderDispute && (
          <View className={styles.bottomBar}>
            <View className={styles.acceptBtn} onClick={handleShip}>
              <Text className={styles.acceptBtnText}>发货</Text>
            </View>
          </View>
        )}

        {/* 底部操作栏 - 买家 */}
        {isBuyer && isPending && !orderDispute && (
          <View className={styles.bottomBar}>
            <View className={styles.counterBtn} onClick={handleBuyerCounter}>
              <Text className={styles.counterBtnText}>再次协商</Text>
            </View>
            <View className={styles.rejectBtn} onClick={handleReject}>
              <Text className={styles.rejectBtnText}>取消</Text>
            </View>
          </View>
        )}

        {/* 底部操作栏 - 买家已收货可发起争议 */}
        {isBuyer && order.status === 'received' && !orderDispute && (
          <View className={styles.bottomBar}>
            <View className={styles.disputeBtn} onClick={handleDispute}>
              <Text className={styles.disputeBtnText}>发起争议</Text>
            </View>
          </View>
        )}

        {/* 底部操作栏 - 争议中买家可申诉 */}
        {isBuyer && orderDispute && orderDispute.status === 'open' && (
          <View className={styles.bottomBar}>
            <View className={styles.disputeBtn} onClick={handleAppeal}>
              <Text className={styles.disputeBtnText}>申诉</Text>
            </View>
          </View>
        )}

        {/* 卖家在争议详情页的操作 */}
        {isSeller && orderDispute && orderDispute.status === 'open' && (
          <View className={styles.bottomBar}>
            <View className={styles.hintCard} style={{ flex: 1 }}>
              <Text className={styles.hintText}>买家已发起争议，请在「卖货-争议」中处理</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ====== 还价弹窗 ====== */}
      {showCounter && (
        <View className={styles.modal}>
          <View className={styles.modalMask} onClick={() => setShowCounter(false)} />
          <View className={styles.modalPanel}>
            <View className={styles.modalHd}>
              <Text className={styles.modalTitle}>{counterRole === 'seller' ? '卖家还价' : '再次协商'}</Text>
              <Text className={styles.modalClose} onClick={() => setShowCounter(false)}>✕</Text>
            </View>
            <View className={styles.modalBody}>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>当前价格</Text>
                <Text style={{ fontSize: '28rpx', color: '#b8860b' }}>¥{order.price.toFixed(2)}</Text>
              </View>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>新价格 *</Text>
                <Input
                  className={styles.modalInput}
                  type="digit"
                  placeholder="输入新价格"
                  value={counterPrice}
                  onInput={(e) => setCounterPrice(e.detail.value)}
                />
              </View>
              <View className={styles.modalItem}>
                <Text className={styles.modalLabel}>备注</Text>
                <Input
                  className={styles.modalInput}
                  placeholder="可选备注"
                  value={counterNote}
                  onInput={(e) => setCounterNote(e.detail.value)}
                />
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.modalCancel} onClick={() => setShowCounter(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.modalConfirm} onClick={submitCounter}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>确认提交</Text>
              </View>
            </View>
          </View>
        </View>
      )}

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
                  <Text style={{ color: disputeDesc ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>
                    {disputeDesc || '点击输入详细说明...'}
                  </Text>
                </View>
              </View>
            </View>
            <View className={styles.modalFt}>
              <View className={styles.modalCancel} onClick={() => setShowDispute(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.modalConfirm} onClick={submitDispute}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>提交争议</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default NegoDetailPage;
