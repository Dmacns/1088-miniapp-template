// 全局状态管理 Context
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Taro from '@tarojs/taro';
import { gdclService } from '@/services/gdcl';
import { initIdentity, getIdentity } from '@/utils/crypto';
import type { DidIdentity, ChainStatus, Order, OfflineReceipt, Product, CartItem, Dispute, Review, Customer, GdclMessage } from '@/types/gdcl';

interface AppState {
  identity: DidIdentity | null;
  chainStatus: ChainStatus;
  orders: Order[];
  offlineReceipts: OfflineReceipt[];
  searchResults: Product[];
  cart: CartItem[];
  disputes: Dispute[];
  reviews: Review[];
  customers: Customer[];
  isConnected: boolean;
  devMode: boolean;
  // 支付
  paymentInfo: { orderId: string; productName: string; amount: number } | null;
  showPayment: boolean;
}

interface AppContextValue extends AppState {
  searchProducts: (query: string) => void;
  proposeOrder: (sku: string, qty: number, price: number, productName: string, sellerDid: string) => string;
  acceptProposal: (orderId: string) => void;
  rejectProposal: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  confirmReceive: (orderId: string) => void;
  shipOrder: (orderId: string, trackingNo: string) => void;
  refreshOrders: () => void;
  switchSeed: (url: string) => void;
  addToCart: (item: Omit<CartItem, 'id' | 'added_at'>) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  // 客户
  addCustomer: (name: string, phone: string) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  // 争议
  createDispute: (orderId: string, reason: string, description: string) => void;
  updateDispute: (disputeId: string, action: 'accept' | 'reject') => void;
  submitAppeal: (disputeId: string, description: string) => void;
  // 评价
  submitReview: (orderId: string, sellerDid: string, rating: number, content: string) => void;
  // 还价
  counterOffer: (orderId: string, newPrice: number, note: string) => void;
  buyerCounterOffer: (orderId: string, newPrice: number, note: string) => void;
  toggleDevMode: () => void;
  directBuy: (sku: string, qty: number, price: number, productName: string, sellerDid: string) => string;
  settleOrder: (orderId: string) => void;
  switchNego: (orderId: string) => void;
  // 支付
  openPayment: (info: { orderId: string; productName: string; amount: number }) => void;
  closePayment: () => void;
  confirmPay: (method: string) => void;
}

const defaultState: AppState = {
  identity: null,
  chainStatus: { online: false, last_checked: '' },
  orders: [],
  offlineReceipts: [],
  searchResults: [],
  cart: [],
  disputes: [],
  reviews: [],
  customers: [],
  isConnected: false,
  devMode: false,
  paymentInfo: null,
  showPayment: false,
};

const AppContext = createContext<AppContextValue>({
  ...defaultState,
  searchProducts: () => {},
  proposeOrder: () => '',
  acceptProposal: () => {},
  rejectProposal: () => {},
  cancelOrder: () => {},
  confirmReceive: () => {},
  shipOrder: () => {},
  refreshOrders: () => {},
  switchSeed: () => {},
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  createDispute: () => {},
  updateDispute: () => {},
  submitAppeal: () => {},
  submitReview: () => {},
  counterOffer: () => {},
  buyerCounterOffer: () => {},
  toggleDevMode: () => {},
  directBuy: () => '',
  settleOrder: () => {},
  switchNego: () => {},
});

