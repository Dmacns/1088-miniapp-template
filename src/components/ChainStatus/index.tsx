import React from 'react';
import { View, Text } from '@tarojs/components';
import type { ChainStatus as ChainStatusType } from '@/types/gdcl';
import styles from './index.module.scss';

interface ChainStatusProps {
  status: ChainStatusType;
}

const ChainStatus: React.FC<ChainStatusProps> = ({ status }) => {
  return (
    <View className={styles.container}>
      <View
        className={styles.dot}
        style={{ backgroundColor: status.online ? '#00b42a' : '#ff7d00' }}
      />
      <Text className={styles.label}>
        {status.online ? '链通' : '离线模式'}
      </Text>
      {status.online && status.block_height && (
        <Text className={styles.height}>#{status.block_height}</Text>
      )}
    </View>
  );
};

export default ChainStatus;
