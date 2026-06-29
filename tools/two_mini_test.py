#!/usr/bin/env python3
"""两个小程序P2P直接交易测试"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
MINI_A = f'did:mini:alice_{int(time.time())%10000}'
MINI_B = f'did:mini:bob_{int(time.time())%10000}'

results = []
def ok(name, cond, detail=''):
    results.append((name, cond, detail))
    icon = "OK" if cond else "FAIL"
    print(f"  {icon} {name} {detail}")

class Node:
    def __init__(self, name, did):
        self.name = name
        self.did = did
        self.ws = None
        self.queue = asyncio.Queue()
    
    async def connect(self):
        self.ws = await websockets.connect(WS)
        asyncio.create_task(self._recv_loop())
        await asyncio.sleep(0.05)
        await self.send('REGISTER', {'node_id': self.did})
        msg = await self.recv()
        ok(f'{self.name}注册', msg['cmd']=='WELCOME', f"peers={msg.get('payload',{}).get('peers')}")
    
    async def _recv_loop(self):
        try:
            async for raw in self.ws:
                await self.queue.put(json.loads(raw))
        except: pass
    
    async def send(self, cmd, payload):
        await self.ws.send(json.dumps({'cmd': cmd, 'payload': payload}))
    
    async def recv(self, timeout=10):
        return await asyncio.wait_for(self.queue.get(), timeout)
    
    async def recv_cmd(self, *cmds, timeout=10):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                msg = await asyncio.wait_for(self.queue.get(), deadline - time.time())
                if msg['cmd'] in cmds: return msg
            except: break
        return None

async def main():
    print('='*60)
    print('两个小程序 P2P直接交易')
    print('='*60)
    
    seller = Node('小程序A(卖家)', MINI_A)
    buyer = Node('小程序B(买家)', MINI_B)
    await asyncio.gather(seller.connect(), buyer.connect())
    
    # 1. A发布商品
    print('\n--- A发布商品 ---')
    await seller.send('PUBLISH', {
        'node_id': MINI_A, 'product': '小A手作·手工皂',
        'price_min': 15, 'price_max': 30, 'location': '山东青岛',
        'category': '个', 'stock': 100, 'description': '天然精油手工皂', 'tags': ['手工']
    })
    msg = await seller.recv_cmd('PUBLISH_ACK', 'ERROR')
    ok('A发布商品', msg and msg['cmd']=='PUBLISH_ACK', msg.get('payload',{}).get('status','') if msg else 'timeout')
    
    # 2. B搜索
    print('\n--- B搜索商品 ---')
    await buyer.send('DISCOVER', {'product': '手工皂'})
    msg = await buyer.recv_cmd('DISCOVER_RESULT')
    sellers = msg.get('sellers', []) if msg else []
    ok('B搜到商品', any(s.get('node_id')==MINI_A for s in sellers),
       f"找到{len(sellers)}个卖家" if sellers else '无结果')
    
    # 3. B下单 (用PROPOSE，走通用路由)
    print('\n--- B下单 ---')
    order_id = f'mini_p2p_{int(time.time())}'
    await buyer.send('PROPOSE', {
        'order_id': order_id, 'buyer_did': MINI_B, 'seller_did': MINI_A,
        'product': '小A手作·手工皂', 'quantity': 5, 'price': 20, 'total': 100
    })
    msg = await seller.recv_cmd('PROPOSE', timeout=15)
    ok('A收到订单', msg is not None, order_id if msg else 'timeout')
    
    # 4. A接单+发货
    print('\n--- A接单发货 ---')
    await seller.send('ACCEPT', {
        'target': MINI_B, 'order_id': order_id, 'buyer_did': MINI_B, 'seller_did': MINI_A
    })
    await asyncio.sleep(0.3)
    await seller.send('SHIP_NOTIFY', {
        'target': MINI_B, 'order_id': order_id, 'tracking_no': 'MINI_SF001',
        'buyer_did': MINI_B, 'seller_did': MINI_A
    })
    ok('A接单发货', True)
    
    msg = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=15)
    ok('B收到接单/发货', msg is not None, msg['cmd'] if msg else 'timeout')
    msg2 = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=5)
    if msg2: ok('B收到第二条通知', True, msg2['cmd'])
    
    # 5. B确认收货
    print('\n--- B确认收货 ---')
    await buyer.send('CONFIRM_RECEIPT', {
        'target': MINI_A, 'order_id': order_id, 'buyer_did': MINI_B, 'seller_did': MINI_A
    })
    ok('B确认收货', True)
    msg = await seller.recv_cmd('CONFIRM_RECEIPT', timeout=10)
    ok('A收到确认', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 6. B评价 (用REVIEW_PROPOSE, ws_proxy特定处理)
    print('\n--- B评价 ---')
    await buyer.send('REVIEW_PROPOSE', {
        'review_id': f'rev_mini_{int(time.time())}', 'order_id': order_id,
        'reviewer_did': MINI_B, 'seller_did': MINI_A, 'rating': 5, 'content': '好用的手工皂!'
    })
    msg = await seller.recv_cmd('REVIEW_PROPOSE', timeout=10)
    ok('A收到评价', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 7. B发起争议 (用DISPUTE_PROPOSE)
    print('\n--- B发起争议 ---')
    dispute_id = f'disp_mini_{int(time.time())}'
    await buyer.send('DISPUTE_PROPOSE', {
        'dispute_id': dispute_id, 'order_id': order_id,
        'buyer_did': MINI_B, 'seller_did': MINI_A,
        'reason': '测试争议', 'description': '包装破损', 'status': 'open'
    })
    msg = await seller.recv_cmd('DISPUTE_PROPOSE', timeout=10)
    ok('A收到争议', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 8. A处理争议 (用DISPUTE_PROPOSE, 带target)
    print('\n--- A处理争议 ---')
    await seller.send('DISPUTE_PROPOSE', {
        'target': MINI_B, 'dispute_id': dispute_id, 'order_id': order_id,
        'buyer_did': MINI_B, 'seller_did': MINI_A,
        'status': 'resolved', 'ruling': '卖家接受诉求'
    })
    msg = await buyer.recv_cmd('DISPUTE_PROPOSE', timeout=10)
    ok('B收到争议处理', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 汇总
    print('\n' + '='*60)
    passed = sum(1 for _,c,_ in results if c)
    print(f'两个小程序P2P交易: {passed}/{len(results)} 通过')
    for n, c, d in results:
        icon = "OK" if c else "FAIL"
        print(f'  {icon} {n} {d}')
    
    await seller.ws.close()
    await buyer.ws.close()

asyncio.run(main())
