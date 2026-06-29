import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { calcChannelFee, feeLabel } from '@/utils/channelFee';
import styles from './index.module.scss';

export type PayMethod = 'wechat' | 'alipay' | 'ecny';

interface PaymentModalProps {
  visible: boolean;
  orderInfo: { orderId: string; productName: string; amount: number } | null;
  onClose: () => void;
  onPay: (method: PayMethod) => void;
}

const PAY_METHODS: { key: PayMethod; name: string; icon: string; color: string; bg: string }[] = [
  { key: 'wechat', name: '微信支付', icon: '💬', color: '#07c160', bg: 'rgba(7,193,96,0.08)' },
  { key: 'alipay', name: '支付宝', icon: '🔵', color: '#1677ff', bg: 'rgba(22,119,255,0.08)' },
  { key: 'ecny', name: '数字人民币', icon: '🔴', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
];

const PaymentModal: React.FC<PaymentModalProps> = ({ visible, orderInfo, onClose, onPay }) => {
  const [method, setMethod] = useState<PayMethod>('wechat');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (visible) { setPaying(false); setPaid(false); setMethod('wechat'); }
  }, [visible]);

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
      setTimeout(() => {
        onPay(method);
      }, 800);
    }, 1200);
  };

  if (!visible || !orderInfo) return null;

  const channelFee = calcChannelFee(orderInfo.amount);  // 从卖家扣
  const payFee = Math.round(orderInfo.amount * 0.006 * 100) / 100;  // 微信0.6%
  const total = orderInfo.amount + payFee;  // 买方实付 = 商品 + 微信手续费

  return (
    <View className={styles.overlay}>
      <View className={styles.mask} onClick={paid ? undefined : onClose} />
      <View className={styles.panel}>
        {!paid ? (
          <>
            <View className={styles.header}>
              <Text className={styles.title}>确认支付</Text>
              <Text className={styles.close} onClick={onClose}>✕</Text>
            </View>

            <View className={styles.orderSummary}>
              <Text className={styles.orderName}>{orderInfo.productName}</Text>
              <View className={styles.feeBreakdown}>
                <View className={styles.feeRow}>
                  <Text className={styles.feeLabel}>商品金额</Text>
                  <Text className={styles.feeValue}>¥{orderInfo.amount.toFixed(2)}</Text>
                </View>
                <View className={styles.feeRow}>
                  <Text className={styles.feeLabel}>微信支付手续费 (0.6%)</Text>
                  <Text className={styles.feeValueSm}>¥{payFee.toFixed(2)}</Text>
                </View>
                <View className={styles.feeRow}>
                  <Text className={styles.feeLabel}>通道费 (0.5%)</Text>
                  <Text className={styles.feeValueSm} style={{ color: 'rgba(22,163,74,0.7)' }}>卖方承担</Text>
                </View>
                <View className={styles.feeDivider} />
                <View className={styles.feeRow}>
                  <Text className={styles.feeLabelBold}>应付金额</Text>
                  <Text className={styles.amount}>¥{total.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            <View className={styles.methodSection}>
              <Text className={styles.sectionTitle}>支付方式</Text>
              {PAY_METHODS.map((m) => (
                <View
                  key={m.key}
                  className={`${styles.methodItem} ${method === m.key ? styles.methodActive : ''}`}
                  style={method === m.key ? { borderColor: m.color, background: m.bg } : {}}
                  onClick={() => setMethod(m.key)}
                >
                  <Text className={styles.methodIcon}>{m.icon}</Text>
                  <Text className={styles.methodName}>{m.name}</Text>
                  {method === m.key && <View className={styles.check} style={{ background: m.color }}><Text className={styles.checkMark}>✓</Text></View>}
                </View>
              ))}
            </View>

            <View className={styles.footer}>
              <View className={styles.payBtn} onClick={handlePay}>
                <Text className={styles.payBtnText}>{paying ? '支付中...' : `确认支付 ¥${orderInfo.amount.toFixed(2)}`}</Text>
              </View>
            </View>
          </>
        ) : (
          <View className={styles.success}>
            <Text className={styles.successIcon}>✅</Text>
            <Text className={styles.successTitle}>支付成功</Text>
            <Text className={styles.successAmount}>¥{orderInfo.amount.toFixed(2)}</Text>
            <Text className={styles.successHint}>资金已托管，等待卖家发货</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default PaymentModal;
