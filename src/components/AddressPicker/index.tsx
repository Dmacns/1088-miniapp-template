import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { provinces, findProvince, type Region } from '@/data/region';
import { loadTowns, preloadTowns } from '@/services/townLoader';
import styles from './index.module.scss';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: { province: string; city: string; district: string; town: string; fullAddress: string }) => void;
  initialProvince?: string;
  initialCity?: string;
  initialDistrict?: string;
  initialTown?: string;
}

interface TownItem {
  code: string;
  name: string;
}

const AddressPicker: React.FC<Props> = ({ visible, onClose, onConfirm, initialProvince, initialCity, initialDistrict }) => {
  const [step, setStep] = useState(0); // 0=省 1=市 2=区 3=镇/街道
  const [selectedProvince, setSelectedProvince] = useState<Region | null>(null);
  const [selectedCity, setSelectedCity] = useState<Region | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<Region | null>(null);
  const [townList, setTownList] = useState<TownItem[]>([]);
  const [loadingTowns, setLoadingTowns] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setTownList([]);
    setLoadingTowns(false);
    if (initialProvince) {
      const p = findProvince(initialProvince);
      setSelectedProvince(p || null);
      if (p && initialCity) {
        const c = p.children?.find((c) => c.name === initialCity) || null;
        setSelectedCity(c);
        if (c && initialDistrict) {
          const d = c.children?.find((d) => d.name === initialDistrict) || null;
          setSelectedDistrict(d);
        }
      }
    }
  }, [visible]);

  const handleSelectProvince = (p: Region) => {
    setSelectedProvince(p);
    setSelectedCity(null);
    setSelectedDistrict(null);
    setTownList([]);
    // 预加载镇数据
    preloadTowns(p.code);
    setStep(1);
  };

  const handleSelectCity = (c: Region) => {
    setSelectedCity(c);
    setSelectedDistrict(null);
    setTownList([]);
    setStep(2);
  };

  const handleSelectDistrict = async (d: Region) => {
    setSelectedDistrict(d);
    setLoadingTowns(true);
    setStep(3);
    // 运行时加载该区县的镇/街道列表
    const towns = await loadTowns(selectedProvince!.code, d.code);
    setTownList(towns);
    setLoadingTowns(false);
  };

  const handleSelectTown = (t: TownItem) => {
    doConfirm(t.name);
  };

  const doConfirm = (townName: string) => {
    const p = selectedProvince!;
    const c = selectedCity;
    const d = selectedDistrict;

    const parts = [p.name];
    if (c) parts.push(c.name);
    if (d) parts.push(d.name);
    if (townName) parts.push(townName);

    onConfirm({
      province: p.name,
      city: c?.name || '',
      district: d?.name || '',
      town: townName,
      fullAddress: parts.join(' '),
    });
    onClose();
  };

  const list = step === 0 ? provinces
    : step === 1 ? (selectedProvince?.children || [])
    : step === 2 ? (selectedCity?.children || [])
    : step === 3 ? townList
    : [];

  return visible ? (
    <View className={styles.pickerModal}>
      <View className={styles.mask} onClick={onClose} />
      <View className={styles.panel}>
        <View className={styles.header}>
          <Text className={styles.cancel} onClick={onClose}>取消</Text>
          <View className={styles.breadcrumb}>
            <Text className={selectedProvince ? styles.breadActive : styles.breadInactive}>
              {selectedProvince?.name || '请选择省份'}
            </Text>
            {selectedProvince && (
              <>
                <Text className={styles.breadSep}> &gt; </Text>
                <Text className={selectedCity ? styles.breadActive : styles.breadInactive}>
                  {selectedCity?.name || '请选择城市'}
                </Text>
              </>
            )}
            {selectedCity && (
              <>
                <Text className={styles.breadSep}> &gt; </Text>
                <Text className={selectedDistrict ? styles.breadActive : styles.breadInactive}>
                  {selectedDistrict?.name || '请选择区县'}
                </Text>
              </>
            )}
            {selectedDistrict && (
              <>
                <Text className={styles.breadSep}> &gt; </Text>
                <Text className={styles.breadActive}>
                  {loadingTowns ? '加载中...' : townList.length === 0 ? '暂无镇/街道数据' : '请选择镇/街道'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Step 0~2: 列表选择 */}
        {step <= 2 && list.length > 0 && (
          <ScrollView scrollY className={styles.list}>
            {list.map((item) => (
              <View
                key={item.code}
                className={styles.item}
                onClick={() => {
                  if (step === 0) handleSelectProvince(item);
                  else if (step === 1) handleSelectCity(item);
                  else if (step === 2) handleSelectDistrict(item);
                }}
              >
                <Text className={styles.itemText}>{item.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Step 3: 镇/街道列表（运行时加载） */}
        {step === 3 && (
          <>
            {loadingTowns ? (
              <View className={styles.loadingArea}>
                <Text className={styles.loadingText}>加载镇/街道数据...</Text>
              </View>
            ) : townList.length > 0 ? (
              <ScrollView scrollY className={styles.list}>
                {townList.map((item) => (
                  <View
                    key={item.code}
                    className={styles.item}
                    onClick={() => handleSelectTown(item)}
                  >
                    <Text className={styles.itemText}>{item.name}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View className={styles.emptyArea}>
                <Text className={styles.emptyText}>暂无镇/街道数据</Text>
              </View>
            )}
          </>
        )}

        {/* Step <= 2 但无数据 */}
        {step <= 2 && list.length === 0 && (
          <View className={styles.emptyArea}>
            <Text className={styles.emptyText}>暂无数据</Text>
          </View>
        )}
      </View>
    </View>
  ) : null;
};

export default AddressPicker;
