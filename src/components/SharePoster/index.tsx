import React, { useState } from 'react';
import { View, Text, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

interface SharePosterProps {
  visible: boolean;
  onClose: () => void;
  registerName?: string;
  registerId?: string;
}

const SharePoster: React.FC<SharePosterProps> = ({ visible, onClose, registerName, registerId }) => {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // 使用 Canvas 2D 导出图片
    const query = Taro.createSelectorQuery();
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          setSaving(false);
          Taro.showToast({ title: '海报生成失败', icon: 'none' });
          return;
        }
        // Canvas 2D 绘制
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = Taro.getSystemInfoSync().pixelRatio;
        canvas.width = 375 * dpr;
        canvas.height = 600 * dpr;
        ctx.scale(dpr, dpr);

        // 背景
        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0d1117');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 375, 600);

        // 金色边框
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, 355, 580);

        // 标题
        ctx.fillStyle = '#f5d78e';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔥 星火计划', 187, 80);

        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#d4a853';
        ctx.fillText('大学生创业大赛', 187, 110);

        // 分隔线
        ctx.strokeStyle = 'rgba(184,134,11,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 130);
        ctx.lineTo(315, 130);
        ctx.stroke();

        // 个人信息
        const y = 170;
        ctx.fillStyle = '#c9d1d9';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        if (registerName) {
          ctx.fillText(`选手：${registerName}`, 187, y);
        }
        if (registerId) {
          ctx.fillStyle = '#8b949e';
          ctx.font = '14px sans-serif';
          ctx.fillText(`编号：${registerId}`, 187, y + 30);
        }

        // 赛事信息
        const infoY = registerName ? 240 : 200;
        ctx.fillStyle = '#8b949e';
        ctx.font = '13px sans-serif';
        const lines = [
          '三大赛道：校园二手 · 家乡特产 · 个人技能',
          '基于1088底座，改3个文件即可出产品',
          '7月10日线上启动，扫码报名参赛',
        ];
        lines.forEach((line, i) => {
          ctx.fillText(line, 187, infoY + i * 24);
        });

        // 底部
        ctx.fillStyle = '#d4a853';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('鼎脉 · DMACNS', 187, 500);
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('dmcns.com · 鲁ICP备2026034732号', 187, 525);

        // 导出
        setTimeout(() => {
          Taro.canvasToTempFilePath({
            canvas,
            success: (result) => {
              Taro.saveImageToPhotosAlbum({
                filePath: result.tempFilePath,
                success: () => {
                  Taro.showToast({ title: '海报已保存到相册', icon: 'success' });
                  onClose();
                },
                fail: () => {
                  // 权限问题，预览图片
                  Taro.previewImage({ urls: [result.tempFilePath] });
                },
              });
            },
            fail: () => {
              Taro.showToast({ title: '生成失败', icon: 'none' });
            },
            complete: () => setSaving(false),
          });
        }, 500);
      });
  };

  if (!visible) return null;

  return (
    <View className={styles.posterModal}>
      <View className={styles.posterMask} onClick={onClose} />
      <View className={styles.posterPanel}>
        <View className={styles.posterHeader}>
          <Text className={styles.posterTitle}>分享海报</Text>
          <Text className={styles.posterClose} onClick={onClose}>✕</Text>
        </View>

        {/* 预览区 */}
        <View className={styles.posterPreview}>
          <View className={styles.posterCard}>
            <Text className={styles.posterFire}>🔥</Text>
            <Text className={styles.posterName}>星火计划 · 大学生创业大赛</Text>
            <View className={styles.posterDivider} />
            {registerName && (
              <Text className={styles.posterUser}>选手：{registerName}</Text>
            )}
            {registerId && (
              <Text className={styles.posterId}>编号：{registerId}</Text>
            )}
            <Text className={styles.posterDesc}>
              校园二手 · 家乡特产 · 个人技能
            </Text>
            <Text className={styles.posterBrand}>鼎脉 · DMACNS</Text>
          </View>
        </View>

        <Canvas
          type="2d"
          id="posterCanvas"
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '375px', height: '600px' }}
        />

        <View className={styles.posterFooter}>
          <View className={styles.posterCancel} onClick={onClose}>
            <Text className={styles.posterCancelText}>关闭</Text>
          </View>
          <View className={styles.posterSave} onClick={handleSave}>
            <Text className={styles.posterSaveText}>{saving ? '生成中...' : '保存到相册'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default SharePoster;
