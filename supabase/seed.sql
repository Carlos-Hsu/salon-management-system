-- Demo seed data for Salon Management System.
-- Idempotent by customer phone and service/product name.
begin;

insert into public.customers (name, phone, email, note)
select seed.name, seed.phone, seed.email, seed.note
from (values
  ('王小美', '0912345678', 'xiaomei.wang@example.com', '偏好自然層次剪裁，習慣週末上午預約。'),
  ('陳怡君', '0923456789', 'yijun.chen@example.com', '敏感性頭皮，染髮前需進行頭皮隔離。'),
  ('林雅婷', '0934567890', 'yating.lin@example.com', '長髮，偏好冷棕色系與深層護髮。'),
  ('張家豪', '0956789012', 'jiahao.zhang@example.com', '每四週修剪一次，偏好俐落短髮。'),
  ('李佩珊', '0967890123', 'peishan.li@example.com', '自然捲，吹整時需加強抗毛躁。'),
  ('黃冠宇', '0978901234', 'guanyu.huang@example.com', '偏好低調挑染，造型品需清爽不黏膩。'),
  ('吳佳穎', '0989012345', 'jiaying.wu@example.com', '髮尾容易乾燥，建議定期進行修護療程。'),
  ('劉志明', '0911223344', 'zhiming.liu@example.com', '商務短髮，通常安排平日晚間時段。'),
  ('蔡欣妤', '0922334455', 'xinyu.tsai@example.com', '曾漂髮，進行燙染前須先評估髮況。'),
  ('楊子晴', '0933445566', 'ziqing.yang@example.com', '喜歡韓系造型與空氣感瀏海。')
) as seed(name, phone, email, note)
where not exists (
  select 1 from public.customers existing where existing.phone = seed.phone
);

insert into public.services (name, duration_min, price, active)
select seed.name, seed.duration_min, seed.price, true
from (values
  ('女士設計剪髮', 60, 800::bigint),
  ('男士設計剪髮', 45, 600::bigint),
  ('洗髮與造型', 45, 500::bigint),
  ('頭皮深層清潔', 60, 900::bigint),
  ('單色質感染髮', 150, 2200::bigint),
  ('立體線條挑染', 180, 3200::bigint),
  ('冷塑造型燙髮', 180, 3500::bigint),
  ('縮毛矯正', 240, 4800::bigint),
  ('深層結構護髮', 90, 1800::bigint),
  ('快速水光護髮', 45, 900::bigint)
) as seed(name, duration_min, price)
where not exists (
  select 1 from public.services existing where existing.name = seed.name
);

insert into public.products (name, price, stock, vendor, active)
select seed.name, seed.price, seed.stock, seed.vendor, true
from (values
  ('胺基酸平衡洗髮精 500ml', 780::bigint, 20, '森沐專業髮品'),
  ('保濕修護護髮素 500ml', 820::bigint, 18, '森沐專業髮品'),
  ('摩洛哥堅果髮油 100ml', 980::bigint, 15, '璞光髮品有限公司'),
  ('強力定型噴霧 300ml', 650::bigint, 24, '型格造型供應'),
  ('輕盈蓬鬆髮蠟 80g', 580::bigint, 16, '型格造型供應'),
  ('頭皮淨化液 200ml', 880::bigint, 12, '植研頭皮養護'),
  ('抗熱修護噴霧 150ml', 720::bigint, 14, '璞光髮品有限公司'),
  ('護色洗髮精 500ml', 850::bigint, 20, '彩研專業髮品'),
  ('深層髮膜 250ml', 1080::bigint, 10, '森沐專業髮品'),
  ('海鹽造型噴霧 200ml', 620::bigint, 18, '型格造型供應')
) as seed(name, price, stock, vendor)
where not exists (
  select 1 from public.products existing where existing.name = seed.name
);

commit;
