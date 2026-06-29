// 行业模板配置 — 改这个文件即可切换行业场景
// 星火计划三赛道：校园二手 / 家乡特产 / 个人技能

export interface IndustryConfig {
  name: string;               // 行业名称
  searchPlaceholder: string;  // 搜索框占位文字
  defaultUnits: string[];     // 默认单位选项
  customerTags: string[];     // 客户标签预设
  homeTips: string[];         // 首页提示语
}

// 默认：家乡特产（可改为校园二手、个人技能等）
export const industry: IndustryConfig = {
  name: '家乡特产',
  searchPlaceholder: '搜搜家乡好货...',
  defaultUnits: ['斤', '件', '箱', '个', '瓶', '袋', '盒', '包'],
  customerTags: ['老客户', '批发客户', '零售客户', '新客户'],
  homeTips: [
    '发布你的家乡特产，让全国看到',
    '直接下单，P2P交易无中间商',
    '一人就是一家店',
  ],
};

// 预设模板（注释掉，需要时切换）
/*
export const industry: IndustryConfig = {
  name: '校园二手',
  searchPlaceholder: '搜搜学长学姐的闲置...',
  defaultUnits: ['个', '件', '本', '台', '套', '双', '张'],
  customerTags: ['学弟学妹', '同校同学', '校外买家'],
  homeTips: ['毕业季大甩卖', '闲置变零花', '校内面交更安全'],
};

export const industry: IndustryConfig = {
  name: '个人技能',
  searchPlaceholder: '搜搜你能帮上忙的技能...',
  defaultUnits: ['次', '小时', '件', '套', '项'],
  customerTags: ['回头客', '介绍客户', '新客户'],
  homeTips: ['展示你的技能，接单赚钱', '按小时/按件计费', '技能变现，一人公司'],
};
*/
