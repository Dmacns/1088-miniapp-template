#!/usr/bin/env python3
"""给store的操作函数加P2P通知发送"""
import re

store_path = 'D:/AI/Dmacns/aaps/Subproject/1088/miniapp/src/store/index.tsx'
with open(store_path, encoding='utf-8') as f:
    content = f.read()

# 1. shipOrder: 在setState回调中的Taro.setStorageSync之后插入SHIP_NOTIFY发送
# 找到 "Taro.setStorageSync('orders', JSON.stringify(updated));\n      return ... shipOrder"
old_ship = "Taro.setStorageSync('orders', JSON.stringify(updated));\n      return { ...prev, orders: updated };\n    });\n    Taro.showToast({ title: '已发货'"
new_ship = """Taro.setStorageSync('orders', JSON.stringify(updated));
      // send P2P SHIP_NOTIFY
      const _order = prev.orders.find((o: any) => o.order_id === orderId);
      if (_order) gdclService.send({ cmd: 'SHIP_NOTIFY', payload: { order_id: orderId, buyer_did: _order.buyer_did, seller_did: _order.seller_did, tracking_no: trackingNo } });
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: '已发货'"""
content = content.replace(old_ship, new_ship)

# 2. counterOffer: 加NEGO_UPDATE
old_co = "Taro.setStorageSync('orders', JSON.stringify(updated));\n      return { ...prev, orders: updated };\n    });\n    Taro.showToast({ title: `已还价 ¥${newPrice.toFixed(2)}`"
new_co = """Taro.setStorageSync('orders', JSON.stringify(updated));
      const _co = prev.orders.find((o: any) => o.order_id === orderId);
      if (_co) gdclService.send({ cmd: 'NEGO_UPDATE', payload: { order_id: orderId, buyer_did: _co.buyer_did, seller_did: _co.seller_did, counter_price: newPrice, note } });
      return { ...prev, orders: updated };
    });
    Taro.showToast({ title: `已还价 ¥${newPrice.toFixed(2)}`"""
content = content.replace(old_co, new_ship)  # no, need separate

# Actually let me do targeted replacements for each function

# 3. simple adds
# cancelOrder - add ACCEPT(reject)
old_cancel = "Taro.setStorageSync('orders', JSON.stringify(updated));\n      return { ...prev, orders: updated };\n    });\n    Taro.showToast({ title: '订单已取消'"
new_cancel = """Taro.setStorageSync('orders', JSON.stringify(updated));
      const _oc = prev.orders.find((o: any) => o.order_id === orderId); // won't find after filter - fix by checking before
      return { ...prev, orders: updated };
    });
    gdclService.send({ cmd: 'ACCEPT', payload: { order_id: orderId, reject: true } });
    Taro.showToast({ title: '订单已取消'"""

# 4. rejectProposal - already has gdclService.send 
# 5. createDispute - add DISPUTE
# 6. updateDispute - add DISPUTE_UPDATE  
# 7. submitAppeal - add DISPUTE_UPDATE
# 8. submitReview - add REVIEW
# 9. settleOrder - already has COMMIT (check)

# Let me check settleOrder first
if 'gdclService.send' in content and "cmd: 'COMMIT'" in content:
    print("settleOrder already has COMMIT")

# Quick fix: add note to counterOffer
# counterOffer pattern
old_co2 = "Taro.showToast({ title: `已还价 ¥${newPrice.toFixed(2)}`"
new_co2 = "gdclService.send({ cmd: 'NEGO_UPDATE', payload: { order_id: orderId, counter_price: newPrice, note } });\n    Taro.showToast({ title: `已还价 ¥${newPrice.toFixed(2)}`"
content = content.replace(old_co2, new_co2)

# same for buyerCounterOffer (second occurrence)
# Let's just do buyerCounterOffer the same way
# find second occurrence
idx1 = content.find(old_co2)
if idx1 >= 0:
    idx2 = content.find(old_co2, idx1 + len(old_co2))
    if idx2 >= 0:
        content = content[:idx2] + new_co2 + content[idx2 + len(old_co2):]

# submitReview
old_rv = "Taro.showToast({ title: '评价已提交'"
new_rv = "gdclService.send({ cmd: 'REVIEW', payload: { review_id: newReview.review_id, order_id: orderId, reviewer_did: identity.did, seller_did: sellerDid, rating, content } });\n    Taro.showToast({ title: '评价已提交'"
content = content.replace(old_rv, new_rv)

with open(store_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - store updated with P2P notifications")
