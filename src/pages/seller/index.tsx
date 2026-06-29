import React, { useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAppStore } from '@/store';
import { gdclService } from '@/services/gdcl';
import { getIdentity } from '@/utils/crypto';
import type { Product, ShippingAddress } from '@/types/gdcl';
import AddressPicker from '@/components/AddressPicker';
import styles from './index.module.scss';

// ========== 单位选项（与1088对齐） ==========
const UNIT_GROUPS: { label: string; options: string[] }[] = [
  { label: '数量', options: ['件', '箱', '个', '双', '套', '打', '包', '盒', '袋', '条', '卷'] },
  { label: '重量', options: ['斤', '公斤(kg)', '克(g)', '吨(t)', '磅(lb)', '盎司(oz)'] },
  { label: '体积/液体', options: ['瓶', '桶', '罐', '升(L)', '毫升(mL)', '加仑(gal)'] },
  { label: '长度', options: ['米(m)', '厘米(cm)', '毫米(mm)', '千米(km)', '英尺(ft)', '英寸(inch)', '码(yd)'] },
  { label: '面积', options: ['平方米(㎡)', '公顷(ha)', '亩'] },
];
const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.options);
const UNIT_FLAT_OPTIONS = ALL_UNITS.concat('__other__（自定义）');

const emptyForm = {
  name: '', price: '', unit: '斤', stock: '',
  location: '', shippingOrigin: '', description: '', image: '',
  customUnit: '',
};

const emptyAddr = (type: 'shipping' | 'receiving'): ShippingAddress => ({
  id: '', label: type === 'shipping' ? '发货' : '收货',
  contactName: '', contactPhone: '',
  province: '', city: '', district: '', town: '', detail: '', fullAddress: '',
});

const ADDR_PROVINCES = [
  '北京', '上海', '天津', '重庆', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东',
  '广西', '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
  '台湾', '香港', '澳门',
];
// 简化省市映射
const CITY_MAP: Record<string, string[]> = {
  '山东': ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'],
  '云南': ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧'],
  '广东': ['广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆', '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'],
  '浙江': ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'],
  '江苏': ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'],
  '福建': ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
  '四川': ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳'],
  '辽宁': ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
  '河北': ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
  '河南': ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
  '湖北': ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'],
  '湖南': ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
  '安徽': ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
  '广西': ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
  '陕西': ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
  '江西': ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
  '贵州': ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
  '山西': ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'],
  '吉林': ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'],
  '黑龙江': ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化'],
  '内蒙古': ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'],
  '甘肃': ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南'],
  '新疆': ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密'],
  '海南': ['海口', '三亚', '三沙', '儋州'],
  '宁夏': ['银川', '石嘴山', '吴忠', '固原', '中卫'],
  '青海': ['西宁', '海东'],
  '西藏': ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲'],
  '台湾': ['台北', '高雄', '台中', '台南'],
  '香港': ['香港岛', '九龙', '新界'],
  '澳门': ['澳门半岛', '氹仔', '路环'],
  '北京': ['东城', '西城', '朝阳', '丰台', '石景山', '海淀', '顺义', '通州', '大兴', '房山', '昌平', '怀柔', '平谷', '密云', '延庆', '门头沟'],
  '上海': ['黄浦', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '浦东', '闵行', '宝山', '嘉定', '金山', '松江', '青浦', '奉贤', '崇明'],
  '天津': ['和平', '河东', '河西', '南开', '河北', '红桥', '滨海', '东丽', '西青', '津南', '北辰', '武清', '宝坻', '宁河', '静海', '蓟州'],
  '重庆': ['万州', '涪陵', '渝中', '大渡口', '江北', '沙坪坝', '九龙坡', '南岸', '北碚', '綦江', '大足', '渝北', '巴南', '黔江', '长寿', '江津', '合川', '永川', '南川', '璧山', '铜梁', '潼南', '荣昌'],
};

// ========== 库存预警 ==========
const STOCK_LEVEL = (qty: number): { label: string; cls: string } | null => {
  if (qty <= 0) return { label: '已售罄', cls: 'stockOut' };
  if (qty <= 5) return { label: '即将售罄', cls: 'stockCritical' };
  if (qty <= 10) return { label: '库存偏低', cls: 'stockLow' };
  return null;
};

