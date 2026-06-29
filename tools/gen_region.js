// 从 src/data/addr_*.json 生成 region.ts（内联省市区三级数据）
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'data');
const outFile = path.join(__dirname, '..', 'src', 'data', 'region.ts');

const provinceCodes = [
  '110000000000', '120000000000', '130000000000', '140000000000',
  '150000000000', '210000000000', '220000000000', '230000000000',
  '310000000000', '320000000000', '330000000000', '340000000000',
  '350000000000', '360000000000', '370000000000', '410000000000',
  '420000000000', '430000000000', '440000000000', '450000000000',
  '460000000000', '500000000000', '510000000000', '520000000000',
  '530000000000', '540000000000', '610000000000', '620000000000',
  '630000000000', '640000000000', '650000000000', '710000000000',
  '810000000000', '820000000000',
];

const regions = [];
for (const code of provinceCodes) {
  const raw = fs.readFileSync(path.join(dataDir, `addr_${code}.json`), 'utf8');
  regions.push(JSON.parse(raw));
}

// 生成 TypeScript 代码
const output = `// 全国省市区三级地址数据（编译时从 addr_*.json 自动生成）
// 最后更新: ${new Date().toISOString()}

export interface Region {
  code: string;
  name: string;
  children?: Region[];
}

export const provinces: Region[] = ${JSON.stringify(regions)};

export default provinces;

/** 按 code 查找省份 */
export function findProvinceByCode(code: string): Region | undefined {
  return provinces.find((p) => p.code === code);
}

/** 按名称查找省份 */
export function findProvince(name: string): Region | undefined {
  return provinces.find((p) => p.name === name);
}

/** 按名称在省份的 children 中查找城市 */
export function findCity(provinceCode: string, cityName: string): Region | undefined {
  const province = findProvinceByCode(provinceCode);
  return province?.children?.find((c) => c.name === cityName);
}

/** 按名称在城市/省份的 children 中查找区县 */
export function findDistrict(provinceCode: string, cityCode: string, districtName: string): Region | undefined {
  const province = findProvinceByCode(provinceCode);
  const city = province?.children?.find((c) => c.code === cityCode);
  return city?.children?.find((d) => d.name === districtName);
}
`;

fs.writeFileSync(outFile, output, 'utf8');
console.log(`Generated ${outFile} (${(output.length / 1024).toFixed(0)} KB)`);
