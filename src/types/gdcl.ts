// GDCL 协议类型定义

// GDCL 命令枚举
export type GdclCmd =
  | 'WELCOME'
  | 'DISCOVER'
  | 'DISCOVER_RESULT'
  | 'QUERY'
  | 'QUERY_RESULT'
  | 'PUBLISH'
  | 'PUBLISH_ACK'
  | 'PROPOSE'
  | 'PROPOSAL_ACK'
  | 'ACCEPT'
  | 'COMMIT'
  | 'COMMIT_ACK'
  | 'EXECUTE'
  | 'EXECUTE_ACK'
  | 'OFFLINE_RECEIPT'
  | 'CHAIN_STATUS'
  | 'PING'
  | 'PONG'
  | 'ERROR'
  | 'REGISTER'
  | 'ORDER'
  | 'ORDER_ACK'
  | 'NEGO'
  | 'NEGO_UPDATE'
  | 'NEGO_ACK'
  | 'DISPUTE'
  | 'DISPUTE_UPDATE'
  | 'DISPUTE_ACK'
  | 'REVIEW'
  | 'REVIEW_ACK'
  | 'CONFIRM_RECEIPT'
  | 'SHIP_NOTIFY'
  | 'SWITCH_SEED'
  | 'SETTLE';

// GDCL 协议帧
export interface GdclMessage {
  cmd: GdclCmd;
  payload?: Record<string, unknown>;
}

// 商品
export interface Product {
  sku: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  image: string;
  seller_did: string;
  seller_name: string;
  location: string;
  shippingOrigin: string;
  description: string;
  // GDCL 协议字段（DISCOVER_RESULT sellers）
  node_id?: string;        // = seller_did, GDCL seller唯一标识
  product?: string;        // GDCL 商品名，映射到 name
  price_min?: number;      // GDCL 最低价
  price_max?: number;      // GDCL 最高价
}

// 协商提案
export interface Proposal {
  proposal_id: string;
  sku: string;
  qty: number;
  price: number;
  buyer_did: string;
  buyer_sig: string;
  seller_did: string;
  status: 'pending' | 'accepted' | 'rejected' | 'committed' | 'executed';
  created_at: string;
}

// 订单
export interface Order {
  order_id: string;
  proposal_id: string;
  sku: string;
  product_name: string;
  qty: number;
  price: number;
  total: number;
  buyer_did: string;
  seller_did: string;
  status: 'pending' | 'accepted' | 'confirmed' | 'escrowed' | 'shipped' | 'received' | 'disputed';
  tx_hash?: string;
  tracking_no?: string;
  is_nego: boolean;
  created_at: string;
  updated_at: string;
}

// 离线收据
export interface OfflineReceipt {
  order_id: string;
  buyer_sig: string;
  seller_sig: string;
  amount: number;
  timestamp: string;
  synced_tx_hash?: string;
}

// 链状态
export interface ChainStatus {
  online: boolean;
  block_height?: number;
  last_checked: string;
}

// DID身份
export interface DidIdentity {
  did: string;
  publicKey: string;
  privateKeyEncrypted: string; // 加密存储的私钥
}

// Seed节点配置
export interface SeedConfig {
  url: string;
  name: string;
}

// 购物车商品
export interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  image: string;
  seller_did: string;
  seller_name: string;
  added_at: string;
}

// 争议
export interface Dispute {
  dispute_id: string;
  order_id: string;
  buyer_did: string;
  seller_did: string;
  reason: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'appealed';
  ruling?: string;
  refund_amount?: number;
  created_at: string;
  resolved_at?: string;
}

// 评价
export interface Review {
  review_id: string;
  order_id: string;
  reviewer_did: string;
  seller_did: string;
  rating: number;
  content: string;
  created_at: string;
}

// 客户
export interface Customer {
  id: string;
  name: string;
  phone: string;
  level: string;
  credit_limit: number;
  credit_used: number;
  created_at: string;
}

// 收货/发货地址
export interface ShippingAddress {
  id: string;
  label: string;
  contactName: string;
  contactPhone: string;
  province: string;
  city: string;
  district: string;
  town: string;
  detail: string;
  fullAddress: string;
}
