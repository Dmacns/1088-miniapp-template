// GDCL WebSocket 通信封装
import Taro from '@tarojs/taro';
import type { GdclMessage, GdclCmd } from '@/types/gdcl';

const DEFAULT_SEED = 'wss://ws.dmacns.com';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // 指数退避

type MessageHandler = (msg: GdclMessage) => void;

// 检测是否为小程序环境（H5预览环境不支持 SocketTask 回调）
function isMiniProgram(): boolean {
  return Taro.getEnv() === Taro.ENV_TYPE.WEAPP
    || Taro.getEnv() === Taro.ENV_TYPE.ALIPAY
    || Taro.getEnv() === Taro.ENV_TYPE.TT;
}

class GdclService {
  private socketTask: Taro.SocketTask | null = null;
  private nativeWs: WebSocket | null = null; // H5环境用原生WebSocket
  private seedUrl: string = DEFAULT_SEED;
  private reconnectIndex = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<GdclCmd, MessageHandler[]> = new Map();
  private pendingMessages: GdclMessage[] = [];
  private connected = false;
  private ready = false;  // 处理器就绪标记
  private intentionalClose = false;  // 主动关闭标记，阻止自动重连

  // 初始化
  async init(): Promise<void> {
    try {
      const seedConfig = Taro.getStorageSync('seed_config');
      if (seedConfig) {
        this.seedUrl = seedConfig.url || DEFAULT_SEED;
      }
    } catch (e) {
    }
    this.connect();
  }

  // 标记处理器已就绪（store 注册完 handler 后调用）
  markReady(): void {
    this.ready = true;
    console.info('[GDCL] 处理器就绪，发送暂存消息');
    this.flushPendingMessages();
  }

  // 连接Seed节点
  connect(): void {
    if (this.socketTask || this.nativeWs) {
      this.close();
    }

    this.intentionalClose = false;
    console.info('[GDCL] 正在连接:', this.seedUrl, '环境:', Taro.getEnv());

    if (isMiniProgram()) {
      this.connectMiniProgram();
    } else {
      this.connectH5();
    }
  }

  // 小程序环境连接
  private connectMiniProgram(): void {
    let url = this.seedUrl;

    // 读取开发者模式
    let devMode = false;
    try {
      devMode = Taro.getStorageSync('devMode') === 'true';
    } catch (e) {}

    // 开发模式：通过本地代理连接（绕过 ws:// 限制）
    if (devMode) {
      let proxy = 'ws://127.0.0.1:8765';
      try {
        const saved = Taro.getStorageSync('proxy_address');
        if (saved) proxy = saved;
      } catch (e) {}
      url = proxy;
      console.info('[GDCL] 🔧 开发者模式，通过代理连接:', url);
    } else {
      // 正式模式：尝试升级到 wss://
      if (url.startsWith('ws://')) {
        url = url.replace('ws://', 'wss://');
      }
      console.info('[GDCL] 正式模式，安全连接:', url);
    }

    // 微信小程序：直接使用原生 wx API（绕过 Taro v4 SocketTask 兼容问题）
    // @ts-ignore
    const wxApi: any = typeof wx !== 'undefined' ? wx : null;
    if (wxApi?.connectSocket) {
      console.info('[GDCL] 使用原生 wx.connectSocket:', url);
      // 清理旧监听器，防止重连时重复触发
      wxApi.offSocketOpen(() => {});
      wxApi.offSocketMessage(() => {});
      wxApi.offSocketClose(() => {});
      wxApi.offSocketError(() => {});
      wxApi.onSocketOpen(() => {
         console.info('[GDCL:wx] 连接已建立');
         this.connected = true;
         this.reconnectIndex = 0;
         // 先注册节点身份，Seed 才能识别
         this.sendRegister();
         // store 注册处理器后调 markReady() 才冲洗暂存消息
         if (this.ready) {
           this.flushPendingMessages();
         }
       });
      wxApi.onSocketMessage((res: any) => {
        console.info('[GDCL:wx] 收到消息');
        try {
          const msg: GdclMessage = JSON.parse(res.data as string);
          this.dispatch(msg);
        } catch (err) {
          console.error('[GDCL:wx] 消息解析失败:', err);
        }
      });
      wxApi.onSocketClose(() => {
        console.info('[GDCL:wx] 连接已关闭');
        this.connected = false;
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      });
      wxApi.onSocketError((err: any) => {
        console.error('[GDCL:wx] 连接错误:', err);
        this.connected = false;
      });
      wxApi.connectSocket({ url });
      return;
    }

    // Fallback: Taro 全局监听（非微信环境）
    console.info('[GDCL] 使用 Taro.connectSocket:', url);
    Taro.onSocketOpen(() => {
      console.info('[GDCL:taro] 连接已建立');
      this.connected = true;
      this.reconnectIndex = 0;
      this.sendRegister();
      this.flushPendingMessages();
    });
    Taro.onSocketMessage((res) => {
      console.info('[GDCL:taro] 收到消息');
      try {
        const msg: GdclMessage = JSON.parse(res.data as string);
        this.dispatch(msg);
      } catch (err) {
        console.error('[GDCL:taro] 消息解析失败:', err);
      }
    });
    Taro.onSocketClose(() => {
      console.info('[GDCL:taro] 连接已关闭');
      this.connected = false;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });
    Taro.onSocketError((err) => {
      console.error('[GDCL:taro] 连接错误:', err);
      this.connected = false;
    });
    this.socketTask = Taro.connectSocket({
      url,
      success: () => { console.info('[GDCL:taro] 连接请求已发送'); },
      fail: (err) => {
        console.error('[GDCL:taro] 连接失败:', err);
        this.socketTask = null;
        this.scheduleReconnect();
      }
    }) as any;
  }

