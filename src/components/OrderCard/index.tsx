import React from 'react';
import { View, Text } from '@tarojs/components';
import type { Order } from '@/types/gdcl';
import styles from './index.module.scss';

interface OrderCardProps {
  order: Order;
  onClick: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
  onConfirm?: (orderId: string) => void;
  onShip?: (orderId: string) => void;
  onDispute?: (orderId: string) => void;
  onReview?: (orderId: string) => void;
  onSettle?: (orderId: string) => void;
  onSwitchNego?: (orderId: string) => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: '#ff7d00' },
  accepted: { label: '已接受', color: '#22c55e' },
  confirmed: { label: '待结算', color: '#b8860b' },
  escrowed: { label: '已托管', color: '#3b82f6' },
  shipped: { label: '已发货', color: '#165dff' },
  received: { label: '已收货', color: '#00b42a' },
  disputed: { label: '争议中', color: '#f53f3f' },
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onClick, onCancel, onConfirm, onShip, onDispute, onReview, onSettle, onSwitchNego }) => {
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: '#1a1a1a' };

  return (
    <View className={styles.card} onClick={() => onClick(order.order_id)}>
      <View className={styles.header}>
        <Text className={styles.orderId}>#{order.order_id.substring(0, 8)}</Text>
        <Text className={styles.status} style={{ color: statusInfo.color }}>
          {statusInfo.label}
        </Text>
      </View>
      <View className={styles.body}>
        <Text className={styles.productName}>{order.product_name}</Text>
        <View className={styles.detail}>
          <Text className={styles.qty}>x{order.qty}</Text>
          <Text className={styles.total}>¥{order.total.toFixed(2)}</Text>
        </View>
      </View>
      <Text className={styles.time}>{order.created_at}</Text>
      {/* 操作按钮 */}
      <View className={styles.actions}>
        {order.status === 'confirmed' && onSettle && (
          <View
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); onSettle(order.order_id); }}
          >
            <Text style={{ color: '#b8860b', fontSize: '24rpx' }}>结算</Text>
          </View>
        )}
        {order.status === 'confirmed' && onSwitchNego && (
          <View
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); onSwitchNego(order.order_id); }}
          >
            <Text style={{ color: '#3b82f6', fontSize: '24rpx' }}>转为协商</Text>
          </View>
        )}
        {(order.status === 'pending' || order.status === 'confirmed') && onCancel && (
          <View
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onCancel(order.order_id);
            }}
          >
            <Text style={{ color: '#f53f3f', fontSize: '24rpx' }}>取消订单</Text>
          </View>
        )}
        {order.status === 'escrowed' && onShip && (
          <View
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onShip(order.order_id);
            }}
          >
            <Text style={{ color: '#3b82f6', fontSize: '24rpx' }}>发货</Text>
          </View>
        )}
        {order.status === 'shipped' && onConfirm && (
          <View
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(order.order_id);
            }}
          >
            <Text style={{ color: '#00b42a', fontSize: '24rpx' }}>确认收货</Text>
          </View>
        )}
        {(order.status === 'shipped' || order.status === 'received') && onDispute && (
          <View
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDispute(order.order_id);
            }}
          >
            <Text style={{ color: '#f5a623', fontSize: '24rpx' }}>发起争议</Text>
          </View>
        )}
        {order.status === 'received' && onReview && (
          <View
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onReview(order.order_id);
            }}
          >
            <Text style={{ color: '#3b82f6', fontSize: '24rpx' }}>评价</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default OrderCard;
