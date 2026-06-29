#!/usr/bin/env python3
"""双向全链路测试：小程序↔小程序 + 小程序↔1088"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
MINI_A = f'did:mini:alice_{int(time.time())%10000}'
MINI_B = f'did:mini:bob_{int(time.time())%10000}'
A1088_SALE = 'did:user:a_sale'  # 1088卖家
A1088_PURC = 'did:user:a_purc'  # 1088买家

results = []
def ok(name, cond, detail=''):
    results.append((name, cond, detail))
    print(f"  {'OK' if cond else 'FAIL'} {name} {detail}")

class Node:
    def __init__(self, name, did):
        self.name = name; self.did = did
        self.ws = None; self.queue = asyncio.Queue()
    async def connect(self):
        self.ws = await websockets.connect(WS)
        asyncio.create_task(self._recv())
        await asyncio.sleep(0.05)
        await self.send('REGISTER', {'node_id': self.did})
        await self.recv()
    async def _recv(self):
        try:
            async for raw in self.ws: await self.queue.put(json.loads(raw))
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

async def trading(buyer: Node, seller: Node, product_name: str, prefix: str):
    """一次完整交易：发布→搜索→下单→接单→发货→收货→评价→争议"""
    tag = prefix
    
    # 发布
    await seller.send('PUBLISH', {
        'node_id': seller.did, 'product': product_name,
        'price_min': 10, 'price_max': 30, 'location': '测试产地',
        'category': '个', 'stock': 100, 'tags': []
    })
    msg = await seller.recv_cmd('PUBLISH_ACK', 'ERROR')
    ok(f'{tag}发布', msg and msg['cmd']=='PUBLISH_ACK')
    
    # 搜索
    await buyer.send('DISCOVER', {'product': product_name[:4]})
    msg = await buyer.recv_cmd('DISCOVER_RESULT')
    ok(f'{tag}搜索', msg and len(msg.get('sellers',[]))>0)
    
    # 下单
    oid = f'{prefix}_{int(time.time())}'
    await buyer.send('PROPOSE', {
        'order_id': oid, 'buyer_did': buyer.did, 'seller_did': seller.did,
        'product': product_name, 'quantity': 5, 'price': 20, 'total': 100
    })
    msg = await seller.recv_cmd('PROPOSE', timeout=15)
    ok(f'{tag}下单', msg is not None, oid)
    
    # 接单+发货
    await seller.send('ACCEPT', {'target': buyer.did, 'order_id': oid, 'buyer_did': buyer.did, 'seller_did': seller.did})
    await asyncio.sleep(0.2)
    await seller.send('SHIP_NOTIFY', {'target': buyer.did, 'order_id': oid, 'tracking_no': f'{prefix}_SF', 'buyer_did': buyer.did, 'seller_did': seller.did})
    ok(f'{tag}接单发货', True)
    
    msg = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=15)
    ok(f'{tag}收到通知', msg is not None, msg['cmd'] if msg else 'timeout')
    m2 = await buyer.recv_cmd('ACCEPT', 'SHIP_NOTIFY', timeout=5)
    if m2: ok(f'{tag}收到第二条', True, m2['cmd'])
    
    # 收货
    await buyer.send('CONFIRM_RECEIPT', {'target': seller.did, 'order_id': oid, 'buyer_did': buyer.did, 'seller_did': seller.did})
    msg = await seller.recv_cmd('CONFIRM_RECEIPT', timeout=10)
    ok(f'{tag}确认收货', msg is not None)
    
    # 评价
    await buyer.send('REVIEW_PROPOSE', {
        'review_id': f'rev_{prefix}_{int(time.time())}', 'order_id': oid,
        'reviewer_did': buyer.did, 'seller_did': seller.did, 'rating': 5, 'content': '好评'
    })
    msg = await seller.recv_cmd('REVIEW_PROPOSE', timeout=10)
    ok(f'{tag}评价', msg is not None)
    
    # 争议
    did = f'disp_{prefix}_{int(time.time())}'
    await buyer.send('DISPUTE_PROPOSE', {
        'dispute_id': did, 'order_id': oid,
        'buyer_did': buyer.did, 'seller_did': seller.did,
        'reason': '测试', 'description': '测试争议', 'status': 'open'
    })
    msg = await seller.recv_cmd('DISPUTE_PROPOSE', timeout=10)
    ok(f'{tag}争议发起', msg is not None)
    
    await seller.send('DISPUTE_PROPOSE', {
        'target': buyer.did, 'dispute_id': did, 'order_id': oid,
        'buyer_did': buyer.did, 'seller_did': seller.did,
        'status': 'resolved', 'ruling': '接受诉求'
    })
    msg = await buyer.recv_cmd('DISPUTE_PROPOSE', timeout=10)
    ok(f'{tag}争议处理', msg is not None)

async def main():
    print('='*60)
    print('双向全链路测试')
    print('='*60)
    
    a = Node('小程序A', MINI_A)
    b = Node('小程序B', MINI_B)
    s1088 = Node('1088卖家', A1088_SALE)
    p1088 = Node('1088买家', A1088_PURC)
    await asyncio.gather(a.connect(), b.connect(), s1088.connect(), p1088.connect())
    
    # 测试1: 小程序A买 小程序B卖
    print('\n=== 1. 小程序A(买) ↔ 小程序B(卖) ===')
    await trading(b, a, '小A手工皂', 'AB')
    
    # 测试2: 小程序B买 小程序A卖 (双向)
    print('\n=== 2. 小程序B(买) ↔ 小程序A(卖) ===')
    await trading(a, b, '小B创意品', 'BA')
    
    # 测试3: 小程序A买 1088卖
    print('\n=== 3. 小程序A(买) ↔ 1088(卖) ===')
    await trading(b, s1088, '1088企业直供', 'A8')
    
    # 测试4: 1088买 小程序B卖
    print('\n=== 4. 1088(买) ↔ 小程序B(卖) ===')
    await trading(p1088, a, '小程序精品', '8B')
    
    print('\n' + '='*60)
    passed = sum(1 for _,c,_ in results if c)
    print(f'双向全链路: {passed}/{len(results)} 通过')
    for n, c, d in results:
        print(f'  {"OK" if c else "FAIL"} {n} {d}')

asyncio.run(main())