export const useAppStore = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const identityRef = useRef<DidIdentity | null>(null);

  // 同步 identity ref（供 GDCL 闭包内使用）
  useEffect(() => { identityRef.current = state.identity; }, [state.identity]);

  // 初始化
  useEffect(() => {
    const identity = initIdentity();
    setState((prev) => ({ ...prev, identity }));

    // 2. 从本地存储恢复订单和收据
    const storedOrders = Taro.getStorageSync('orders');
    const storedReceipts = Taro.getStorageSync('offline_receipts');
    const storedCart = Taro.getStorageSync('cart');
    const storedDisputes = Taro.getStorageSync('disputes');
    const storedReviews = Taro.getStorageSync('reviews');
    const storedDevMode = Taro.getStorageSync('devMode');
    const storedCustomers = Taro.getStorageSync('customers');
    setState((prev) => ({
      ...prev,
      orders: storedOrders ? JSON.parse(storedOrders).map((o: any) => ({ ...o, is_nego: o.is_nego ?? false })) : [],
      offlineReceipts: storedReceipts ? JSON.parse(storedReceipts) : [],
      cart: storedCart ? JSON.parse(storedCart) : [],
      disputes: storedDisputes ? JSON.parse(storedDisputes) : [],
      reviews: storedReviews ? JSON.parse(storedReviews) : [],
      customers: storedCustomers ? JSON.parse(storedCustomers) : [],
      devMode: storedDevMode === 'true',
    }));

    // 3. 先注册消息处理器（必须在连接前注册，避免竞态丢消息）
    const handleWelcome = (msg: any) => {
      const peers = msg.payload?.peers ?? 0;
      setState((prev) => ({
        ...prev,
        isConnected: true,
        chainStatus: {
          online: peers > 0,
          block_height: msg.payload?.block_height,
          last_checked: new Date().toISOString(),
        },
      }));
      console.info('[Store] WELCOME peers:', peers);
    };

    const handleDiscoverResult = (msg: any) => {
      console.info('[Store] DISCOVER_RESULT payload:', JSON.stringify(msg.payload));
      const sellers = msg.payload?.sellers || msg.payload?.results || msg.payload?.products || [];
      const items: Product[] = sellers.map((s: any) => ({
        sku: s.sku || s.product || s.name || '',
        name: s.product || s.name || '',
        price: s.price_min ?? s.price ?? 0,
        unit: s.category || s.unit || '',
        stock: s.stock || 99,
        image: s.image || '',
        seller_did: s.node_id || s.seller_did || '',
        seller_name: s.seller_name || s.node_id || '',
        location: s.location || '',
        shippingOrigin: s.shippingOrigin || s.location || '',
        description: s.description || '',
      }));
      setState((prev) => ({ ...prev, searchResults: items }));
    };

    const handleQueryResult = (msg: any) => {
      console.info('[Store] QUERY_RESULT payload:', JSON.stringify(msg.payload));
      const products: any[] = msg.payload?.products || [];
      const items: Product[] = products.map((p: any) => ({
        sku: p.sku || '',
        name: p.name || '',
        price: p.price || 0,
        unit: p.unit || '',
        stock: p.stock ?? 99,
        image: p.image || '',
        seller_did: p.seller_did || '',
        seller_name: p.seller_name || '',
        location: p.location || '',
        shippingOrigin: p.shippingOrigin || p.location || '',
        description: p.description || '',
      }));
      setState((prev) => ({ ...prev, searchResults: items }));
    };

    const handleChainStatus = (msg: any) => {
      const online = msg.payload?.ok ?? false;
      setState((prev) => ({
        ...prev,
        chainStatus: {
          online,
          block_height: msg.payload?.block_height,
          last_checked: new Date().toISOString(),
        },
      }));
    };

    const handleProposalAck = (msg: any) => {
      console.info('[Store] 协商已提交:', msg.payload?.proposal_id);
      const payload = msg.payload || {};
      const myDid = identityRef.current?.did;
      const isSeller = myDid && payload.seller_did === myDid;
      const isBuyer = myDid && payload.buyer_did === myDid;
      if (isSeller) {
        Taro.showToast({ title: '您有新的订单！', icon: 'none', duration: 2500 });
      } else if (isBuyer) {
        Taro.showToast({ title: '协商已提交', icon: 'success' });
      }
      if (payload.proposal_id) {
        const newOrder: Order = {
          order_id: payload.proposal_id,
          proposal_id: payload.proposal_id,
          sku: payload.sku || '',
          product_name: payload.product_name || '',
          qty: payload.qty || 0,
          price: payload.price || 0,
          total: (payload.price || 0) * (payload.qty || 0),
          buyer_did: payload.buyer_did || '',
          seller_did: payload.seller_did || '',
          status: 'pending',
          is_nego: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setState((prev) => {
          const exists = prev.orders.find((o) => o.order_id === newOrder.order_id);
          if (exists) return prev;
          const updated = [...prev.orders, newOrder];
          Taro.setStorageSync('orders', JSON.stringify(updated));
          return { ...prev, orders: updated };
        });
      }
    };

    // ★ 收到 ACCEPT → 更新订单状态
    const handleAccept = (msg: any) => {
      const orderId = msg.payload?.order_id;
      const reject = msg.payload?.reject;
      if (!orderId) return;
      setState((prev) => {
        if (reject) {
          const updated = prev.orders.filter((o) => o.order_id !== orderId);
          Taro.setStorageSync('orders', JSON.stringify(updated));
          return { ...prev, orders: updated };
        }
        const updated = prev.orders.map((o) =>
          o.order_id === orderId ? { ...o, status: 'accepted' as const, updated_at: new Date().toISOString() } : o
        );
        Taro.setStorageSync('orders', JSON.stringify(updated));
        return { ...prev, orders: updated };
      });
      Taro.showToast({ title: reject ? '对方已拒绝订单' : '卖家已接受订单', icon: reject ? 'none' : 'success' });
    };

    gdclService.on('WELCOME', handleWelcome);
    gdclService.on('DISCOVER_RESULT', handleDiscoverResult);
    gdclService.on('QUERY_RESULT', handleQueryResult);
    gdclService.on('CHAIN_STATUS', handleChainStatus);
    gdclService.on('PROPOSAL_ACK', handleProposalAck);
    gdclService.on('ACCEPT', handleAccept);

    // ★ 收到 SHIP_NOTIFY → 更新订单状态为已发货
    const handleShipNotify = (msg: any) => {
      const orderId = msg.payload?.order_id;
      const carrier = msg.payload?.carrier || '';
      const trackingNo = msg.payload?.tracking_no || '';
      if (!orderId) return;
      console.info('[Store] SHIP_NOTIFY:', orderId, carrier, trackingNo);
      setState((prev) => {
        const updated = prev.orders.map((o) =>
          o.order_id === orderId
            ? { ...o, status: 'shipped' as const, updated_at: new Date().toISOString() }
            : o
        );
        Taro.setStorageSync('orders', JSON.stringify(updated));
        return { ...prev, orders: updated };
      });
      Taro.showToast({ title: `卖家已发货${carrier ? '：' + carrier : ''}`, icon: 'success', duration: 3000 });
    };

    gdclService.on('SHIP_NOTIFY', handleShipNotify);

    // ★ 收到 ORDER → 卖家收到新订单通知
    const handleOrder = (msg: any) => {
      const p = msg.payload || {}; const orderId = p.order_id;
      if (!orderId) return;
      const myDid = identityRef.current?.did;
      if (p.seller_did !== myDid && p.buyer_did !== myDid) return;
      setState((prev) => {
        if (prev.orders.find((o) => o.order_id === orderId)) return prev;
        const no: Order = { order_id: orderId, proposal_id: orderId, sku: p.sku || '', product_name: p.product_name || p.product || '', qty: p.qty || p.quantity || 1, price: p.price || 0, total: p.total || (p.price || 0) * (p.qty || 1), buyer_did: p.buyer_did || '', seller_did: p.seller_did || '', status: 'pending', is_nego: true, created_at: p.timestamp || new Date().toISOString(), updated_at: new Date().toISOString() };
        const updated = [...prev.orders, no];
        Taro.setStorageSync('orders', JSON.stringify(updated));
        return { ...prev, orders: updated };
      });
      Taro.showToast({ title: '🔔 您有新的订单！', icon: 'none', duration: 3000 });
    };
    gdclService.on(ORDER_PROPOSE, handleOrder);

    // ★ 收到 NEGO/NEGO_UPDATE
    const handleNego = (msg: any) => {
      const p = msg.payload || {}; const oid = p.order_id || p.nego_id;
      if (!oid) return;
      setState((prev) => {
        const updated = prev.orders.map((o) => o.order_id === oid ? { ...o, price: p.counter_price || p.price || o.price, status: 'pending' as const, is_nego: true, updated_at: new Date().toISOString() } : o);
        Taro.setStorageSync('orders', JSON.stringify(updated));
        return { ...prev, orders: updated };
      });
      Taro.showToast({ title: `对方还价 ¥${p.counter_price || p.price || '?'}`, icon: 'none', duration: 3000 });
    };
    gdclService.on('NEGO_PROPOSE', handleNego);

    // ★ 收到 DISPUTE/DISPUTE_UPDATE
    const handleDispute = (msg: any) => {
      const p = msg.payload || {}; const did = p.dispute_id;
      if (!did) return;
      setState((prev) => {
        let updatedOrders = prev.orders;
        if (p.order_id) updatedOrders = prev.orders.map((o) => o.order_id === p.order_id ? { ...o, status: 'disputed' as const, updated_at: new Date().toISOString() } : o);
        const existIdx = prev.disputes.findIndex((d) => d.dispute_id === did);
        let updatedDisputes: Dispute[];
        if (existIdx >= 0) { updatedDisputes = [...prev.disputes]; updatedDisputes[existIdx] = { ...updatedDisputes[existIdx], status: p.status || updatedDisputes[existIdx].status, ruling: p.ruling, refund_amount: p.refund_amount ?? updatedDisputes[existIdx].refund_amount, resolved_at: new Date().toISOString() }; }
        else { updatedDisputes = [...prev.disputes, { dispute_id: did, order_id: p.order_id || '', buyer_did: p.buyer_did || '', seller_did: p.seller_did || '', reason: p.reason || '', description: p.description || '', status: p.status || 'open', ruling: p.ruling, refund_amount: p.refund_amount, created_at: p.timestamp || new Date().toISOString(), resolved_at: p.resolved_at }]; }
        Taro.setStorageSync('orders', JSON.stringify(updatedOrders));
        Taro.setStorageSync('disputes', JSON.stringify(updatedDisputes));
        return { ...prev, orders: updatedOrders, disputes: updatedDisputes };
      });
      Taro.showToast({ title: p.status === 'resolved' ? '争议已解决' : p.status === 'appealed' ? '买家已申诉' : '收到争议通知', icon: 'none', duration: 3000 });
    };
    gdclService.on('DISPUTE_PROPOSE', handleDispute);
    gdclService.on('DISPUTE_UPDATE_PROPOSE', handleDispute);

    // ★ 收到 REVIEW
    const handleReview = (msg: any) => {
      const p = msg.payload || {}; const rid = p.review_id;
      if (!rid) return;
      setState((prev) => {
        if (prev.reviews.find((r) => r.review_id === rid)) return prev;
        const updated = [...prev.reviews, { review_id: rid, order_id: p.order_id || '', reviewer_did: p.reviewer_did || p.buyer_did || '', seller_did: p.seller_did || '', rating: p.rating || 0, content: p.content || '', created_at: p.timestamp || new Date().toISOString() }];
        Taro.setStorageSync('reviews', JSON.stringify(updated));
        return { ...prev, reviews: updated };
      });
      Taro.showToast({ title: `收到${p.rating || '?'}星评价`, icon: 'none', duration: 2500 });
    };
    gdclService.on('REVIEW_PROPOSE', handleReview);

    // ★ COMMIT_ACK / EXECUTE_ACK / CONFIRM_RECEIPT
    const handleCommitAck = (msg: any) => {
      const oid = msg.payload?.order_id; if (!oid) return;
      setState((prev) => {
        const updated = prev.orders.map((o) => o.order_id === oid ? { ...o, status: 'escrowed' as const, tx_hash: msg.payload?.tx_hash || o.tx_hash, updated_at: new Date().toISOString() } : o);
        Taro.setStorageSync('orders', JSON.stringify(updated)); return { ...prev, orders: updated };
      });
      Taro.showToast({ title: '🔒 资金已托管上链', icon: 'success', duration: 2500 });
    };
    const handleExecuteAck = (msg: any) => {
      const oid = msg.payload?.order_id; if (!oid) return;
      setState((prev) => {
        const updated = prev.orders.map((o) => o.order_id === oid ? { ...o, status: 'received' as const, tx_hash: msg.payload?.tx_hash || o.tx_hash, updated_at: new Date().toISOString() } : o);
        Taro.setStorageSync('orders', JSON.stringify(updated)); return { ...prev, orders: updated };
      });
      Taro.showToast({ title: '✅ 资金已释放，交易完成', icon: 'success', duration: 2500 });
    };
    const handleConfirmReceipt = (msg: any) => {
      const oid = msg.payload?.order_id; if (!oid) return;
      setState((prev) => {
        const updated = prev.orders.map((o) => o.order_id === oid ? { ...o, status: 'received' as const, updated_at: new Date().toISOString() } : o);
        Taro.setStorageSync('orders', JSON.stringify(updated)); return { ...prev, orders: updated };
      });
      Taro.showToast({ title: '买家已确认收货', icon: 'success', duration: 2500 });
    };
    gdclService.on('COMMIT_ACK', handleCommitAck);
    gdclService.on('EXECUTE_ACK', handleExecuteAck);
    gdclService.on('CONFIRM_RECEIPT', handleConfirmReceipt);

    // PUBLISH_ACK 消掉 warning
    gdclService.on('PUBLISH_ACK', (msg: GdclMessage) => {
      console.info('[Store] PUBLISH_ACK:', msg.payload);
    });

    // 标记处理器已就绪，然后连接
    gdclService.markReady();
    gdclService.init();

    // ===== Bridge: 启动商品同步 + 定时POLL =====
    const did = identityRef.current?.did;
    const pollTimer = setInterval(() => {
      if (!identityRef.current?.did) return;
      const myDid = identityRef.current.did;
      // POLL拉取离线订单/协商/争议/评价
      gdclService.send({ cmd: 'ORDER_POLL', payload: { seller_did: myDid } });
      gdclService.send({ cmd: 'NEGO_POLL', payload: { seller_did: myDid } });
      gdclService.send({ cmd: 'DISPUTE_POLL', payload: { seller_did: myDid } });
      gdclService.send({ cmd: 'REVIEW_POLL', payload: { seller_did: myDid } });
    }, 30000);

    // 启动同步（等连接稳定后）
    setTimeout(() => {
      if (!identityRef.current?.did) return;
      const myDid = identityRef.current.did;
      // CLEAR_MINE 清空旧商品
      gdclService.send({ cmd: 'CLEAR_MINE', payload: { node_id: myDid } });
      // PUBLISH 本地商品
      try {
        const stored = Taro.getStorageSync('my_products');
        if (stored) {
          const products = JSON.parse(stored);
          products.forEach((p: any) => {
            gdclService.send({
              cmd: 'PUBLISH',
              payload: {
                node_id: myDid,
                sku: p.sku || '',
                product: p.name || '',
                price_min: p.price || 0,
                price_max: p.price || 0,
                location: p.location || p.shippingOrigin || '',
                category: p.unit || '',
                stock: p.stock || 0,
                description: p.description || '',
                tags: [],
              },
            });
          });
        }
      } catch (e) { console.error('Bridge sync failed:', e); }
    }, 5000);

    // 注册POLL结果处理器
    const handlePollResult = (msg: any, key: string, mapFn: (item: any) => any) => {
      const items = (msg.payload?.orders || msg.payload?.negos || msg.payload?.disputes || msg.payload?.reviews || [])
        .map(mapFn);
      if (items.length > 0) {
        setState((prev: any) => {
          const existing = prev[key] || [];
          const merged = [...existing];
          items.forEach((item: any) => {
            const idField = key === 'orders' ? 'order_id' : key === 'disputes' ? 'dispute_id' : key === 'reviews' ? 'review_id' : 'order_id';
            if (!merged.find((e: any) => e[idField] === item[idField])) {
              merged.push(item);
            }
          });
          Taro.setStorageSync(key, JSON.stringify(merged));
          return { ...prev, [key]: merged };
        });
      }
    };
    gdclService.on('ORDER_POLL_RESULT', (msg: any) => handlePollResult(msg, 'orders', (o: any) => ({
      order_id: o.order_id || o.id, proposal_id: o.order_id, sku: o.product_sku || '', product_name: o.product_name || '',
      qty: o.quantity || 0, price: o.unit_price || 0, total: o.total_price || 0,
      buyer_did: o.buyer_did || '', seller_did: o.seller_did || '',
      status: o.status || 'pending', is_nego: o.is_nego ?? true,
      created_at: o.created_at || '', updated_at: o.updated_at || '',
    })));
    gdclService.on('DISPUTE_POLL_RESULT', (msg: any) => handlePollResult(msg, 'disputes', (d: any) => d));
    gdclService.on('REVIEW_POLL_RESULT', (msg: any) => handlePollResult(msg, 'reviews', (r: any) => r));

    return () => {
      gdclService.off('WELCOME', handleWelcome);
      gdclService.off('DISCOVER_RESULT', handleDiscoverResult);
      gdclService.off('QUERY_RESULT', handleQueryResult);
      gdclService.off('CHAIN_STATUS', handleChainStatus);
      gdclService.off('PROPOSAL_ACK', handleProposalAck);
      gdclService.off('ACCEPT', handleAccept);
      gdclService.off('SHIP_NOTIFY', handleShipNotify);
      gdclService.off(ORDER_PROPOSE, handleOrder);
      gdclService.off('NEGO_PROPOSE', handleNego);
      gdclService.off('DISPUTE_PROPOSE', handleDispute);
      gdclService.off('DISPUTE_PROPOSE', handleDispute);
      gdclService.off('REVIEW_PROPOSE', handleReview);
      gdclService.off('COMMIT_ACK', handleCommitAck);
      gdclService.off('EXECUTE_ACK', handleExecuteAck);
      gdclService.off('CONFIRM_RECEIPT', handleConfirmReceipt);
      gdclService.off('ORDER_POLL_RESULT', () => {});
      gdclService.off('DISPUTE_POLL_RESULT', () => {});
      gdclService.off('REVIEW_POLL_RESULT', () => {});
      clearInterval(pollTimer);
      gdclService.close();
    };
  }, []);

  // 持久化订单
  useEffect(() => {
    Taro.setStorageSync('orders', JSON.stringify(state.orders));
  }, [state.orders]);

  // 持久化离线收据
  useEffect(() => {
    Taro.setStorageSync('offline_receipts', JSON.stringify(state.offlineReceipts));
  }, [state.offlineReceipts]);

  // 持久化购物车
  useEffect(() => {
    Taro.setStorageSync('cart', JSON.stringify(state.cart));
  }, [state.cart]);

  // 持久化争议
  useEffect(() => {
    Taro.setStorageSync('disputes', JSON.stringify(state.disputes));
  }, [state.disputes]);

  // 持久化评价
  useEffect(() => {
    Taro.setStorageSync('reviews', JSON.stringify(state.reviews));
  }, [state.reviews]);

  // 持久化客户
  useEffect(() => {
    Taro.setStorageSync('customers', JSON.stringify(state.customers));
  }, [state.customers]);

  // 搜索商品
  const searchProducts = useCallback((query: string) => {
    console.info('[Store] DISCOVER:', query);
    gdclService.send({
      cmd: 'DISCOVER',
      payload: { product: query },
    });
  }, []);

  // 发起协商（返回 order_id 供跳转）
  const proposeOrder = useCallback((sku: string, qty: number, price: number, productName: string, sellerDid: string): string => {
    const identity = getIdentity();
    if (!identity) {
      Taro.showToast({ title: '请先初始化身份', icon: 'none' });
      return '';
    }
    const orderId = `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    gdclService.send({
      cmd: 'NEGO_PROPOSE',
      payload: {
        order_id: orderId,
        buyer_did: identity.did,
        seller_did: sellerDid,
        product: productName,
        quantity: qty,
        price,
        total: price * qty,
      },
    });
    // 本地创建订单用于展示
    const newOrder: Order = {
      order_id: orderId,
      proposal_id: orderId,
      sku,
      product_name: productName,
      qty,
      price,
      total: price * qty,
      buyer_did: identity.did,
      seller_did: sellerDid,
      status: 'pending',
      is_nego: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setState((prev) => {
      const updated = [...prev.orders, newOrder];
      Taro.setStorageSync('orders', JSON.stringify(updated));
      return { ...prev, orders: updated };
    });
    return orderId;
  }, []);

  // 直接购买（不协商，待结算）
  const directBuy = useCallback((sku: string, qty: number, price: number, productName: string, sellerDid: string): string => {
    const identity = getIdentity();
    if (!identity) {
      Taro.showToast({ title: '请先初始化身份', icon: 'none' });
      return '';
    }
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newOrder: Order = {
      order_id: orderId,
      proposal_id: orderId,
      sku,
      product_name: productName,
      qty,
      price,
      total: price * qty,
      buyer_did: identity.did,
      seller_did: sellerDid,
      status: 'confirmed',
      is_nego: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setState((prev) => {
      const updated = [...prev.orders, newOrder];
      Taro.setStorageSync('orders', JSON.stringify(updated));
      return { ...prev, orders: updated };
    });
    // 通知卖家有新订单
    try {
      gdclService.send({
        cmd: ORDER_PROPOSE,
        payload: {
          order_id: orderId,
          buyer_did: identity.did,
          seller_did: sellerDid,
          sku,
          product_name: productName,
          qty,
          price,
          total: price * qty,
        },
      });
      console.info('[Store] ORDER 消息已发送给卖家:', sellerDid);
    } catch (e) {
      console.warn('[Store] ORDER 发送失败（离线模式仍可本地记录）:', e);
    }
    return orderId;
  }, []);

  // 结算（直接购买订单 → 变为已托管，通知卖家）
  const settleOrder = useCallback((orderId: string) => {
    const order = state.orders.find((o) => o.order_id === orderId);
    if (order) {
      // 打开支付弹窗，支付确认后再COMMIT
      openPayment({ orderId: order.order_id, productName: order.product_name, amount: order.total || order.price * order.qty });
    }
  }, [state.orders]);

  // 直接购买订单转为协商
  const switchNego = useCallback((orderId: string) => {
    setState((prev) => {
      const updated = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'pending' as const, is_nego: true, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已转为协商模式', icon: 'success' });
    setTimeout(() => Taro.navigateTo({ url: `/pages/nego-detail/index?orderId=${orderId}` }), 300);
  }, []);

  // 接受协商
  const acceptProposal = useCallback((orderId: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.order_id === orderId);
      const updated = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'escrowed' as const, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      if (order) {
        gdclService.send({ cmd: 'ACCEPT', payload: { target: order.buyer_did, order_id: orderId, buyer_did: order.buyer_did, seller_did: order.seller_did } });
        gdclService.send({ cmd: 'COMMIT', payload: { order_id: orderId, buyer_did: order.buyer_did, seller_did: order.seller_did } });
      }
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已接受，资金进入托管', icon: 'success' });
  }, []);

  // 拒绝协商
  const rejectProposal = useCallback((orderId: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.order_id === orderId);
      const updated = prev.orders.filter((o) => o.order_id !== orderId);
      Taro.setStorageSync('orders', JSON.stringify(updated));
      if (order) {
        gdclService.send({ cmd: 'ACCEPT', payload: { target: order.buyer_did, order_id: orderId, reject: true, buyer_did: order.buyer_did, seller_did: order.seller_did } });
      }
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已拒绝', icon: 'none' });
  }, []);

  // 取消订单
  const cancelOrder = useCallback((orderId: string) => {
    setState((prev) => {
      const updated = prev.orders.filter((o) => o.order_id !== orderId);
      Taro.setStorageSync('orders', JSON.stringify(updated));
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '订单已取消', icon: 'success' });
  }, []);

  // 确认收货
  const confirmReceive = useCallback((orderId: string) => {
    setState((prev) => {
      const updated = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'received' as const, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      return { ...prev, orders: updated };
    });
    // ★ 通知 买家 → P2P 链上释放 + 确认收货
    const txHash = '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    setState((prev) => {
      const order = prev.orders.find((o) => o.order_id === orderId);
      const updated = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'received' as const, tx_hash: txHash, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      if (order) {
        gdclService.send({ cmd: 'EXECUTE', payload: { order_id: orderId, buyer_did: order.buyer_did, seller_did: order.seller_did, tx_hash: txHash } });
        gdclService.send({ cmd: 'CONFIRM_RECEIPT', payload: { order_id: orderId, buyer_did: order.buyer_did, seller_did: order.seller_did } });
      }
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已确认收货，资金已释放', icon: 'success' });
  }, []);

  // 发货
  const shipOrder = useCallback((orderId: string, trackingNo: string) => {
    setState((prev) => {
      const updated = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'shipped' as const, tracking_no: trackingNo, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      // send P2P SHIP_NOTIFY
      const _order = prev.orders.find((o: any) => o.order_id === orderId);
      if (_order) gdclService.send({ cmd: 'SHIP_NOTIFY', payload: { target: _order.buyer_did, order_id: orderId, buyer_did: _order.buyer_did, seller_did: _order.seller_did, tracking_no: trackingNo } });
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已发货', icon: 'success' });
  }, []);

  // 刷新订单
  const refreshOrders = useCallback(() => {
    const storedOrders = Taro.getStorageSync('orders');
    if (storedOrders) {
      setState((prev) => ({ ...prev, orders: JSON.parse(storedOrders) }));
    }
    const storedReceipts = Taro.getStorageSync('offline_receipts');
    if (storedReceipts) {
      setState((prev) => ({ ...prev, offlineReceipts: JSON.parse(storedReceipts) }));
    }
  }, []);

  // 加入购物车
  const addToCart = useCallback((item: Omit<CartItem, 'id' | 'added_at'>) => {
    setState((prev) => {
      const exist = prev.cart.find((c) => c.sku === item.sku);
      if (exist) {
        const newQty = exist.qty + item.qty;
        if (newQty <= 0) {
          // 数量归零则删除
          return { ...prev, cart: prev.cart.filter((c) => c.sku !== item.sku) };
        }
        const updated = prev.cart.map((c) =>
          c.sku === item.sku ? { ...c, qty: newQty } : c
        );
        return { ...prev, cart: updated };
      }
      if (item.qty <= 0) return prev; // 新商品不可能为负
      const newItem: CartItem = {
        ...item,
        id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        added_at: new Date().toISOString(),
      };
      return { ...prev, cart: [...prev.cart, newItem] };
    });
    Taro.showToast({ title: '已加入购物车', icon: 'success' });
  }, []);

  // 从购物车移除
  const removeFromCart = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      cart: prev.cart.filter((c) => c.id !== id),
    }));
  }, []);

  // 清空购物车
  const clearCart = useCallback(() => {
    setState((prev) => ({ ...prev, cart: [] }));
  }, []);

  // ====== 客户管理 ======
  const addCustomer = useCallback((name: string, phone: string) => {
    const c: Customer = { id: `cust_${Date.now()}`, name, phone, level: '普通', credit_limit: 0, credit_used: 0, created_at: new Date().toISOString() };
    setState((prev) => ({ ...prev, customers: [...prev.customers, c] }));
    Taro.showToast({ title: '客户已添加', icon: 'success' });
  }, []);
  const updateCustomer = useCallback((id: string, data: Partial<Customer>) => {
    setState((prev) => ({ ...prev, customers: prev.customers.map((c) => c.id === id ? { ...c, ...data } : c) }));
    Taro.showToast({ title: '客户已更新', icon: 'success' });
  }, []);
  const deleteCustomer = useCallback((id: string) => {
    setState((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
    Taro.showToast({ title: '客户已删除', icon: 'success' });
  }, []);

  // ====== 争议 ======

  // 发起争议
  const createDispute = useCallback((orderId: string, reason: string, description: string) => {
    const identity = getIdentity();
    if (!identity) return;

    setState((prev) => {
      const order = prev.orders.find((o) => o.order_id === orderId);
      if (!order) return prev;

      const newDispute: Dispute = {
        dispute_id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        order_id: orderId,
        buyer_did: order.buyer_did,
        seller_did: order.seller_did,
        reason,
        description,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      const updatedOrders = prev.orders.map((o) =>
        o.order_id === orderId ? { ...o, status: 'disputed' as const, updated_at: new Date().toISOString() } : o
      );
      const updatedDisputes = [...prev.disputes, newDispute];
      Taro.setStorageSync('orders', JSON.stringify(updatedOrders));
      return { ...prev, orders: updatedOrders, disputes: updatedDisputes };
    });
    Taro.showToast({ title: '争议已发起', icon: 'success' });
  }, []);

  // 处理争议（卖家接受/拒绝买家诉求）
  const updateDispute = useCallback((disputeId: string, action: 'accept' | 'reject') => {
    setState((prev) => {
      const updated = prev.disputes.map((d) => {
        if (d.dispute_id !== disputeId) return d;
        if (action === 'accept') {
          return { ...d, status: 'resolved' as const, ruling: '卖家接受诉求', resolved_at: new Date().toISOString() };
        }
        return { ...d, status: 'open' as const, ruling: '卖家拒绝诉求' };
      });
      return { ...prev, disputes: updated };
    });
    Taro.showToast({ title: action === 'accept' ? '已接受诉求' : '已拒绝诉求', icon: 'success' });
  }, []);

  // 买家申诉
  const submitAppeal = useCallback((disputeId: string, description: string) => {
    setState((prev) => {
      const updated = prev.disputes.map((d) =>
        d.dispute_id === disputeId ? { ...d, status: 'appealed' as const, description: d.description + '\n[申诉]: ' + description } : d
      );
      return { ...prev, disputes: updated };
    });
    Taro.showToast({ title: '申诉已提交', icon: 'success' });
  }, []);

  // ====== 评价 ======

  const submitReview = useCallback((orderId: string, sellerDid: string, rating: number, content: string) => {
    const identity = getIdentity();
    if (!identity) return;
    const newReview: Review = {
      review_id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      order_id: orderId,
      reviewer_did: identity.did,
      seller_did: sellerDid,
      rating,
      content,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, reviews: [...prev.reviews, newReview] }));
    gdclService.send({ cmd: 'REVIEW_PROPOSE', payload: { review_id: newReview.review_id, order_id: orderId, reviewer_did: identity.did, seller_did: sellerDid, rating, content } });
    Taro.showToast({ title: '评价已提交', icon: 'success' });
  }, []);

  // ====== 还价 ======

  // 卖家还价
  const counterOffer = useCallback((orderId: string, newPrice: number, _note: string) => {
    setState((prev) => {
      const updated = prev.orders.map((o) =>
        o.order_id === orderId
          ? { ...o, price: newPrice, total: newPrice * o.qty, status: 'pending' as const, updated_at: new Date().toISOString() }
          : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      // send P2P SHIP_NOTIFY
      const _order = prev.orders.find((o: any) => o.order_id === orderId);
      if (_order) gdclService.send({ cmd: 'SHIP_NOTIFY', payload: { target: _order.buyer_did, order_id: orderId, buyer_did: _order.buyer_did, seller_did: _order.seller_did, tracking_no: trackingNo } });
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已发货', icon: 'success' });
  }, []);

  // 买家再次还价
  const buyerCounterOffer = useCallback((orderId: string, newPrice: number, _note: string) => {
    setState((prev) => {
      const updated = prev.orders.map((o) =>
        o.order_id === orderId
          ? { ...o, price: newPrice, total: newPrice * o.qty, status: 'pending' as const, updated_at: new Date().toISOString() }
          : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      // send P2P SHIP_NOTIFY
      const _order = prev.orders.find((o: any) => o.order_id === orderId);
      if (_order) gdclService.send({ cmd: 'SHIP_NOTIFY', payload: { target: _order.buyer_did, order_id: orderId, buyer_did: _order.buyer_did, seller_did: _order.seller_did, tracking_no: trackingNo } });
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已发货', icon: 'success' });
  }, []);

  // 切换开发者模式
  // ====== 支付 ======
  const openPayment = useCallback((info: { orderId: string; productName: string; amount: number }) => {
    setState((prev) => ({ ...prev, paymentInfo: info, showPayment: true }));
  }, []);
  const closePayment = useCallback(() => {
    setState((prev) => ({ ...prev, showPayment: false, paymentInfo: null }));
  }, []);
  const confirmPay = useCallback((_method: string) => {
    setState((prev) => {
      if (!prev.paymentInfo) return prev;
      const oid = prev.paymentInfo.orderId;
      const txHash = '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
      const order = prev.orders.find((o) => o.order_id === oid);
      const updated = prev.orders.map((o) =>
        o.order_id === oid ? { ...o, status: 'escrowed' as const, tx_hash: txHash, updated_at: new Date().toISOString() } : o
      );
      Taro.setStorageSync('orders', JSON.stringify(updated));
      if (order) {
        gdclService.send({ cmd: 'COMMIT', payload: { order_id: oid, buyer_did: order.buyer_did, seller_did: order.seller_did, tx_hash: txHash } });
      }
      return { ...prev, orders: updated, showPayment: false, paymentInfo: null };
    });
    Taro.showToast({ title: '资金已托管上链', icon: 'success' });
  }, []);

  const toggleDevMode = useCallback(() => {
    setState((prev) => {
      const next = !prev.devMode;
      Taro.setStorageSync('devMode', String(next));
      Taro.showToast({ title: next ? '开发者模式已开启' : '开发者模式已关闭', icon: 'success' });
      // 关闭旧连接，重连后自动就绪
      gdclService.close();
       setTimeout(() => {
         gdclService.markReady();
         gdclService.connect();
       }, 300);
      return { ...prev, devMode: next };
    });
  }, []);

  // 切换Seed
  const switchSeed = useCallback((url: string) => {
    gdclService.switchSeed(url);
    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        searchProducts,
        proposeOrder,
        acceptProposal,
        rejectProposal,
        cancelOrder,
        confirmReceive,
        shipOrder,
        refreshOrders,
        switchSeed,
        addToCart,
        removeFromCart,
        clearCart,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        createDispute,
        updateDispute,
        submitAppeal,
        submitReview,
        counterOffer,
        buyerCounterOffer,
        toggleDevMode,
        directBuy,
        settleOrder,
        switchNego,
        openPayment,
        closePayment,
        confirmPay,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