const SellerPage: React.FC = () => {
  const {
    identity, orders, disputes, reviews,
    acceptProposal, rejectProposal, counterOffer, updateDispute,
    cancelOrder, shipOrder,
    customers, addCustomer, updateCustomer, deleteCustomer,
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<'goods' | 'orders' | 'nego' | 'dispute' | 'review' | 'info' | 'customers' | 'finance'>('goods');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // 切换主题
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  // 卖家商品
  const [myProducts, setMyProducts] = useState<Product[]>(() => {
    try { const s = Taro.getStorageSync('my_products'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  // 地址
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(() => {
    try { const s = Taro.getStorageSync('addr_shipping'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [receivingAddresses, setReceivingAddresses] = useState<ShippingAddress[]>(() => {
    try { const s = Taro.getStorageSync('addr_receive'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const saveProducts = (p: Product[]) => { setMyProducts(p); Taro.setStorageSync('my_products', JSON.stringify(p)); };
  const saveShipAddrs = (a: ShippingAddress[]) => { setShippingAddresses(a); Taro.setStorageSync('addr_shipping', JSON.stringify(a)); };
  const saveRecvAddrs = (a: ShippingAddress[]) => { setReceivingAddresses(a); Taro.setStorageSync('addr_receive', JSON.stringify(a)); };

  // 卖家订单
  const sellerOrders = useMemo(() => orders.filter((o) => o.seller_did === identity?.did), [orders, identity]);
  const sellerNegos = useMemo(() => sellerOrders.filter((o) => o.status === 'pending'), [sellerOrders]);
  const sellerDisputes = useMemo(() => disputes.filter((d) => d.seller_did === identity?.did), [disputes, identity]);
  const sellerReviews = useMemo(() => reviews.filter((r) => r.seller_did === identity?.did), [reviews, identity]);

  // 订单统计
  const orderStats = useMemo(() => {
    const pending = sellerOrders.filter((o) => o.status === 'pending').length;
    const shipped = sellerOrders.filter((o) => o.status === 'shipped').length;
    const completed = sellerOrders.filter((o) => o.status === 'received');
    const revenue = completed.reduce((s, o) => s + (o.total || o.price * o.qty || 0), 0);
    const soldQty = completed.reduce((s, o) => s + (o.qty || 0), 0);
    return { pending, shipped, completedCount: completed.length, revenue, soldQty };
  }, [sellerOrders]);

  // 页面显示时重新加载本地数据（从后台切回时刷新）
  useDidShow(() => {
    try {
      const s = Taro.getStorageSync('my_products');
      if (s) setMyProducts(JSON.parse(s));
      const sa = Taro.getStorageSync('addr_shipping');
      if (sa) setShippingAddresses(JSON.parse(sa));
      const ra = Taro.getStorageSync('addr_receive');
      if (ra) setReceivingAddresses(JSON.parse(ra));
    } catch { /* ignore */ }
  });

  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'done'>('active');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let list = sellerOrders;
    if (orderFilter === 'active') list = list.filter((o) => ['pending', 'accepted', 'confirmed', 'shipped'].includes(o.status));
    else if (orderFilter === 'done') list = list.filter((o) => ['received', 'disputed'].includes(o.status));
    if (orderDateFrom) list = list.filter((o) => o.created_at >= orderDateFrom);
    if (orderDateTo) list = list.filter((o) => o.created_at <= orderDateTo + 'T23:59:59');
    list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [sellerOrders, orderFilter, orderDateFrom, orderDateTo]);

  const detailOrder = useMemo(
    () => sellerOrders.find((o) => o.order_id === detailOrderId) || null,
    [sellerOrders, detailOrderId],
  );

  // 发布/编辑表单
  const [showPublish, setShowPublish] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [unitPickerIdx, setUnitPickerIdx] = useState(2); // 默认"斤"
  const [showUnitCustom, setShowUnitCustom] = useState(false);

  // 还价弹窗
  const [showCounter, setShowCounter] = useState(false);
  const [counterOrderId, setCounterOrderId] = useState('');
  const [counterProductName, setCounterProductName] = useState('');
  const [counterCurrentPrice, setCounterCurrentPrice] = useState(0);
  const [counterNewPrice, setCounterNewPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');

  // 仲裁弹窗
  const [showArbitrate, setShowArbitrate] = useState(false);
  const [arbDisputeId, setArbDisputeId] = useState('');
  const [arbOrderId, setArbOrderId] = useState('');
  const [arbVerdict, setArbVerdict] = useState<'buyer_win' | 'seller_win'>('seller_win');
  const [arbRefund, setArbRefund] = useState('0');

  // 地址编辑
  const [showAddrEdit, setShowAddrEdit] = useState(false);
  const [editAddr, setEditAddr] = useState<ShippingAddress>(emptyAddr('shipping'));
  const [addrProvince, setAddrProvince] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrDistrict, setAddrDistrict] = useState('');

  // 发货弹窗
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipOrderId, setShipOrderId] = useState('');
  const [shipCarrier, setShipCarrier] = useState('SF');
  const [shipTrackingNo, setShipTrackingNo] = useState('');

  // 产地选择器
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [shipAddrPickerIdx, setShipAddrPickerIdx] = useState(0);

  // 订单图片数组
  const [productImages, setProductImages] = useState<string[]>([]);

  // ========== 商品操作 ==========
  const resetUnit = (unitVal: string) => {
    const idx = ALL_UNITS.indexOf(unitVal);
    if (idx >= 0) { setUnitPickerIdx(idx); setShowUnitCustom(false); }
    else { setUnitPickerIdx(UNIT_FLAT_OPTIONS.length - 1); setShowUnitCustom(true); setForm((f) => ({ ...f, customUnit: unitVal })); }
  };

  const openPublish = () => {
    setEditingSku(null);
    setForm(emptyForm);
    setProductImages([]);
    setUnitPickerIdx(2);
    setShowUnitCustom(false);
    setShowPublish(true);
  };

  const openEdit = (p: Product) => {
    setEditingSku(p.sku);
    setForm({
      name: p.name, price: String(p.price), unit: p.unit, stock: String(p.stock),
      location: p.location, shippingOrigin: p.shippingOrigin,
      description: p.description, image: p.image, customUnit: '',
    });
    setProductImages(p.image ? [p.image] : []);
    resetUnit(p.unit);
    setShowPublish(true);
  };

  const handleDelete = (sku: string) => {
    Taro.showModal({
      title: '确认下架', content: '下架后不可恢复，确定吗？',
      success: (res) => {
        if (res.confirm) { saveProducts(myProducts.filter((p) => p.sku !== sku)); Taro.showToast({ title: '已下架', icon: 'success' }); }
      },
    });
  };

  const handleChooseImage = () => {
    if (productImages.length >= 6) { Taro.showToast({ title: '最多6张图片', icon: 'none' }); return; }
    Taro.chooseImage({
      count: 6 - productImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setProductImages([...productImages, ...res.tempFilePaths]);
      },
    });
  };
  const removeImage = (idx: number) => {
    setProductImages(productImages.filter((_, i) => i !== idx));
  };

  const publishToNetwork = (f: typeof form, _did?: string) => {
    const identity = getIdentity();
    try {
      gdclService.send({
        cmd: 'PUBLISH', payload: {
          node_id: identity?.did || _did || '',
          sku: f.sku || '',
          product: f.name.trim(), price_min: parseFloat(f.price) || 0, price_max: parseFloat(f.price) || 0,
          location: f.location.trim() || f.shippingOrigin.trim() || '',
          category: f.unit.trim() || '件', stock: parseInt(f.stock) || 0,
          image: productImages[0] || f.image.trim() || '',
          description: f.description.trim() || '', tags: [],
        },
      });
    } catch (e) { console.warn('[Seller] PUBLISH 发送失败:', e); }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { Taro.showToast({ title: '请输入商品名称', icon: 'none' }); return; }
    const price = parseFloat(form.price);
    if (!price || price <= 0) { Taro.showToast({ title: '请输入有效价格', icon: 'none' }); return; }
    const unit = form.unit === '__other__' ? (form.customUnit || '件') : form.unit;
    if (!unit.trim()) { Taro.showToast({ title: '请选择单位', icon: 'none' }); return; }
    const stock = parseInt(form.stock) || 0;
    if (stock <= 0) { Taro.showToast({ title: '请输入有效库存', icon: 'none' }); return; }
    const mainImage = productImages[0] || form.image.trim() || 'https://picsum.photos/id/292/300/300';

    if (editingSku) {
      const updated = myProducts.map((p) => p.sku === editingSku ? {
        ...p, name: form.name.trim(), price, unit, stock,
        location: form.location.trim() || p.location,
        shippingOrigin: form.shippingOrigin.trim() || p.shippingOrigin,
        description: form.description.trim() || p.description,
        image: mainImage,
      } : p);
      saveProducts(updated);
      Taro.showToast({ title: '修改成功', icon: 'success' });
      publishToNetwork(form, identity?.did);
    } else {
      const newProduct: Product = {
        sku: `MY-${Date.now()}`, name: form.name.trim(), price, unit, stock,
        location: form.location.trim() || '未知产地',
        shippingOrigin: form.shippingOrigin.trim() || form.location.trim() || '未知发货地',
        description: form.description.trim() || '暂无描述', image: mainImage,
        seller_did: identity?.did || '', seller_name: '我',
      };
      saveProducts([...myProducts, newProduct]);
      Taro.showToast({ title: '发布成功', icon: 'success' });
      publishToNetwork(form, identity?.did);
    }
    setShowPublish(false);
  };

  // ========== 协商操作 ==========
  const openCounter = (orderId: string, productName: string, currentPrice: number) => {
    setCounterOrderId(orderId); setCounterProductName(productName); setCounterCurrentPrice(currentPrice);
    setCounterNewPrice(''); setCounterNote(''); setShowCounter(true);
  };

  const submitCounter = () => {
    const np = parseFloat(counterNewPrice);
    if (isNaN(np) || np <= 0) { Taro.showToast({ title: '请输入有效价格', icon: 'none' }); return; }
    counterOffer(counterOrderId, np, counterNote);
    setShowCounter(false);
  };

  // ========== 订单操作 ==========
  const handleAcceptOrder = (orderId: string) => {
    acceptProposal(orderId);
  };
  const handleShipOrder = () => {
    if (!shipTrackingNo.trim()) { Taro.showToast({ title: '请输入运单号', icon: 'none' }); return; }
    shipOrder(shipOrderId, shipTrackingNo);
    setShowShipModal(false);
  };
  const handleCancelOrder = (orderId: string) => {
    Taro.showModal({
      title: '确认取消', content: '确定取消此订单？',
      success: (res) => { if (res.confirm) cancelOrder(orderId); },
    });
  };

  // ========== 仲裁 ==========
  const submitArbitrate = () => {
    updateDispute(arbDisputeId, arbVerdict === 'buyer_win' ? 'accept' : 'reject');
    Taro.showToast({ title: '仲裁完成', icon: 'success' });
    setShowArbitrate(false);
  };

  // ========== 地址操作 ==========
  const openAddrEdit = (type: 'shipping' | 'receiving', addr?: ShippingAddress) => {
    if (addr) {
      setEditAddr(addr);
      setAddrProvince(addr.province); setAddrCity(addr.city); setAddrDistrict(addr.district);
    } else {
      setEditAddr(emptyAddr(type));
      setAddrProvince(''); setAddrCity(''); setAddrDistrict('');
    }
    setShowAddrEdit(true);
  };
  const saveAddr = () => {
    if (!editAddr.contactName.trim()) { Taro.showToast({ title: '请填写联系人', icon: 'none' }); return; }
    if (!editAddr.contactPhone.trim()) { Taro.showToast({ title: '请填写电话', icon: 'none' }); return; }
    const fullAddr = [addrProvince, addrCity, addrDistrict, editAddr.town, editAddr.detail].filter(Boolean).join(' ');
    const saved: ShippingAddress = { ...editAddr, province: addrProvince, city: addrCity, district: addrDistrict, fullAddress: fullAddr, id: editAddr.id || `addr_${Date.now()}` };
    if (editAddr.label.includes('发货')) {
      const idx = shippingAddresses.findIndex((a) => a.id === editAddr.id);
      if (idx >= 0) { const c = [...shippingAddresses]; c[idx] = saved; saveShipAddrs(c); }
      else saveShipAddrs([...shippingAddresses, saved]);
    } else {
      const idx = receivingAddresses.findIndex((a) => a.id === editAddr.id);
      if (idx >= 0) { const c = [...receivingAddresses]; c[idx] = saved; saveRecvAddrs(c); }
      else saveRecvAddrs([...receivingAddresses, saved]);
    }
    Taro.showToast({ title: editAddr.id ? '地址已更新' : '地址已添加', icon: 'success' });
    setShowAddrEdit(false);
  };
  const deleteAddr = (type: 'shipping' | 'receiving', id: string) => {
    Taro.showModal({
      title: '确认删除', content: '确定删除此地址？',
      success: (res) => {
        if (res.confirm) {
          if (type === 'shipping') saveShipAddrs(shippingAddresses.filter((a) => a.id !== id));
          else saveRecvAddrs(receivingAddresses.filter((a) => a.id !== id));
          Taro.showToast({ title: '地址已删除', icon: 'success' });
        }
      },
    });
  };

  // ========== 退出 ==========
  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录', content: '确定退出？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync();
          Taro.reLaunch({ url: '/pages/market/index' });
        }
      },
    });
  };

  // ========== 状态标签 ==========
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: '待接单', color: '#ff7d00', bg: 'rgba(255,125,0,.12)' },
      accepted: { label: '已接单', color: '#b8860b', bg: 'rgba(184,134,11,.12)' },
      confirmed: { label: '已确认', color: '#0052d9', bg: 'rgba(0,82,217,.12)' },
      shipped: { label: '已发货', color: '#165dff', bg: 'rgba(22,93,255,.12)' },
      received: { label: '已完成', color: '#00b42a', bg: 'rgba(0,180,42,.12)' },
      disputed: { label: '争议中', color: '#f53f3f', bg: 'rgba(245,63,63,.12)' },
    };
    const m = map[status] || { label: status, color: '#999', bg: '#f0f0f0' };
    return <Text style={{ fontSize: '22rpx', padding: '4rpx 14rpx', borderRadius: '16rpx', color: m.color, background: m.bg }}>{m.label}</Text>;
  };

  // ========== 预警统计 ==========
  const warningProducts = useMemo(() => myProducts.filter((p) => p.stock <= 10), [myProducts]);
  const soldOutCount = useMemo(() => warningProducts.filter((p) => p.stock <= 0).length, [warningProducts]);

  // ========== Tab 列表 ==========
  const tabs = [
    { key: 'goods' as const, label: '商品管理', badge: 0 },
    { key: 'orders' as const, label: '订单管理', badge: orderStats.pending },
    { key: 'nego' as const, label: '待协商', badge: sellerNegos.length },
    { key: 'dispute' as const, label: '争议', badge: sellerDisputes.length },
    { key: 'review' as const, label: '评价', badge: sellerReviews.length },
    { key: 'info' as const, label: '信息管理', badge: 0 },
    { key: 'customers' as const, label: '客户管理', badge: customers.length },
    { key: 'finance' as const, label: '财务看板', badge: 0 },
  ];

  return (
    <View className={styles.sellerPage} style={theme === 'dark' ? { background: '#1a1a2e', minHeight: '100vh' } : undefined}>
      {/* ====== Header ====== */}
      <View className={styles.header}>
        <Text className={styles.title} style={theme === 'dark' ? { color: '#e0d6b8' } : undefined}>我的货</Text>
        <View style={{ display: 'flex', gap: '12rpx', alignItems: 'center' }}>
          {/* 主题切换 */}
          <View onClick={toggleTheme} style={{ width: '56rpx', height: '56rpx', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32rpx' }}>
            <Text>{theme === 'light' ? '🌙' : '☀️'}</Text>
          </View>
          {/* 退出 */}
          <View onClick={handleLogout} style={{ padding: '8rpx 20rpx', borderRadius: '32rpx', background: '#f0f0f0' }}>
            <Text style={{ fontSize: '24rpx', color: '#f53f3f' }}>退出</Text>
          </View>
          {/* 发布商品 */}
          <View className={styles.addBtn} onClick={openPublish}>
            <Text style={{ color: '#fff', fontSize: '28rpx' }}>+ 发布商品</Text>
          </View>
        </View>
      </View>

      {/* ====== Tab 栏 ====== */}
      <View style={{ display: 'flex', gap: '8rpx', marginBottom: '16rpx', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <View key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={styles.tabItem}
            style={{
              background: activeTab === tab.key ? 'linear-gradient(135deg, #d4a843 0%, #f5d78e 100%)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : theme === 'dark' ? '#ccc' : '#1a1a1a',
              border: activeTab !== tab.key ? '1px solid #ddd' : 'none',
            }}
          >
            <Text style={{ fontSize: '24rpx' }}>{tab.label}{tab.badge > 0 ? ` ${tab.badge}` : ''}</Text>
          </View>
        ))}
      </View>

      {/* ====== 库存预警 ====== */}
      {activeTab === 'goods' && warningProducts.length > 0 && (
        <View style={{ padding: '16rpx 24rpx', marginBottom: '16rpx', borderRadius: '12rpx', background: 'rgba(245,63,63,.08)', border: '1px solid rgba(245,63,63,.3)' }}>
          <Text style={{ fontSize: '26rpx', color: '#f53f3f', fontWeight: '500' }}>
            库存预警：{warningProducts.length} 件商品库存偏低
            {soldOutCount > 0 && <Text style={{ color: '#f53f3f', fontWeight: '700' }}>（其中 {soldOutCount} 件已售罄）</Text>}
          </Text>
          <Text style={{ fontSize: '22rpx', color: '#999', marginTop: '4rpx' }}>请及时补货</Text>
        </View>
      )}

      <ScrollView scrollY style={{ height: 'calc(100vh - 320rpx)' }}>
        {/* ============================================ 商品管理 ============================================ */}
        {activeTab === 'goods' && (
          <View className={styles.productList}>
            {myProducts.length > 0 ? myProducts.map((p) => {
              const sl = STOCK_LEVEL(p.stock);
              const cardBorder = sl
                ? { border: sl.cls === 'stockOut' ? '2px solid rgba(245,63,63,.5)' : sl.cls === 'stockCritical' ? '2px solid rgba(245,63,63,.3)' : '2px solid rgba(255,125,0,.3)' }
                : {};
              const cardBg = sl ? { background: sl.cls === 'stockOut' ? 'rgba(245,63,63,.03)' : sl.cls === 'stockCritical' ? 'rgba(245,63,63,.015)' : 'rgba(255,125,0,.015)' } : {};
              return (
                <View key={p.sku} className={styles.productCard} style={{ ...cardBorder, ...cardBg }}>
                  <Image className={styles.productImage} src={p.image || 'https://picsum.photos/id/292/300/300'} mode="aspectFill" />
                  <View className={styles.productInfo}>
                    <Text className={styles.productName}>{p.name}</Text>
                    <Text className={styles.productPrice}>¥{p.price.toFixed(2)}/{p.unit}</Text>
                    <View className={styles.productMeta}>
                      <Text className={styles.productStock}>库存: {p.stock.toLocaleString()}</Text>
                      {sl ? (
                        <Text style={{
                          fontSize: '20rpx', padding: '2rpx 10rpx', borderRadius: '8rpx',
                          background: sl.cls === 'stockLow' ? 'rgba(255,125,0,.15)' : 'rgba(245,63,63,.12)',
                          color: sl.cls === 'stockLow' ? '#ff7d00' : '#f53f3f',
                        }}>{sl.label}</Text>
                      ) : (
                        <Text className={styles.productStatus}>上架中</Text>
                      )}
                    </View>
                  </View>
                  <View className={styles.cardActions}>
                    <View className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                      <Text style={{ color: '#1a1a1a', fontSize: '24rpx' }}>编辑</Text>
                    </View>
                    <View className={styles.delBtn} onClick={(e) => { e.stopPropagation(); handleDelete(p.sku); }}>
                      <Text style={{ color: '#f53f3f', fontSize: '24rpx' }}>下架</Text>
                    </View>
                  </View>
                </View>
              );
            }) : (
              <View className={styles.empty}>
                <Text className={styles.emptyIcon}>📦</Text>
                <Text className={styles.emptyText}>暂无商品</Text>
                <Text className={styles.emptyHint}>点击上方「+ 发布商品」开始</Text>
              </View>
            )}
          </View>
        )}

        {/* ============================================ 订单管理 ============================================ */}
        {activeTab === 'orders' && (
          <View>
            {/* 统计卡片 */}
            <View style={{ display: 'flex', gap: '12rpx', marginBottom: '16rpx', flexWrap: 'wrap' }}>
              {[
                { label: '待接单', value: orderStats.pending, color: '#ff7d00' },
                { label: '已发货', value: orderStats.shipped, color: '#165dff' },
                { label: '已完成', value: orderStats.completedCount, color: '#00b42a' },
                { label: '收入', value: `¥${orderStats.revenue.toFixed(0)}`, color: '#b8860b' },
              ].map((s) => (
                <View key={s.label} style={{ flex: '1 1 140rpx', padding: '16rpx', borderRadius: '12rpx', background: theme === 'dark' ? '#2a2a3e' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.06)', textAlign: 'center' }}>
                  <Text style={{ fontSize: '30rpx', fontWeight: '700', color: s.color }}>{s.value}</Text>
                  <Text style={{ fontSize: '22rpx', color: '#999', marginTop: '4rpx', display: 'block' }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* 筛选 */}
            <View style={{ display: 'flex', gap: '12rpx', marginBottom: '16rpx', alignItems: 'center', flexWrap: 'wrap' }}>
              {(['active', 'done'] as const).map((f) => (
                <View key={f} onClick={() => setOrderFilter(f)}
                  style={{
                    padding: '8rpx 24rpx', borderRadius: '32rpx', fontSize: '24rpx',
                    background: orderFilter === f ? 'linear-gradient(135deg, #d4a843, #f5d78e)' : 'transparent',
                    color: orderFilter === f ? '#fff' : '#666',
                    border: orderFilter !== f ? '1px solid #ddd' : 'none',
                  }}
                ><Text>{f === 'active' ? '进行中' : '已完成'}</Text></View>
              ))}
              <View style={{ display: 'flex', gap: '8rpx', alignItems: 'center', marginLeft: 'auto' }}>
                <Input value={orderDateFrom} placeholder="开始日期" onInput={(e) => setOrderDateFrom(e.detail.value)}
                  style={{ width: '160rpx', height: '56rpx', border: '1px solid #ddd', borderRadius: '8rpx', fontSize: '22rpx', padding: '0 8rpx', textAlign: 'center' }} />
                <Text style={{ fontSize: '22rpx', color: '#999' }}>至</Text>
                <Input value={orderDateTo} placeholder="结束日期" onInput={(e) => setOrderDateTo(e.detail.value)}
                  style={{ width: '160rpx', height: '56rpx', border: '1px solid #ddd', borderRadius: '8rpx', fontSize: '22rpx', padding: '0 8rpx', textAlign: 'center' }} />
              </View>
            </View>

            {/* 订单列表 */}
            {filteredOrders.length > 0 ? filteredOrders.map((o) => (
              <View key={o.order_id} style={{ marginBottom: '16rpx', borderRadius: '12rpx', background: theme === 'dark' ? '#2a2a3e' : '#fff', padding: '20rpx', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#999' }}>#{o.order_id.substring(0, 10)}</Text>
                  {statusBadge(o.status)}
                </View>
                <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: '28rpx', fontWeight: '500', color: theme === 'dark' ? '#e0d6b8' : '#1a1a1a' }}>{o.product_name || '-'}</Text>
                    <Text style={{ fontSize: '24rpx', color: '#999', marginTop: '4rpx' }}>数量: {o.qty} | ¥{(o.price || 0).toFixed(2)}</Text>
                  </View>
                  <Text style={{ fontSize: '30rpx', fontWeight: '700', color: '#b8860b' }}>¥{((o.total || o.price * o.qty || 0)).toFixed(2)}</Text>
                </View>

                {/* 操作按钮 */}
                <View style={{ display: 'flex', gap: '12rpx', marginTop: '12rpx' }}>
                  {(o.status === 'pending' || o.status === 'accepted') && (
                    <View onClick={() => handleCancelOrder(o.order_id)}
                      style={{ flex: 1, height: '60rpx', borderRadius: '32rpx', border: '1px solid #f53f3f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: '26rpx', color: '#f53f3f' }}>取消</Text>
                    </View>
                  )}
                  {o.status === 'pending' && (
                    <View onClick={() => handleAcceptOrder(o.order_id)}
                      style={{ flex: 1, height: '60rpx', borderRadius: '32rpx', background: 'linear-gradient(135deg, #d4a843, #f5d78e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: '26rpx', color: '#fff', fontWeight: '500' }}>接单</Text>
                    </View>
                  )}
                  {o.status === 'accepted' && (
                    <View onClick={() => { setShipOrderId(o.order_id); setShipTrackingNo(''); setShowShipModal(true); }}
                      style={{ flex: 1, height: '60rpx', borderRadius: '32rpx', background: 'linear-gradient(135deg, #165dff, #4080ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: '26rpx', color: '#fff', fontWeight: '500' }}>发货</Text>
                    </View>
                  )}
                  <View onClick={() => setDetailOrderId(detailOrderId === o.order_id ? null : o.order_id)}
                    style={{ flex: 1, height: '60rpx', borderRadius: '32rpx', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: '26rpx', color: '#666' }}>{detailOrderId === o.order_id ? '收起' : '详情'}</Text>
                  </View>
                </View>

                {/* 订单详情面板 */}
                {detailOrderId === o.order_id && detailOrder && (
                  <View style={{ marginTop: '16rpx', padding: '16rpx', borderRadius: '10rpx', background: theme === 'dark' ? '#222236' : '#f8f8f8' }}>
                    <Text style={{ fontSize: '26rpx', fontWeight: '600', color: theme === 'dark' ? '#e0d6b8' : '#1a1a1a' }}>订单详情</Text>
                    <View style={{ marginTop: '10rpx', display: 'flex', flexDirection: 'column', gap: '6rpx' }}>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>订单号: {detailOrder.order_id}</Text>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>商品: {detailOrder.product_name || '-'}</Text>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>数量: {detailOrder.qty}</Text>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>单价: ¥{(detailOrder.price || 0).toFixed(2)}</Text>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>总价: ¥{(detailOrder.total || detailOrder.price * detailOrder.qty || 0).toFixed(2)}</Text>
                      {detailOrder.tracking_no && <Text style={{ fontSize: '24rpx', color: '#999' }}>运单号: {detailOrder.tracking_no}</Text>}
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>创建时间: {detailOrder.created_at}</Text>
                      <Text style={{ fontSize: '24rpx', color: '#999' }}>更新时间: {detailOrder.updated_at}</Text>
                    </View>
                    {/* 时间线 */}
                    <View style={{ marginTop: '12rpx', display: 'flex', alignItems: 'center', gap: '4rpx' }}>
                      {[
                        { label: '下单', done: true },
                        { label: '接单', done: detailOrder.status !== 'pending' },
                        { label: '发货', done: ['shipped', 'received', 'disputed'].includes(detailOrder.status) },
                        { label: '完成', done: detailOrder.status === 'received' },
                      ].map((n, i, arr) => (
                        <React.Fragment key={n.label}>
                          <View style={{ width: '16rpx', height: '16rpx', borderRadius: '50%', background: n.done ? '#00b42a' : '#ddd' }} />
                          <Text style={{ fontSize: '18rpx', color: n.done ? '#00b42a' : '#ccc' }}>{n.label}</Text>
                          {i < arr.length - 1 && <View style={{ flex: 1, height: '2rpx', background: n.done ? '#00b42a' : '#ddd' }} />}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )) : (
              <View className={styles.empty}><Text className={styles.emptyText}>{orderFilter === 'done' ? '暂无已完成订单' : '暂无进行中订单'}</Text></View>
            )}
          </View>
        )}

        {/* ============================================ 待协商 ============================================ */}
        {activeTab === 'nego' && (
          <View className={styles.negoSection}>
            {sellerNegos.length > 0 ? sellerNegos.map((nego) => (
              <View key={nego.order_id} className={styles.negoCard}>
                <View className={styles.negoHeader} onClick={() => Taro.navigateTo({ url: `/pages/nego-detail/index?orderId=${nego.order_id}` })}>
                  <Text className={styles.negoSku}>{nego.product_name}</Text>
                  <Text className={`${styles.negoStatus} ${styles.negoPending}`}>待确认</Text>
                </View>
                <View className={styles.negoRow}><Text className={styles.negoLabel}>数量</Text><Text className={styles.negoValue}>{nego.qty}</Text></View>
                <View className={styles.negoRow}><Text className={styles.negoLabel}>单价</Text><Text className={styles.negoValue}>¥{nego.price.toFixed(2)}</Text></View>
                <View className={styles.negoRow}><Text className={styles.negoLabel}>总额</Text><Text className={styles.negoValue}>¥{nego.total.toFixed(2)}</Text></View>
                <View className={styles.negoActions}>
                  <View className={`${styles.negoBtn} ${styles.counterBtn}`} onClick={(e) => { e.stopPropagation(); openCounter(nego.order_id, nego.product_name, nego.price); }}>
                    <Text style={{ color: '#b8860b', fontSize: '28rpx' }}>还价</Text>
                  </View>
                  <View className={`${styles.negoBtn} ${styles.acceptBtn}`} onClick={(e) => { e.stopPropagation(); acceptProposal(nego.order_id); }}>
                    <Text style={{ color: '#fff', fontSize: '28rpx' }}>接受</Text>
                  </View>
                  <View className={`${styles.negoBtn} ${styles.rejectBtn}`} onClick={(e) => { e.stopPropagation(); rejectProposal(nego.order_id); }}>
                    <Text style={{ color: '#f53f3f', fontSize: '28rpx' }}>拒绝</Text>
                  </View>
                </View>
              </View>
            )) : (
              <View className={styles.empty}><Text className={styles.emptyText}>暂无待处理协商</Text></View>
            )}
          </View>
        )}

        {/* ============================================ 争议 ============================================ */}
        {activeTab === 'dispute' && (
          <View className={styles.negoSection}>
            {sellerDisputes.length > 0 ? sellerDisputes.map((d) => (
              <View key={d.dispute_id} className={styles.negoCard}>
                <View className={styles.negoHeader}>
                  <Text className={styles.negoSku}>#{d.dispute_id.substring(0, 8)}</Text>
                  <Text style={{
                    fontSize: '22rpx', padding: '4rpx 12rpx', borderRadius: '16rpx',
                    background: d.status === 'resolved' ? '#e8f5e9' : d.status === 'appealed' ? '#fff3e0' : '#fce4ec',
                    color: d.status === 'resolved' ? '#00b42a' : d.status === 'appealed' ? '#f5a623' : '#f53f3f',
                  }}>{d.status === 'open' ? '待处理' : d.status === 'resolved' ? '已解决' : d.status === 'appealed' ? '已申诉' : d.status}</Text>
                </View>
                <View className={styles.negoRow}><Text className={styles.negoLabel}>订单</Text><Text className={styles.negoValue}>#{d.order_id.substring(0, 8)}</Text></View>
                <View className={styles.negoRow}><Text className={styles.negoLabel}>原因</Text><Text className={styles.negoValue}>{d.reason}</Text></View>
                {d.description ? <View className={styles.negoRow}><Text className={styles.negoLabel}>说明</Text><Text className={styles.negoValue} style={{ fontSize: '24rpx' }}>{d.description.substring(0, 60)}</Text></View> : null}
                {d.ruling ? <View className={styles.negoRow}><Text className={styles.negoLabel}>裁决</Text><Text className={styles.negoValue} style={{ color: '#b8860b' }}>{d.ruling}</Text></View> : null}
                {d.status === 'open' && (
                  <View className={styles.negoActions}>
                    <View className={`${styles.negoBtn} ${styles.acceptBtn}`} onClick={() => updateDispute(d.dispute_id, 'accept')}>
                      <Text style={{ color: '#fff', fontSize: '28rpx' }}>接受诉求</Text>
                    </View>
                    <View className={`${styles.negoBtn} ${styles.rejectBtn}`} onClick={() => updateDispute(d.dispute_id, 'reject')}>
                      <Text style={{ color: '#f53f3f', fontSize: '28rpx' }}>拒绝诉求</Text>
                    </View>
                  </View>
                )}
                {d.status === 'appealed' && (
                  <View className={styles.negoActions}>
                    <View className={`${styles.negoBtn} ${styles.acceptBtn}`} onClick={() => { setArbDisputeId(d.dispute_id); setArbOrderId(d.order_id); setArbVerdict('seller_win'); setArbRefund('0'); setShowArbitrate(true); }}>
                      <Text style={{ color: '#fff', fontSize: '28rpx' }}>仲裁</Text>
                    </View>
                  </View>
                )}
              </View>
            )) : (
              <View className={styles.empty}><Text className={styles.emptyText}>暂无争议记录</Text></View>
            )}
          </View>
        )}

        {/* ============================================ 评价 ============================================ */}
        {activeTab === 'review' && (
          <View className={styles.negoSection}>
            {sellerReviews.length > 0 ? sellerReviews.map((r) => (
              <View key={r.review_id} className={styles.negoCard}>
                <View className={styles.negoHeader}>
                  <Text className={styles.negoSku}>订单 #{r.order_id.substring(0, 8)}</Text>
                  <View style={{ display: 'flex', gap: '4rpx' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Text key={star} style={{ color: star <= r.rating ? '#f5a623' : '#e0e0e0', fontSize: '28rpx' }}>★</Text>
                    ))}
                  </View>
                </View>
                {r.content ? <View className={styles.negoRow}><Text className={styles.negoValue} style={{ fontSize: '26rpx' }}>{r.content}</Text></View> : null}
                <View className={styles.negoRow}><Text className={styles.negoLabel}>时间</Text><Text className={styles.negoValue}>{r.created_at}</Text></View>
              </View>
            )) : (
              <View className={styles.empty}><Text className={styles.emptyText}>暂无评价记录</Text></View>
            )}
          </View>
        )}

        {/* ============================================ 信息管理 ============================================ */}
        {activeTab === 'info' && (
          <View>
            {(['shipping', 'receiving'] as const).map((type) => {
              const addrs = type === 'shipping' ? shippingAddresses : receivingAddresses;
              return (
                <View key={type} style={{ marginBottom: '32rpx' }}>
                  <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12rpx' }}>
                    <Text style={{ fontSize: '28rpx', fontWeight: '600', color: theme === 'dark' ? '#e0d6b8' : '#1a1a1a' }}>
                      {type === 'shipping' ? '发货地址' : '收货地址'}
                    </Text>
                    <View onClick={() => openAddrEdit(type, undefined)}
                      style={{ padding: '8rpx 20rpx', borderRadius: '32rpx', background: 'linear-gradient(135deg, #d4a843, #f5d78e)' }}>
                      <Text style={{ fontSize: '24rpx', color: '#fff' }}>+ 添加</Text>
                    </View>
                  </View>
                  {addrs.length > 0 ? addrs.map((a) => (
                    <View key={a.id} style={{ padding: '20rpx', marginBottom: '12rpx', borderRadius: '12rpx', background: theme === 'dark' ? '#2a2a3e' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '28rpx', fontWeight: '500', color: theme === 'dark' ? '#e0d6b8' : '#1a1a1a' }}>{a.contactName}</Text>
                          <Text style={{ fontSize: '24rpx', color: '#999' }}>{a.contactPhone}</Text>
                          <Text style={{ fontSize: '22rpx', color: '#aaa', marginTop: '4rpx' }}>{a.fullAddress}</Text>
                        </View>
                        <View style={{ display: 'flex', gap: '16rpx' }}>
                          <Text style={{ fontSize: '24rpx', color: '#b8860b' }} onClick={() => openAddrEdit(type, a)}>编辑</Text>
                          <Text style={{ fontSize: '24rpx', color: '#f53f3f' }} onClick={() => deleteAddr(type, a.id)}>删除</Text>
                        </View>
                      </View>
                    </View>
                  )) : (
                    <View className={styles.empty}><Text className={styles.emptyText}>暂无{type === 'shipping' ? '发货' : '收货'}地址</Text></View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ====== 发布/编辑弹窗 ====== */}
      {showPublish && (
        <View className={styles.publishModal}>
          <View className={styles.publishMask} onClick={() => setShowPublish(false)} />
          <View className={styles.publishPanel}>
            <View className={styles.publishHeader}>
              <Text className={styles.publishTitle}>{editingSku ? '编辑商品' : '发布商品'}</Text>
              <Text className={styles.publishClose} onClick={() => setShowPublish(false)}>✕</Text>
            </View>
            <View className={styles.publishBody}>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>商品名称 *</Text>
                <Input className={styles.formInput} placeholder="如：云南普洱茶" value={form.name} onInput={(e) => setForm({ ...form, name: e.detail.value })} />
              </View>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <View className={styles.formGroup} style={{ flex: 1 }}>
                  <Text className={styles.formLabel}>单价 *</Text>
                  <Input className={styles.formInput} type="digit" placeholder="0.00" value={form.price} onInput={(e) => setForm({ ...form, price: e.detail.value })} />
                </View>
                <View className={styles.formGroup} style={{ flex: 1 }}>
                  <Text className={styles.formLabel}>单位 *</Text>
                  <Picker mode="selector" range={UNIT_FLAT_OPTIONS} value={unitPickerIdx} onChange={(e) => {
                    const idx = parseInt(e.detail.value as string);
                    setUnitPickerIdx(idx);
                    if (idx === UNIT_FLAT_OPTIONS.length - 1) {
                      setShowUnitCustom(true);
                      setForm({ ...form, unit: '__other__', customUnit: form.customUnit || '' });
                    } else {
                      setShowUnitCustom(false);
                      setForm({ ...form, unit: ALL_UNITS[idx], customUnit: '' });
                    }
                  }}>
                    <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: '28rpx', color: '#1a1a1a' }}>{form.unit === '__other__' ? (form.customUnit || '自定义') : form.unit}</Text>
                      <Text style={{ color: '#999', fontSize: '24rpx' }}>▾</Text>
                    </View>
                  </Picker>
                </View>
              </View>
              {showUnitCustom && (
                <View className={styles.formGroup}>
                  <Text className={styles.formLabel}>自定义单位</Text>
                  <Input className={styles.formInput} placeholder="请输入单位" value={form.customUnit} onInput={(e) => setForm({ ...form, customUnit: e.detail.value })} />
                </View>
              )}
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>库存 *</Text>
                <Input className={styles.formInput} type="number" placeholder="0" value={form.stock} onInput={(e) => setForm({ ...form, stock: e.detail.value })} />
              </View>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>产地</Text>
                <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => setShowLocationPicker(true)}>
                  <Text style={{ color: form.location ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>{form.location || '点击选择省市区'}</Text>
                  <Text style={{ color: '#999', fontSize: '24rpx' }}>▸</Text>
                </View>
              </View>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>发货地</Text>
                {shippingAddresses.length > 0 ? (
                  <Picker mode="selector" range={shippingAddresses} rangeKey="fullAddress" value={shipAddrPickerIdx}
                    onChange={(e) => {
                      const idx = parseInt(e.detail.value as string);
                      setShipAddrPickerIdx(idx);
                      const addr = shippingAddresses[idx];
                      setForm({ ...form, shippingOrigin: addr.fullAddress || `${addr.province} ${addr.city} ${addr.district} ${addr.detail}` });
                    }}>
                    <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: form.shippingOrigin ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>{form.shippingOrigin || '请选择发货地址'}</Text>
                      <Text style={{ color: '#999', fontSize: '24rpx' }}>▾</Text>
                    </View>
                  </Picker>
                ) : (
                  <Input className={styles.formInput} placeholder="如：云南昆明仓库" value={form.shippingOrigin} onInput={(e) => setForm({ ...form, shippingOrigin: e.detail.value })} />
                )}
              </View>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>描述</Text>
                <Textarea className={styles.formTextarea} placeholder="简单描述商品特点..." value={form.description} onInput={(e) => setForm({ ...form, description: e.detail.value })} />
              </View>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>商品图片（最多6张）</Text>
                <View style={{ display: 'flex', gap: '12rpx', flexWrap: 'wrap' }}>
                  {productImages.map((img, idx) => (
                    <View key={idx} style={{ position: 'relative', width: '120rpx', height: '120rpx' }}>
                      <Image src={img} mode="aspectFill" style={{ width: '120rpx', height: '120rpx', borderRadius: '8rpx' }} />
                      <View onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '-8rpx', right: '-8rpx', width: '36rpx', height: '36rpx', borderRadius: '50%', background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: '24rpx', lineHeight: 1 }}>✕</Text>
                      </View>
                    </View>
                  ))}
                  {productImages.length < 6 && (
                    <View onClick={handleChooseImage} style={{ width: '120rpx', height: '120rpx', borderRadius: '8rpx', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#1a1a1a', fontSize: '48rpx' }}>+</Text>
                    </View>
                  )}
                </View>
                <Input className={styles.formInput} style={{ marginTop: '12rpx' }} placeholder="或输入图片URL" value={form.image}
                  onInput={(e) => { setForm({ ...form, image: e.detail.value }); if (e.detail.value && productImages.length === 0) setProductImages([e.detail.value]); }} />
              </View>
            </View>
            <View className={styles.publishFooter}>
              <View className={styles.publishCancel} onClick={() => setShowPublish(false)}>
                <Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text>
              </View>
              <View className={styles.publishConfirm} onClick={handleSubmit}>
                <Text style={{ color: '#fff', fontSize: '28rpx' }}>{editingSku ? '保存修改' : '确认发布'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 还价弹窗 ====== */}
      {showCounter && (
        <View className={styles.publishModal}>
          <View className={styles.publishMask} onClick={() => setShowCounter(false)} />
          <View className={styles.publishPanel}>
            <View className={styles.publishHeader}>
              <Text className={styles.publishTitle}>卖家还价</Text>
              <Text className={styles.publishClose} onClick={() => setShowCounter(false)}>✕</Text>
            </View>
            <View className={styles.publishBody}>
              <View className={styles.formGroup}><Text className={styles.formLabel}>商品</Text><Text style={{ fontSize: '28rpx', color: '#1a1a1a' }}>{counterProductName}</Text></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>当前报价</Text><Text style={{ fontSize: '28rpx', color: '#b8860b' }}>¥{counterCurrentPrice.toFixed(2)}</Text></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>您的还价 *</Text>
                <Input className={styles.formInput} type="digit" placeholder="输入新价格" value={counterNewPrice} onInput={(e) => setCounterNewPrice(e.detail.value)} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>备注</Text>
                <Input className={styles.formInput} placeholder="可选备注" value={counterNote} onInput={(e) => setCounterNote(e.detail.value)} /></View>
            </View>
            <View className={styles.publishFooter}>
              <View className={styles.publishCancel} onClick={() => setShowCounter(false)}><Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text></View>
              <View className={styles.publishConfirm} onClick={submitCounter}><Text style={{ color: '#fff', fontSize: '28rpx' }}>确认还价</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 仲裁弹窗 ====== */}
      {showArbitrate && (
        <View className={styles.publishModal}>
          <View className={styles.publishMask} onClick={() => setShowArbitrate(false)} />
          <View className={styles.publishPanel}>
            <View className={styles.publishHeader}>
              <Text className={styles.publishTitle}>仲裁</Text>
              <Text className={styles.publishClose} onClick={() => setShowArbitrate(false)}>✕</Text>
            </View>
            <View className={styles.publishBody}>
              <View className={styles.formGroup}><Text className={styles.formLabel}>订单</Text><Text style={{ fontSize: '28rpx', color: '#1a1a1a' }}>#{arbOrderId.substring(0, 8)}</Text></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>裁决</Text>
                <View style={{ display: 'flex', gap: '24rpx', marginTop: '8rpx' }}>
                  <View onClick={() => setArbVerdict('buyer_win')} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                    <View style={{ width: '32rpx', height: '32rpx', borderRadius: '50%', border: '2px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {arbVerdict === 'buyer_win' && <View style={{ width: '18rpx', height: '18rpx', borderRadius: '50%', background: '#b8860b' }} />}
                    </View>
                    <Text style={{ fontSize: '26rpx' }}>买家胜诉</Text>
                  </View>
                  <View onClick={() => setArbVerdict('seller_win')} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                    <View style={{ width: '32rpx', height: '32rpx', borderRadius: '50%', border: '2px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {arbVerdict === 'seller_win' && <View style={{ width: '18rpx', height: '18rpx', borderRadius: '50%', background: '#b8860b' }} />}
                    </View>
                    <Text style={{ fontSize: '26rpx' }}>卖家胜诉</Text>
                  </View>
                </View>
              </View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>退款金额</Text><Input className={styles.formInput} type="digit" placeholder="0" value={arbRefund} onInput={(e) => setArbRefund(e.detail.value)} /></View>
            </View>
            <View className={styles.publishFooter}>
              <View className={styles.publishCancel} onClick={() => setShowArbitrate(false)}><Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text></View>
              <View className={styles.publishConfirm} onClick={submitArbitrate}><Text style={{ color: '#fff', fontSize: '28rpx' }}>提交仲裁</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 发货弹窗 ====== */}
      {showShipModal && (
        <View className={styles.publishModal}>
          <View className={styles.publishMask} onClick={() => setShowShipModal(false)} />
          <View className={styles.publishPanel}>
            <View className={styles.publishHeader}>
              <Text className={styles.publishTitle}>发货</Text>
              <Text className={styles.publishClose} onClick={() => setShowShipModal(false)}>✕</Text>
            </View>
            <View className={styles.publishBody}>
              <View className={styles.formGroup}><Text className={styles.formLabel}>物流公司</Text><Input className={styles.formInput} placeholder="如：SF" value={shipCarrier} onInput={(e) => setShipCarrier(e.detail.value)} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>运单号</Text><Input className={styles.formInput} placeholder="请输入运单号" value={shipTrackingNo} onInput={(e) => setShipTrackingNo(e.detail.value)} /></View>
            </View>
            <View className={styles.publishFooter}>
              <View className={styles.publishCancel} onClick={() => setShowShipModal(false)}><Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text></View>
              <View className={styles.publishConfirm} onClick={handleShipOrder}><Text style={{ color: '#fff', fontSize: '28rpx' }}>确认发货</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 地址编辑弹窗 ====== */}
      {showAddrEdit && (
        <View className={styles.publishModal}>
          <View className={styles.publishMask} onClick={() => setShowAddrEdit(false)} />
          <View className={styles.publishPanel}>
            <View className={styles.publishHeader}>
              <Text className={styles.publishTitle}>{editAddr.id ? '编辑地址' : '添加地址'}</Text>
              <Text className={styles.publishClose} onClick={() => setShowAddrEdit(false)}>✕</Text>
            </View>
            <View className={styles.publishBody}>
              <View className={styles.formGroup}><Text className={styles.formLabel}>联系人</Text><Input className={styles.formInput} placeholder="姓名" value={editAddr.contactName} onInput={(e) => setEditAddr({ ...editAddr, contactName: e.detail.value })} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>电话</Text><Input className={styles.formInput} type="number" placeholder="手机号" value={editAddr.contactPhone} onInput={(e) => setEditAddr({ ...editAddr, contactPhone: e.detail.value })} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>省</Text>
                <Picker mode="selector" range={ADDR_PROVINCES} onChange={(e) => { setAddrProvince(ADDR_PROVINCES[parseInt(e.detail.value as string)]); setAddrCity(''); setAddrDistrict(''); }}>
                  <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: addrProvince ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>{addrProvince || '请选择'}</Text><Text style={{ color: '#999' }}>▾</Text></View>
                </Picker>
              </View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>市</Text>
                <Picker mode="selector" range={addrProvince ? (CITY_MAP[addrProvince] || []) : []} onChange={(e) => { setAddrCity((CITY_MAP[addrProvince] || [])[parseInt(e.detail.value as string)]); setAddrDistrict(''); }}>
                  <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: addrCity ? '#1a1a1a' : '#999', fontSize: '28rpx' }}>{addrCity || '请选择'}</Text><Text style={{ color: '#999' }}>▾</Text></View>
                </Picker>
              </View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>区/县</Text><Input className={styles.formInput} placeholder="区县" value={addrDistrict} onInput={(e) => setAddrDistrict(e.detail.value)} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>镇/街道</Text><Input className={styles.formInput} placeholder="镇/街道" value={editAddr.town} onInput={(e) => setEditAddr({ ...editAddr, town: e.detail.value })} /></View>
              <View className={styles.formGroup}><Text className={styles.formLabel}>详细地址</Text><Input className={styles.formInput} placeholder="门牌号、路名等" value={editAddr.detail} onInput={(e) => setEditAddr({ ...editAddr, detail: e.detail.value })} /></View>
            </View>
            <View className={styles.publishFooter}>
              <View className={styles.publishCancel} onClick={() => setShowAddrEdit(false)}><Text style={{ color: '#1a1a1a', fontSize: '28rpx' }}>取消</Text></View>
              <View className={styles.publishConfirm} onClick={saveAddr}><Text style={{ color: '#fff', fontSize: '28rpx' }}>保存</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* ====== 客户管理 ====== */}
      {activeTab === 'customers' && (
        <View>
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16rpx' }}>
            <Text style={{ fontSize: '28rpx', fontWeight: 600 }}>客户列表（{customers.length}）</Text>
            <View style={{ padding: '8rpx 24rpx', background: 'linear-gradient(135deg, #d4a843, #f5d78e)', borderRadius: '24rpx' }}
              onClick={() => {
                Taro.showModal({ title: '添加客户', editable: true, placeholderText: '客户名称', success: (res) => {
                  if (res.confirm && res.content) addCustomer(res.content, '');
                }});
              }}>
              <Text style={{ color: '#fff', fontSize: '24rpx' }}>+ 添加</Text>
            </View>
          </View>
          {customers.length === 0 ? (
            <View style={{ padding: '40rpx', textAlign: 'center' }}><Text style={{ color: '#999' }}>暂无客户</Text></View>
          ) : (
            customers.map((c) => (
              <View key={c.id} style={{ background: '#fff', borderRadius: '12rpx', padding: '20rpx', marginBottom: '12rpx', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: '28rpx', fontWeight: 500 }}>{c.name}</Text>
                  <Text style={{ fontSize: '22rpx', color: '#999' }}>{c.phone || '无电话'} · {c.level} · {c.created_at?.slice(0, 10)}</Text>
                </View>
                <View style={{ display: 'flex', gap: '12rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#d4a843' }} onClick={() => {
                    Taro.showModal({ title: '编辑客户', editable: true, placeholderText: '新名称', content: c.name, success: (res) => {
                      if (res.confirm && res.content) updateCustomer(c.id, { name: res.content });
                    }});
                  }}>编辑</Text>
                  <Text style={{ fontSize: '22rpx', color: '#f53f3f' }} onClick={() => {
                    Taro.showModal({ title: '确认删除', content: `确定删除客户"${c.name}"？`, success: (res) => {
                      if (res.confirm) deleteCustomer(c.id);
                    }});
                  }}>删除</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ====== 财务看板 ====== */}
      {activeTab === 'finance' && (
        <View>
          <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginBottom: '20rpx' }}>
            {[
              { label: '总订单', value: sellerOrders.length },
              { label: '已完成', value: sellerOrders.filter((o) => o.status === 'received').length },
              { label: '总收入', value: `¥${sellerOrders.filter((o) => o.status === 'received').reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}` },
              { label: '客户数', value: customers.length },
              { label: '商品数', value: myProducts.length },
              { label: '库存预警', value: myProducts.filter((p) => p.stock <= 10).length },
            ].map((item) => (
              <View key={item.label} style={{ flex: '1 1 45%', background: 'linear-gradient(135deg, #1a1a2e, #2d2d44)', borderRadius: '12rpx', padding: '20rpx', border: '1px solid rgba(184,134,11,.2)' }}>
                <Text style={{ fontSize: '22rpx', color: '#8b949e' }}>{item.label}</Text>
                <Text style={{ fontSize: '32rpx', fontWeight: 700, color: '#f5d78e', marginTop: '8rpx' }}>{item.value}</Text>
              </View>
            ))}
          </View>
          {/* 订单状态分布 */}
          <Text style={{ fontSize: '26rpx', fontWeight: 600, marginBottom: '12rpx' }}>订单状态分布</Text>
          {['pending', 'accepted', 'escrowed', 'shipped', 'received', 'disputed'].map((status) => {
            const count = sellerOrders.filter((o) => o.status === status).length;
            const total = sellerOrders.length || 1;
            const pct = Math.round((count / total) * 100);
            const labels: Record<string, string> = { pending: '待处理', accepted: '已接单', escrowed: '托管中', shipped: '已发货', received: '已完成', disputed: '争议中' };
            const colors: Record<string, string> = { pending: '#ff7d00', accepted: '#b8860b', escrowed: '#d4a843', shipped: '#165dff', received: '#00b42a', disputed: '#f53f3f' };
            return (
              <View key={status} style={{ marginBottom: '10rpx' }}>
                <View style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#666' }}>{labels[status] || status}</Text>
                  <Text style={{ fontSize: '22rpx', color: colors[status] }}>{count} ({pct}%)</Text>
                </View>
                <View style={{ height: '8rpx', background: '#f0f0f0', borderRadius: '4rpx' }}>
                  <View style={{ height: '100%', width: `${pct}%`, background: colors[status], borderRadius: '4rpx' }} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ====== 产地省市区联动选择器 ====== */}
      <AddressPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(result) => { setForm({ ...form, location: result.fullAddress }); }}
      />
    </View>
  );
};

export default SellerPage;