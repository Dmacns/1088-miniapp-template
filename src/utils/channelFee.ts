// 通道费计算 — 统一0.5%
export function calcChannelFee(amount: number): number {
  return Math.round(amount * 0.005 * 100) / 100;
}

export function feeLabel(_amount: number): string {
  return '0.5%';
}
