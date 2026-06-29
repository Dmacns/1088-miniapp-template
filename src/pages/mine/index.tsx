import React, { useState, useEffect } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import ChainStatus from '@/components/ChainStatus';
import AddressPicker from '@/components/AddressPicker';
import { exportPrivateKey, importPrivateKey, deleteIdentity } from '@/utils/crypto';
import SharePoster from '@/components/SharePoster';
import styles from './index.module.scss';

// ===== 大赛登记 =====
const REG_API = 'https://dmacns.com';
const CONTEST_CATEGORIES = ['校园二手', '家乡特产', '个人技能'];
interface RegForm { name: string; city: string; phone: string; contact: string; categories: string[]; }

interface SavedAddress {
  id: string;
  label: string;
  contactName: string;   // 联系人姓名
  contactPhone: string;  // 联系人电话
  province: string;
  city: string;
  district: string;
  town: string;
  detail: string;
  fullAddress: string;
}

interface EditingAddr {
  index: number | null;
  data: SavedAddress;
}

const emptyAddress: SavedAddress = {
  id: '', label: '', contactName: '', contactPhone: '',
  province: '', city: '', district: '', town: '', detail: '', fullAddress: '',
};

const MinePage: React.FC = () => {
  const { identity, chainStatus, isConnected, devMode, switchSeed, toggleDevMode } = useAppStore();
  const [seedUrl, setSeedUrl] = useState('wss://ws.dmacns.com');
  const [showSeedInput, setShowSeedInput] = useState(false);
  const [showKeyManage, setShowKeyManage] = useState(false);
  const [proxyAddress, setProxyAddress] = useState(() => {
    try {
      return Taro.getStorageSync('proxy_address') || 'ws://127.0.0.1:8765';
    } catch { return 'ws://127.0.0.1:8765'; }
  });

  const [receiveAddrs, setReceiveAddrs] = useState<SavedAddress[]>([]);
  const [shippingAddrs, setShippingAddrs] = useState<SavedAddress[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<EditingAddr>({ index: null, data: { ...emptyAddress } });
  const [addrType, setAddrType] = useState<'receive' | 'shipping'>('receive');
  const [showPicker, setShowPicker] = useState(false);

  // 登记状态
  const [registered, setRegistered] = useState(false);
  const [registerId, setRegisterId] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState<RegForm>({ name: '', city: '', phone: '', contact: '', categories: [] });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [showPoster, setShowPoster] = useState(false);

  useEffect(() => {
    try {
      const r = Taro.getStorageSync('addr_receive');
      if (r) setReceiveAddrs(JSON.parse(r));
      const s = Taro.getStorageSync('addr_shipping');
      if (s) setShippingAddrs(JSON.parse(s));
    } catch {}
    try {
      if (Taro.getStorageSync('registered')) {
        setRegistered(true);
        setRegisterId(Taro.getStorageSync('registerId') || '');
        setRegisterName(Taro.getStorageSync('registerName') || '');
      }
    } catch {}
  }, []);

  const saveReceive = (list: SavedAddress[]) => {
    setReceiveAddrs(list);
    Taro.setStorageSync('addr_receive', JSON.stringify(list));
  };
  const saveShipping = (list: SavedAddress[]) => {
    setShippingAddrs(list);
    Taro.setStorageSync('addr_shipping', JSON.stringify(list));
  };

  const openAdd = (type: 'receive' | 'shipping') => {
    setAddrType(type);
    setEditing({ index: null, data: { ...emptyAddress, id: `addr_${Date.now()}` } });
    setShowEditor(true);
  };

  const openEdit = (type: 'receive' | 'shipping', idx: number) => {
    setAddrType(type);
    const list = type === 'receive' ? receiveAddrs : shippingAddrs;
    setEditing({ index: idx, data: { ...list[idx] } });
    setShowEditor(true);
  };

  const handleDelete = (type: 'receive' | 'shipping', idx: number) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          const list = type === 'receive' ? [...receiveAddrs] : [...shippingAddrs];
          list.splice(idx, 1);
          if (type === 'receive') saveReceive(list);
          else saveShipping(list);
          Taro.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  };

  const handleSave = () => {
    const d = editing.data;
    if (!d.contactName.trim()) { Taro.showToast({ title: '请输入联系人姓名', icon: 'none' }); return; }
    if (!d.contactPhone.trim()) { Taro.showToast({ title: '请输入联系电话', icon: 'none' }); return; }
    if (!d.province) { Taro.showToast({ title: '请选择省市区', icon: 'none' }); return; }
    if (!d.detail.trim()) { Taro.showToast({ title: '请输入详细地址', icon: 'none' }); return; }

    const full = `${d.contactName} ${d.contactPhone} ${d.province} ${d.city} ${d.district} ${d.town} ${d.detail.trim()}`.replace(/\s+/g, ' ').trim();
    const saved: SavedAddress = { ...d, id: d.id || `addr_${Date.now()}`, fullAddress: full };

    if (addrType === 'receive') {
      const list = [...receiveAddrs];
      if (editing.index !== null) list[editing.index] = saved;
      else list.push(saved);
      saveReceive(list);
    } else {
      const list = [...shippingAddrs];
      if (editing.index !== null) list[editing.index] = saved;
      else list.push(saved);
      saveShipping(list);
    }
    setShowEditor(false);
    Taro.showToast({ title: '已保存', icon: 'success' });
  };

  const handlePickConfirm = (result: { province: string; city: string; district: string; town: string; fullAddress: string }) => {
    setEditing((prev) => ({
      ...prev,
      data: { ...prev.data, province: result.province, city: result.city, district: result.district, town: result.town },
    }));
  };

  const handleSwitchSeed = () => {
    if (!seedUrl.trim()) { Taro.showToast({ title: '请输入Seed地址', icon: 'none' }); return; }
    switchSeed(seedUrl.trim());
    Taro.showToast({ title: 'Seed已切换', icon: 'success' });
  };

  const handleExportKey = () => {
    const key = exportPrivateKey();
    Taro.setClipboardData({ data: key, success: () => Taro.showToast({ title: '私钥已复制到剪贴板', icon: 'success' }) });
  };

  const handleImportKey = () => {
    Taro.getClipboardData({
      success: (res) => {
        const key = res.data;
        if (key && key.length >= 32) { importPrivateKey(key); Taro.showToast({ title: '身份已恢复，请重启应用', icon: 'success' }); }
        else Taro.showToast({ title: '剪贴板中没有有效私钥', icon: 'none' });
      },
    });
  };

  const handleDeleteIdentity = () => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后DID和私钥将无法恢复，确定吗？',
      success: (res) => { if (res.confirm) { deleteIdentity(); Taro.showToast({ title: '身份已删除', icon: 'success' }); } },
    });
  };

  // ===== 大赛登记 =====
  const openRegModal = () => { setRegForm({ name: '', city: '', phone: '', contact: '', categories: [] }); setShowRegModal(true); };
  const handleRegister = () => {
    const { name, city, phone, contact, categories } = regForm;
    if (!name.trim()) { Taro.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    if (!city.trim()) { Taro.showToast({ title: '请输入所在城市', icon: 'none' }); return; }
    if (!phone.trim()) { Taro.showToast({ title: '请输入联系电话', icon: 'none' }); return; }
    if (!contact.trim()) { Taro.showToast({ title: '请输入微信/QQ', icon: 'none' }); return; }
    if (categories.length === 0) { Taro.showToast({ title: '请至少选择一个参赛类别', icon: 'none' }); return; }
    setRegSubmitting(true);
    Taro.request({
      url: `${REG_API}/api/register`, method: 'POST', header: { 'Content-Type': 'application/json' },
      data: { name: name.trim(), city: city.trim(), phone: phone.trim(), contact: contact.trim(), categories },
      success: (res: any) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          const data = res.data;
          setRegistered(true); setRegisterId(data.id || ''); setRegisterName(name.trim());
          Taro.setStorageSync('registered', true); Taro.setStorageSync('registerId', data.id || ''); Taro.setStorageSync('registerName', name.trim());
          setShowRegModal(false);
          Taro.showToast({ title: data.message || '报名成功！', icon: 'success', duration: 3000 });
        } else { Taro.showToast({ title: res.data?.error || '报名失败', icon: 'none' }); }
      },
      fail: () => { Taro.showToast({ title: '网络错误', icon: 'none' }); },
      complete: () => setRegSubmitting(false),
    });
  };

  // ===== 渲染地址卡片 =====
  const renderAddrCard = (addr: SavedAddress, idx: number, type: 'receive' | 'shipping') => (
    <View key={addr.id} className={styles.addrCard}>
      <View className={styles.addrInfo}>
        <View className={styles.addrHeadRow}>
          <Input
            className={styles.labelInput}
            placeholder="标签"
            value={addr.label}
            onInput={(e) => {
              const list = type === 'receive' ? [...receiveAddrs] : [...shippingAddrs];
              list[idx] = { ...list[idx], label: e.detail.value };
              if (type === 'receive') saveReceive(list);
              else saveShipping(list);
            }}
          />
          <Text className={styles.contactRow}>
            <Text className={styles.contactName}>{addr.contactName}</Text>
            <Text className={styles.contactPhone}>{addr.contactPhone}</Text>
          </Text>
        </View>
        <Text className={styles.addrFull}>
          {addr.province} {addr.city} {addr.district} {addr.town} {addr.detail}
        </Text>
      </View>
      <View className={styles.addrActions}>
        <Text className={styles.addrAction} onClick={() => openEdit(type, idx)}>编辑</Text>
        <Text className={styles.addrActionDel} onClick={() => handleDelete(type, idx)}>删除</Text>
      </View>
    </View>
  );

  return (
    <View className={styles.minePage}>
      {/* DID身份卡片 */}
      <View className={styles.identityCard}>
        <Text className={styles.didLabel}>我的DID</Text>
        <Text className={styles.didValue}>{identity?.did || '未初始化'}</Text>
      </View>

      {/* 星火计划大赛报名 */}
      <View className={styles.regCard} onClick={() => { if (!registered) openRegModal(); }}>
        <View className={styles.regCardInner}>
          <Text className={styles.regIcon}>{registered ? '✅' : '🔥'}</Text>
          <View className={styles.regInfo}>
            <Text className={styles.regTitle}>
              {registered ? `已报名 · ${registerName || '星火计划创业大赛'}` : '星火计划 · 大学生创业大赛'}
            </Text>
            <Text className={styles.regSub}>
              {registered ? `报名编号：${registerId}` : '校园二手 / 家乡特产 / 个人技能 — 点击报名'}
            </Text>
          </View>
          {!registered && <Text className={styles.regArrow}>›</Text>}
        </View>
        {registered && (
          <View className={styles.regPosterBtn} onClick={(e) => { e.stopPropagation(); setShowPoster(true); }}>
            <Text style={{ color: '#f5d78e', fontSize: '24rpx' }}>📸 生成海报</Text>
          </View>
        )}
      </View>

      {/* 链状态 */}
      <View className={styles.chainCard}>
        <View className={styles.chainRow}>
          <Text className={styles.chainLabel}>链状态</Text>
          <ChainStatus status={chainStatus} />
        </View>
        <View className={styles.chainRow}>
          <Text className={styles.chainLabel}>Seed连接</Text>
          <Text className={styles.chainValue}>{isConnected ? '已连接' : '未连接'}</Text>
        </View>
        <View className={styles.chainRow}>
          <Text className={styles.chainLabel}>开发模式</Text>
          <View
            onClick={toggleDevMode}
            style={{
              width: '88rpx', height: '48rpx', borderRadius: '24rpx',
              background: devMode ? '#00b42a' : '#c0c0c0',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <View style={{
              width: '40rpx', height: '40rpx', borderRadius: '50%',
              background: '#fff', position: 'absolute', top: '4rpx',
              left: devMode ? '44rpx' : '4rpx', transition: 'left 0.2s',
            }} />
          </View>
        </View>
        {devMode && (
          <View style={{ padding: '12rpx 0', borderTop: '1px solid #f0f0f0' }}>
            <Text style={{ color: '#f5a623', fontSize: '22rpx' }}>
              ⚠ 开发模式：通过本地代理(127.0.0.1:8765)连接。请先在终端执行 node scripts/ws-proxy.js
            </Text>
            <View style={{ display: 'flex', alignItems: 'center', marginTop: '12rpx' }}>
              <Text style={{ fontSize: '24rpx', color: '#1a1a1a', marginRight: '12rpx', whiteSpace: 'nowrap' }}>代理地址</Text>
              <Input
                style={{
                  flex: 1, height: '56rpx', border: '1px solid #e0e0e0', borderRadius: '8rpx',
                  padding: '0 16rpx', fontSize: '24rpx', color: '#1a1a1a', background: '#f9f9f9',
                }}
                value={proxyAddress}
                onInput={(e) => setProxyAddress(e.detail.value)}
                onBlur={() => {
                  Taro.setStorageSync('proxy_address', proxyAddress.trim());
                  Taro.showToast({ title: '代理地址已保存', icon: 'success' });
                }}
                placeholder="ws://127.0.0.1:8765"
              />
            </View>
            <Text style={{ color: '#999', fontSize: '20rpx', marginTop: '4rpx' }}>
              模拟器：127.0.0.1:8765　|　真机：改为电脑局域网IP
            </Text>
          </View>
        )}
      </View>

      {/* 收货地址 */}
      <View className={styles.addrSection}>
        <View className={styles.addrSectionHeader}>
          <Text className={styles.sectionTitle}>收货地址</Text>
          <View className={styles.addrAddBtn} onClick={() => openAdd('receive')}>
            <Text className={styles.addrAddBtnText}>+ 新增</Text>
          </View>
        </View>
        {receiveAddrs.length > 0 ? (
          receiveAddrs.map((addr, idx) => renderAddrCard(addr, idx, 'receive'))
        ) : (
          <View className={styles.addrEmpty}>
            <Text className={styles.addrEmptyText}>暂无收货地址</Text>
          </View>
        )}
      </View>

      {/* 发货地址 */}
      <View className={styles.addrSection}>
        <View className={styles.addrSectionHeader}>
          <Text className={styles.sectionTitle}>发货地址</Text>
          <View className={styles.addrAddBtn} onClick={() => openAdd('shipping')}>
            <Text className={styles.addrAddBtnText}>+ 新增</Text>
          </View>
        </View>
        {shippingAddrs.length > 0 ? (
          shippingAddrs.map((addr, idx) => renderAddrCard(addr, idx, 'shipping'))
        ) : (
          <View className={styles.addrEmpty}>
            <Text className={styles.addrEmptyText}>暂无发货地址</Text>
          </View>
        )}
      </View>

      {/* 功能菜单 */}
      <Text className={styles.sectionTitle}>设置</Text>
      <View className={styles.menuCard}>
        <View className={styles.menuItem} onClick={() => setShowSeedInput(!showSeedInput)}>
          <Text className={styles.menuText}>切换Seed节点</Text>
          <Text className={styles.menuArrow}>{showSeedInput ? '▲' : '▼'}</Text>
        </View>
        {showSeedInput && (
          <View className={styles.seedPanel}>
            <Input className={styles.seedInput} value={seedUrl} onInput={(e) => setSeedUrl(e.detail.value)} placeholder="wss://..." placeholderStyle="color: #999" />
            <View className={styles.actionBtn} onClick={handleSwitchSeed}>
              <Text className={styles.actionBtnText}>确认切换</Text>
            </View>
          </View>
        )}
        <View className={styles.menuItem} onClick={() => setShowKeyManage(!showKeyManage)}>
          <Text className={styles.menuText}>密钥管理</Text>
          <Text className={styles.menuArrow}>{showKeyManage ? '▲' : '▼'}</Text>
        </View>
        {showKeyManage && (
          <View className={styles.seedPanel}>
            <View className={styles.actionBtn} onClick={handleExportKey}>
              <Text className={styles.actionBtnText}>导出私钥（备份）</Text>
            </View>
            <View className={styles.actionBtn} onClick={handleImportKey}>
              <Text className={styles.actionBtnText}>导入私钥（恢复）</Text>
            </View>
            <View className={styles.dangerBtn} onClick={handleDeleteIdentity}>
              <Text className={styles.dangerBtnText}>删除身份</Text>
            </View>
          </View>
        )}
      </View>

      {/* 地址编辑器弹窗 */}
      {showEditor && (
        <View className={styles.editModal}>
          <View className={styles.editMask} onClick={() => setShowEditor(false)} />
          <View className={styles.editPanel}>
            <View className={styles.editHeader}>
              <Text className={styles.editTitle}>{editing.index !== null ? '编辑地址' : '新增地址'}</Text>
              <Text className={styles.editClose} onClick={() => setShowEditor(false)}>✕</Text>
            </View>
            <View className={styles.editBody}>
              {/* 标签 */}
              <View className={styles.editGroup}>
                <Text className={styles.editLabel}>标签</Text>
                <Input className={styles.editInput} placeholder="如：家、公司、仓库" value={editing.data.label}
                  onInput={(e) => setEditing((prev) => ({ ...prev, data: { ...prev.data, label: e.detail.value } }))} />
              </View>
              {/* 联系人姓名 */}
              <View className={styles.editGroup}>
                <Text className={styles.editLabel}>联系人姓名 *</Text>
                <Input className={styles.editInput} placeholder="请输入联系人姓名" value={editing.data.contactName}
                  onInput={(e) => setEditing((prev) => ({ ...prev, data: { ...prev.data, contactName: e.detail.value } }))} />
              </View>
              {/* 联系电话 */}
              <View className={styles.editGroup}>
                <Text className={styles.editLabel}>联系电话 *</Text>
                <Input className={styles.editInput} placeholder="请输入联系电话" value={editing.data.contactPhone}
                  onInput={(e) => setEditing((prev) => ({ ...prev, data: { ...prev.data, contactPhone: e.detail.value } }))} />
              </View>
              {/* 省市区选择 */}
              <View className={styles.editGroup}>
                <Text className={styles.editLabel}>省市区 *</Text>
                <View className={styles.editPicker} onClick={() => setShowPicker(true)}>
                  <Text className={editing.data.province ? styles.pickerTextSelected : styles.pickerTextPlaceholder}>
                    {editing.data.province
                      ? `${editing.data.province} ${editing.data.city} ${editing.data.district} ${editing.data.town}`
                      : '请选择省市区'}
                  </Text>
                  <Text className={styles.pickerArrow}>›</Text>
                </View>
              </View>
              {/* 详细地址 */}
              <View className={styles.editGroup}>
                <Text className={styles.editLabel}>详细地址 *</Text>
                <Input className={styles.editInput} placeholder="如：XX路XX号XX室" value={editing.data.detail}
                  onInput={(e) => setEditing((prev) => ({ ...prev, data: { ...prev.data, detail: e.detail.value } }))} />
              </View>
            </View>
            <View className={styles.editFooter}>
              <View className={styles.editCancel} onClick={() => setShowEditor(false)}>
                <Text className={styles.editCancelText}>取消</Text>
              </View>
              <View className={styles.editConfirm} onClick={handleSave}>
                <Text className={styles.editConfirmText}>保存</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 级联地址选择器 */}
      <AddressPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onConfirm={handlePickConfirm}
        initialProvince={editing.data.province}
        initialCity={editing.data.city}
        initialDistrict={editing.data.district}
        initialTown={editing.data.town}
      />

      {/* 大赛报名弹窗 */}
      {showRegModal && (
        <View className={styles.editModal}>
          <View className={styles.editMask} onClick={() => setShowRegModal(false)} />
          <View className={styles.editPanel}>
            <View className={styles.editHeader}>
              <Text className={styles.editTitle}>🔥 星火计划大赛报名</Text>
              <Text className={styles.editClose} onClick={() => setShowRegModal(false)}>✕</Text>
            </View>
            <View className={styles.editBody}>
              <View className={styles.editGroup}><Text className={styles.editLabel}>姓名 *</Text><Input className={styles.editInput} placeholder="请输入真实姓名" value={regForm.name} onInput={(e) => setRegForm((prev) => ({ ...prev, name: e.detail.value }))} /></View>
              <View className={styles.editGroup}><Text className={styles.editLabel}>所在城市 *</Text><Input className={styles.editInput} placeholder="如：烟台、济南" value={regForm.city} onInput={(e) => setRegForm((prev) => ({ ...prev, city: e.detail.value }))} /></View>
              <View className={styles.editGroup}><Text className={styles.editLabel}>联系电话 *</Text><Input className={styles.editInput} placeholder="请输入手机号" type="number" value={regForm.phone} onInput={(e) => setRegForm((prev) => ({ ...prev, phone: e.detail.value }))} /></View>
              <View className={styles.editGroup}><Text className={styles.editLabel}>微信/QQ *</Text><Input className={styles.editInput} placeholder="方便后续联系通知" value={regForm.contact} onInput={(e) => setRegForm((prev) => ({ ...prev, contact: e.detail.value }))} /></View>
              <View className={styles.editGroup}><Text className={styles.editLabel}>参赛类别（多选）*</Text>
                <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginTop: '8rpx' }}>
                  {CONTEST_CATEGORIES.map((cat) => (
                    <View key={cat} onClick={() => setRegForm((prev) => ({ ...prev, categories: prev.categories.includes(cat) ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat] }))}
                      style={{ padding: '12rpx 28rpx', borderRadius: '32rpx', fontSize: '26rpx', border: regForm.categories.includes(cat) ? '2px solid #b8860b' : '1px solid #e0e0e0', background: regForm.categories.includes(cat) ? 'rgba(184,134,11,0.12)' : '#f9f9f9', color: regForm.categories.includes(cat) ? '#b8860b' : '#666', fontWeight: regForm.categories.includes(cat) ? 600 : 400 }}>
                      <Text>{cat}</Text></View>
                  ))}
                </View>
              </View>
            </View>
            <View className={styles.editFooter}>
              <View className={styles.editCancel} onClick={() => setShowRegModal(false)}><Text className={styles.editCancelText}>取消</Text></View>
              <View className={styles.editConfirm} onClick={handleRegister}><Text className={styles.editConfirmText}>{regSubmitting ? '提交中...' : '提交报名'}</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 分享海报 */}
      <SharePoster visible={showPoster} onClose={() => setShowPoster(false)} registerName={registerName} registerId={registerId} />

    </View>
  );
};

export default MinePage;
