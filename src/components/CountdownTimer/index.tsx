import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface CountdownTimerProps {
  targetDate?: string; // ISO date string, default 2026-07-10
}

const DEFAULT_TARGET = '2026-07-10T00:00:00+08:00';

function calcRemaining(target: string) {
  const now = new Date();
  const end = new Date(target);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, started: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    started: false,
  };
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate = DEFAULT_TARGET }) => {
  const [remaining, setRemaining] = useState(() => calcRemaining(targetDate));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(calcRemaining(targetDate)), 60000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (remaining.started) {
    return (
      <View className={styles.countdown}>
        <Text className={styles.label}>🔥 大赛进行中</Text>
      </View>
    );
  }

  return (
    <View className={styles.countdown}>
      <View className={styles.item}>
        <Text className={styles.number}>{remaining.days}</Text>
        <Text className={styles.unit}>天</Text>
      </View>
      <Text className={styles.sep}>:</Text>
      <View className={styles.item}>
        <Text className={styles.number}>{String(remaining.hours).padStart(2, '0')}</Text>
        <Text className={styles.unit}>时</Text>
      </View>
      <Text className={styles.sep}>:</Text>
      <View className={styles.item}>
        <Text className={styles.number}>{String(remaining.minutes).padStart(2, '0')}</Text>
        <Text className={styles.unit}>分</Text>
      </View>
    </View>
  );
};

export default CountdownTimer;
