#!/usr/bin/env python3
"""小程序 ↔ 1088 P2P交易测试"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
MINI_BUYER = f'did:mini:buyer_{int(time.time())%10000}'
A_SALE = 'did:user:a_sale'  # 1088卖家DID

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
    print('小程序(买家) ↔ 1088(a_sale卖家) P2P交易测试')
    print('='*60)
    
    mini = Node('小程序买家', MINI_BUYER)
    seller = Node('1088卖家', A_SALE)
    await asyncio.gather(mini.connect(), seller.connect())
    
    # 1. 小程序搜索1088商品
    print('\n--- 搜索 ---')
    await mini.send('DISCOVER', {'product': '1088'})
    msg = await mini.recv_cmd('DISCOVER_RESULT')
    sellers = msg.get('sellers', []) if msg else []
    ok('搜到1088商品', any(s.get('node_id')==A_SALE for s in sellers),
       f"找到{len(sellers)}个卖家" if sellers else '无结果')
    
    # 2. 小程序下单
    print('\n--- 下单 ---')
    order_id = f'mini1088_{int(time.time())}'
    await mini.send('PROPOSE', {
        'order_id': order_id, 'buyer_did': MINI_BUYER, 'seller_did': A_SALE,
        'product': '1088特供·烟台大樱桃', 'quantity': 20, 'price': 30, 'total': 600
    })
    msg = await seller.recv_cmd('PROPOSE', timeout=15)
    ok('1088收到订单', msg is not None, order_id if msg else 'timeout')
    
    if not msg:
        print('1088未收到订单，测试终止')
        return
    
    # 3. 1088接单+发货
    print('\n--- 接单发货 ---')
    await seller.send('ACCEPT', {
        'target': MINI_BUYER, 'order_id': order_id,
        'buyer_did': MINI_BUYER, 'seller_did': A_SALE
    })
    await asyncio.sleep(0.3)
    await seller.send('SHIP_NOTIFY', {
        'target': MINI_BUYER, 'order_id': order_id,
        'tracking_no': '1088SF001', 'buyer_did': MINI_BUYER, 'seller_did': A_SALE
    })
    ok('1088接单发货', True)
    
    msg = await mini.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=15)
    ok('小程序收到接单/发货', msg is not None, msg['cmd'] if msg else 'timeout')
    msg2 = await mini.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=5)
    if msg2: ok('小程序收到第二条通知', True, msg2['cmd'])
    
    # 4. 小程序确认收货
    print('\n--- 确认收货 ---')
    await mini.send('CONFIRM_RECEIPT', {
        'target': A_SALE, 'order_id': order_id,
        'buyer_did': MINI_BUYER, 'seller_did': A_SALE
    })
    ok('小程序确认收货', True)
    msg = await seller.recv_cmd('CONFIRM_RECEIPT', timeout=10)
    ok('1088收到确认', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 5. 小程序评价
    print('\n--- 评价 ---')
    await mini.send('REVIEW_PROPOSE', {
        'review_id': f'rev1088_{int(time.time())}', 'order_id': order_id,
        'reviewer_did': MINI_BUYER, 'seller_did': A_SALE, 'rating': 5, 'content': '1088品质好'
    })
    msg = await seller.recv_cmd('REVIEW_PROPOSE', timeout=10)
    ok('1088收到评价', msg is not None, msg['cmd'] if msg else 'timeout')
    
    # 汇总
    print('\n' + '='*60)
    passed = sum(1 for _,c,_ in results if c)
    print(f'小程序↔1088 P2P交易: {passed}/{len(results)} 通过')
    for n, c, d in results:
        icon = "OK" if c else "FAIL"
        print(f'  {icon} {n} {d}')

asyncio.run(main())