  // 发送 REGISTER 注册节点身份（Seed 要求连接后必须先注册）
  private sendRegister(): void {
    try {
      const raw = Taro.getStorageSync('did_identity');
      if (raw) {
        const { did } = JSON.parse(raw);
        this.send({ cmd: 'REGISTER', payload: { node_id: did } });
        console.info('[GDCL] 已发送 REGISTER, node_id:', did);
      } else {
        console.warn('[GDCL] 未找到 DID，跳过 REGISTER');
      }
    } catch (e) {
      console.error('[GDCL] REGISTER 发送失败:', e);
    }
  }

  // H5 环境不连接 GDCL：静默跳过，UI 层使用本地 mock 数据
  private connectH5(): void {
    // H5 预览无 GDCL 后端，保持 disconnected 状态
  }

  // 关闭连接
  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // @ts-ignore
    const wxApi: any = typeof wx !== 'undefined' ? wx : null;
    if (wxApi?.closeSocket) {
      try { wxApi.closeSocket(); } catch (e) {}
    }
    if (this.socketTask) {
      try { this.socketTask.close({}); } catch (e) {}
      this.socketTask = null;
    }
    if (this.nativeWs) {
      try { this.nativeWs.close(); } catch (e) {}
      this.nativeWs = null;
    }
    this.connected = false;
    this.ready = false;
  }

  // 指数退避重连（最多10次）
  private scheduleReconnect(): void {
    if (this.reconnectIndex >= 10) {
      console.error('[GDCL] 已达最大重连次数，停止重连');
      return;
    }
    const delay = RECONNECT_DELAYS[this.reconnectIndex] || 30000;
    this.reconnectIndex++;
    console.info(`[GDCL] ${delay}ms 后重连 (第${this.reconnectIndex}次)`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // 发送消息
  send(msg: GdclMessage): void {
    const data = JSON.stringify(msg);
    console.info('[GDCL:send]', msg.cmd, JSON.stringify(msg.payload || {}).slice(0, 100));
    if (this.connected) {
      // @ts-ignore
      const wxApi: any = typeof wx !== 'undefined' ? wx : null;
      if (wxApi?.sendSocketMessage) {
        wxApi.sendSocketMessage({ data, fail: (err: any) => {
          console.error('[GDCL:wx] 发送失败:', err);
          this.pendingMessages.push(msg);
        }});
      } else if (this.socketTask && typeof this.socketTask.send === 'function') {
        this.socketTask.send({
          data,
          fail: (err) => {
            console.error('[GDCL:taro] 发送失败:', err);
            this.pendingMessages.push(msg);
          }
        });
      } else if (this.nativeWs && this.nativeWs.readyState === WebSocket.OPEN) {
        this.nativeWs.send(data);
      } else {
        console.error('[GDCL] 无可用传输通道，丢弃消息:', msg.cmd);
      }
    } else {
      console.info('[GDCL] 离线暂存消息:', msg.cmd);
      this.pendingMessages.push(msg);
    }
  }

  // 发送暂存队列
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift()!;
      this.send(msg);
    }
  }

  // 注册消息处理器
  on(cmd: GdclCmd, handler: MessageHandler): void {
    if (!this.handlers.has(cmd)) {
      this.handlers.set(cmd, []);
    }
    this.handlers.get(cmd)!.push(handler);
    console.info('[GDCL:on] 注册处理器:', cmd, `(共${this.handlers.get(cmd)!.length}个)`);
  }

  // 注销消息处理器
  off(cmd: GdclCmd, handler: MessageHandler): void {
    const list = this.handlers.get(cmd);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) {
        list.splice(idx, 1);
        console.info('[GDCL:off] 注销处理器:', cmd, `(剩余${list.length}个)`);
      }
    }
  }

  // 分发消息
  private dispatch(msg: GdclMessage): void {
    console.info('[GDCL:dispatch]', msg.cmd, JSON.stringify(msg.payload || {}).slice(0, 150));
    const list = this.handlers.get(msg.cmd);
    if (list) {
      list.forEach((handler) => handler(msg));
    } else {
      console.info('[GDCL:dispatch] 未注册的 cmd:', msg.cmd);
    }
  }

  // 检查链状态
  checkChainStatus(): void {
    this.send({ cmd: 'CHAIN_STATUS' });
  }

  // 切换Seed节点
  async switchSeed(url: string): Promise<void> {
    this.seedUrl = url;
    try {
      Taro.setStorageSync('seed_config', { url });
    } catch (e) {}
    this.close();
    this.reconnectIndex = 0;
    this.connect();
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.connected;
  }

  // 获取当前Seed URL
  getSeedUrl(): string {
    return this.seedUrl;
  }
}

// 单例
export const gdclService = new GdclService();
