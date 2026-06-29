/**
 * 运行时加载镇/街道数据。
 * 数据在 static/data/towns_{provinceCode}.json，不参与 webpack 编译。
 * H5: fetch API；小程序: getFileSystemManager 读取代码包内文件。
 */
import Taro from '@tarojs/taro';

interface TownItem {
  code: string;
  name: string;
}

// 缓存已加载的省数据: { [districtCode]: TownItem[] }
const cache: Record<string, Record<string, TownItem[]>> = {};

export async function loadTowns(
  provinceCode: string,
  districtCode: string
): Promise<TownItem[]> {
  // 如果已缓存，直接返回
  if (cache[provinceCode]) {
    return cache[provinceCode][districtCode] || [];
  }

  const fileName = `towns_${provinceCode}.json`;

  try {
    let data: Record<string, TownItem[]>;

    if (process.env.TARO_ENV === 'h5') {
      // H5: fetch 静态文件
      const resp = await fetch(`/static/data/${fileName}`);
      if (!resp.ok) {
        console.warn(`[townLoader] 无法加载 ${fileName}: ${resp.status}`);
        cache[provinceCode] = {};
        return [];
      }
      data = await resp.json();
    } else {
      // 小程序: 文件系统读取
      const fs = Taro.getFileSystemManager();
      const raw = fs.readFileSync(`static/data/${fileName}`, 'utf8') as string;
      data = JSON.parse(raw);
    }

    cache[provinceCode] = data;
    return data[districtCode] || [];
  } catch (e) {
    console.warn(`[townLoader] 加载 ${fileName} 失败:`, e);
    cache[provinceCode] = {};
    return [];
  }
}

/** 预加载省的镇数据（异步，不阻塞 UI） */
export function preloadTowns(provinceCode: string): void {
  loadTowns(provinceCode, '').catch(() => {});
}
