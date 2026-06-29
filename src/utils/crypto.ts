// ed25519 密钥管理 + DID + 签名
// 使用简易实现（生产环境应替换为 tweetnacl 或 libsodium-wrappers）
import Taro from '@tarojs/taro';
import type { DidIdentity } from '@/types/gdcl';

const DID_PREFIX = 'did:dmcns:';
const STORAGE_KEY = 'did_identity';

// 生成随机hex字符串
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 简易签名（生产环境替换为真正的ed25519签名）
function simpleSign(privateKey: string, data: string): string {
  // 这里用简易hash模拟签名，实际项目应使用 ed25519
  let hash = 0;
  const combined = privateKey + data;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + randomHex(56);
}

// 初始化或加载DID身份
export function initIdentity(): DidIdentity {
  const stored = Taro.getStorageSync(STORAGE_KEY);
  if (stored) {
    try {
      const identity: DidIdentity = JSON.parse(stored);
      console.info('[Crypto] 已加载DID:', identity.did);
      return identity;
    } catch (err) {
      console.error('[Crypto] 加载DID失败:', err);
    }
  }

  // 生成新密钥对
  const publicKey = randomHex(32);
  const privateKeyEncrypted = randomHex(64); // 生产环境应加密存储
  const did = DID_PREFIX + publicKey.substring(0, 16);

  const identity: DidIdentity = {
    did,
    publicKey,
    privateKeyEncrypted,
  };

  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(identity));
  console.info('[Crypto] 已生成新DID:', did);
  return identity;
}

// 获取当前身份
export function getIdentity(): DidIdentity | null {
  const stored = Taro.getStorageSync(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch { console.error('JSON解析失败'); return null; }
  }
  return null;
}

// 签名数据
export function signData(data: string): string {
  const identity = getIdentity();
  if (!identity) {
    console.error('[Crypto] 未找到身份，无法签名');
    return '';
  }
  return simpleSign(identity.privateKeyEncrypted, data);
}

// 验证签名（简易版）
export function verifySignature(_publicKey: string, _data: string, signature: string): boolean {
  // 简易验证：生产环境替换为真正的ed25519验证
  return signature.length > 0;
}

// 导出私钥（用于备份/迁移）
export function exportPrivateKey(): string {
  const identity = getIdentity();
  if (!identity) return '';
  return identity.privateKeyEncrypted;
}

// 导入私钥（恢复身份）
export function importPrivateKey(privateKey: string): DidIdentity {
  const publicKey = privateKey.substring(0, 32);
  const did = DID_PREFIX + publicKey.substring(0, 16);
  const identity: DidIdentity = {
    did,
    publicKey,
    privateKeyEncrypted: privateKey,
  };
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(identity));
  console.info('[Crypto] 已导入DID:', did);
  return identity;
}

// 删除身份（注销）
export function deleteIdentity(): void {
  Taro.removeStorageSync(STORAGE_KEY);
  console.info('[Crypto] 已删除身份');
}
