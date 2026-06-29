#!/usr/bin/env python3
"""小程序完整端到端测试 v3 — 正确处理消息顺序"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
BUYER = f'did:test:buyer_{int(time.time())%10000}'
SELLER = f'did:test:seller_{int(time.time())%10000}'
results = []

def ok(name, cond, detail=''):
    results.append((name, cond, detail))
    print(f"  {'✅' if cond else '❌'} {name} {detail}")

class Node:
    def __init__(self, name, did):
        self.name = name
        self.did = did
        self.ws = None
        self.queue = asyncio.Queue()
    
    async def connect(self):
        self.ws = await websockets.connect(WS)
        # 先启动接收协程
        asyncio.create_task(self._recv_loop())
        await asyncio.sleep(0.05)
        # 再注册
        await self.send('REGISTER', {'node_id': self.did})
        msg = await self.recv()
        ok(f'{self.name}注册', msg['cmd']=='WELCOME', f"peers={msg.get('payload',{}).get('peers')}")
    
    async def _recv_loop(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                await self.queue.put(msg)
        except: pass
    
    async def send(self, cmd, payload):
        await self.ws.send(json.dumps({'cmd': cmd, 'payload': payload}))
    
    async def recv(self, timeout=10):
        return await asyncio.wait_for(self.queue.get(), timeout)
    
    async def recv_cmd(self, *cmds, timeout=10):
        """接收指定cmd之一的消息，忽略其他"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            remaining = deadline - time.time()
            if remaining <= 0: break
            try:
                msg = await asyncio.wait_for(self.queue.get(), remaining)
                if msg['cmd'] in cmds:
                    return msg
                # 忽略不匹配的消息（如PROPOSAL_ACK）
            except asyncio.TimeoutError:
                break
        return None


async def test():
    print('='*50)
    print('小程序完整端到端测试 v3')
    print('='*50)
    
    buyer = Node('买家', BUYER)
    seller = Node('卖家', SELLER)
    await asyncio.gather(buyer.connect(), seller.connect())
    
    # 1. 发布商品
    print('\n--- 商品发布 ---')
    await seller.send('PUBLISH', {
        'node_id': SELLER, 'product': '烟台大樱桃', 'price_min': 20, 'price_max': 50,
        'location': '山东烟台', 'category': '斤', 'stock': 500, 'description': '当日采摘', 'tags': []
    })
    msg = await seller.recv_cmd('PUBLISH_ACK', 'ERROR')
    ok('发布商品', msg and msg['cmd']=='PUBLISH_ACK', msg.get('payload',{}).get('status','') if msg else 'timeout')
    
    # 2. 搜索
    print('\n--- 搜索 ---')
    await buyer.send('DISCOVER', {'product': '樱桃'})
    msg = await buyer.recv_cmd('DISCOVER_RESULT')
    sellers = msg.get('sellers', []) if msg else []
    ok('搜索商品', len(sellers)>0, f'找到{len(sellers)}个卖家' if sellers else '无结果')
    
    # 3. 下单
    print('\n--- 下单 ---')
    order_id = f'order_{int(time.time())}'
    await buyer.send('PROPOSE', {
        'order_id': order_id, 'buyer_did': BUYER, 'seller_did': SELLER,
        'product': '烟台大樱桃', 'quantity': 10, 'price': 25, 'total': 250
    })
    # 买家会收到PROPOSAL_ACK，忽略
    msg = await seller.recv_cmd('PROPOSE')
    ok('卖家收到订单', msg is not None, order_id if msg else 'timeout')
    
    # 4. 接单+发货
    print('\n--- 接单发货 ---')
    await seller.send('ACCEPT', {'order_id': order_id, 'buyer_did': BUYER, 'seller_did': SELLER})
    await asyncio.sleep(0.3)
    await seller.send('SHIP_NOTIFY', {'order_id': order_id, 'tracking_no': 'SF99887766', 'buyer_did': BUYER, 'seller_did': SELLER})
    ok('接单发货已发送', True)
    
    msg = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=15)
    ok('买家收到接单/发货', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 收第二个消息
    msg2 = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=5)
    if msg2:
        ok('买家收到第二个通知', True, msg2['cmd'])
    
    # 5. 确认收货
    print('\n--- 确认收货 ---')
    await buyer.send('CONFIRM_RECEIPT', {'order_id': order_id, 'buyer_did': BUYER, 'seller_did': SELLER})
    await buyer.send('EXECUTE', {'order_id': order_id, 'buyer_did': BUYER, 'seller_did': SELLER, 'tx_hash': '0xmock123'})
    ok('确认收货已发送', True)
    
    msg = await seller.recv_cmd('CONFIRM_RECEIPT', 'EXECUTE', timeout=10)
    ok('卖家收到确认', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 6. 评价
    print('\n--- 评价 ---')
    await buyer.send('REVIEW', {
        'review_id': f'rev_{int(time.time())}', 'order_id': order_id,
        'reviewer_did': BUYER, 'seller_did': SELLER, 'rating': 5, 'content': '好'
    })
    msg = await seller.recv_cmd('REVIEW', timeout=10)
    ok('卖家收到评价', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 7. 争议
    print('\n--- 争议 ---')
    dispute_id = f'disp_{int(time.time())}'
    await buyer.send('DISPUTE', {
        'dispute_id': dispute_id, 'order_id': order_id,
        'buyer_did': BUYER, 'seller_did': SELLER,
        'reason': '测试争议', 'description': '测试', 'status': 'open'
    })
    msg = await seller.recv_cmd('DISPUTE', timeout=10)
    ok('卖家收到争议', msg is not None, msg['cmd'] if msg else 'timeout')
    
    await seller.send('DISPUTE_UPDATE', {
        'dispute_id': dispute_id, 'order_id': order_id,
        'buyer_did': BUYER, 'seller_did': SELLER,
        'status': 'resolved', 'ruling': '卖家接受'
    })
    msg = await buyer.recv_cmd('DISPUTE_UPDATE', timeout=10)
    ok('买家收到争议处理', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 结果
    print('\n' + '='*50)
    passed = sum(1 for _,c,_ in results if c)
    print(f'结果: {passed}/{len(results)} 通过')
    for n, c, d in results:
        print(f'  {"✅" if c else "❌"} {n} {d}')
    
    # 关闭连接
    await buyer.ws.close()
    await seller.ws.close()

asyncio.run(test())
