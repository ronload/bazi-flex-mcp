# Oracle

「Oracle」是測試術語（test oracle），指判定一次執行結果是對是錯的判準來源。這裡的判準是
**目前這版程式的實際行為**，以 `shunshi-bazi-core@0.2.0` + `tyme4ts@1.4.6` 為底。與 Oracle
Corporation 無關，全程離線，不存取任何網路服務。

它存在的理由：接下來要把 core 搬進本 repo 自己維護、再改輸出形狀。「有沒有改壞」不能靠
人工抽看幾張盤回答，必須有一個能對數千組輸入回答「逐位元相同 / 這 41 組變了」的東西。

## 用法

```
bun run oracle:check      # 對照基線，CI 跑的就是這個（也涵蓋在 bun test 內）
bun run oracle:baseline   # 重建基線。這是刻意的動作，見下方
bun run oracle:coverage   # 語料實際觸及了什麼

bun run test/oracle/cli.ts explain lichun/2026+0001      # 某個案例的輸入是什麼
bun run test/oracle/cli.ts dump  lichun/2026+0001 /tmp/a # 完整 payload 落檔
bun run test/oracle/cli.ts diff  /tmp/a/x.json /tmp/b/x.json  # 欄位級 diff
```

典型的調查流程是：`check` 告訴你**哪些**案例動了，`dump` 前後各一次再 `diff` 告訴你案例
**裡面什麼**動了。指紋刻意無法回答第二個問題，這是不把數十 MB 產生物塞進版控的代價。

## 組成

| 檔案 | 職責 |
| --- | --- |
| `corpus.ts` | 語料：六個 layer，決定性產生，`CORPUS_VERSION` 控管 |
| `cities.ts` | 上游城市表的凍結快照（不深入 import 上游私有路徑） |
| `prng.ts` | mulberry32。此目錄禁用 `Math.random()` |
| `surfaces.ts` | 三個受測面 + 時鐘凍結 |
| `canonical.ts` | 正規化序列化、指紋、深層 diff |
| `manifest.ts` | 基線檔讀寫與比對 |
| `coverage.ts` | 語料覆蓋度（從**輸出**量測，不是從輸入） |
| `versions.test.ts` | 實裝版本守衛，見該檔頭註解 |

## 三個受測面

- **`core`** — 上游 `getBaziChart()`，含 schema 未曝露的 `sect` / `useTrueSolarTime` /
  `standardMeridian`。這是 Stage 1（vendor 進 repo）第一天就必須逐位元滿足的契約。
- **`toolFull`** — `getBaziChart` MCP 工具的完整輸出。
- **`toolPartial`** — `getBaziChartPartial` 的輸出。

後兩者**預期**會在 Stage 2/3 刻意分岔。分岔時必須是一次經過審閱的基線變更，不是意外。

## 語料 layer 各自守什麼

| layer | 案例數 | 守的東西 |
| --- | --- | --- |
| `random` | 2000 | 廣面回歸，1900-2100 全跨度 |
| `daypillar` | 60 | 連續 60 天 = 完整一輪甲子，因此涵蓋全部 10 組稀疏神煞日柱集合與旬空整輪 |
| `midnight` | 296 | 早晚子（`sect` 1/2）、時辰跨子時、真太陽時修正跨午夜 |
| `lichun` | 1407 | 每年立春前後 ±48h，含 ±1 分鐘那組——唯一「差一分鐘必須翻年柱」的地方 |
| `jieqi` | 1044 | 12 個節的月柱換界 |
| `city` | 152 | 每個城市鍵與別名各一，含 5 個標準經線覆寫城市 |

`daypillar` 與 `city` 是**窮舉**而非抽樣，因為這兩處的空間夠小而觸發夠稀疏：某些神煞只在
60 個日柱中的 3 個上觸發，隨機抽樣在 200 年跨度上幾乎照不到。

目前實測覆蓋：60/60 日柱、60/60 年柱、12/12 月支、12/12 時支、5/5 納音五行、兩種 sect、
151 個城市字串，以及上游 `shensha.js` 內**全部** 50 個神煞名稱。

## 什麼時候可以重建基線

只有兩種情況：

1. **語料變了**（改了 `corpus.ts` 或 `cities.ts`）。同時要提高 `CORPUS_VERSION`。
2. **行為刻意變了**，且變更本身已經被審閱過。

重建基線與行為變更**必須分開 commit**。混在一起的話 `git diff` 上那幾千行指紋就完全讀不出
是哪個改動造成的，基線也就等於沒有。

## 時鐘凍結

上游 `buildDayun` 用 `new Date().getFullYear()` 算 `大运[].当前`，沒有注入點。所以整套
harness 在 `2026-06-15T12:00:00Z` 凍結系統時鐘。沒有這個凍結，基線每逢元旦會無聲腐爛，
而跨午夜執行的一次 run 會對同一組輸入給出兩種答案。

選正午 UTC 是為了讓 UTC-11 到 UTC+11 的本地日曆日期一致，UTC+8 以外的開發者也能重現。

## Oracle 的天花板

**全量比對只能證明與上游的私家家法一致，永遠不能證明命理上正確。** 這是無法用測試消解的。

更要緊的是：本重構的主要賣點（原生三柱、三合三會三刑、帶柱位標籤的 relations、決策輔助、
流年立春界點）恰恰全是 oracle 沒有參照物的**新行為**。那些需要典籍例證測例與等價性測試，
不能靠這裡。
