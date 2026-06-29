/**
 * WebSocket TCP 代理
 * 将本地 127.0.0.1:8765 的流量透明转发到远端 ws://43.139.194.155:9001
 * 解决微信小程序不支持 ws:// 直连的问题
 *
 * 用法: node scripts/ws-proxy.js
 */
const net = require('net');

const LOCAL_PORT = 8765;
const TARGET_HOST = '43.139.194.155';
const TARGET_PORT = 9001;

let connections = 0;

const server = net.createServer((client) => {
  const id = ++connections;
  console.log(`[代理] #${id} 新连接`);

  const target = net.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[代理] #${id} 已连接到 ${TARGET_HOST}:${TARGET_PORT}`);

    // 双向透传
    client.pipe(target);
    target.pipe(client);
  });

  target.on('error', (err) => {
    console.error(`[代理] #${id} 目标连接失败: ${err.message}`);
    client.destroy();
  });

  client.on('error', (err) => {
    console.error(`[代理] #${id} 客户端错误: ${err.message}`);
    target.destroy();
  });

  client.on('close', () => {
    console.log(`[代理] #${id} 客户端断开`);
    target.destroy();
  });

  target.on('close', () => {
    console.log(`[代理] #${id} 目标断开`);
    client.destroy();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[代理] 端口 ${LOCAL_PORT} 已被占用，请先关闭其他进程`);
  } else {
    console.error(`[代理] 启动失败:`, err.message);
  }
  process.exit(1);
});

server.listen(LOCAL_PORT, '0.0.0.0', () => {
  // 获取本机局域网IP
  const nets = require('os').networkInterfaces();
  let lanIp = '127.0.0.1';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp !== '127.0.0.1') break;
  }

  console.log('═══════════════════════════════════════════');
  console.log(`  WebSocket 代理已启动`);
  console.log(`  模拟器: ws://127.0.0.1:${LOCAL_PORT}`);
  console.log(`  真机:   ws://${lanIp}:${LOCAL_PORT}`);
  console.log(`  远端:   ws://${TARGET_HOST}:${TARGET_PORT}`);
  console.log('═══════════════════════════════════════════');
  console.log('  按 Ctrl+C 停止');
});
