# 散熱片計算 · HS Design 3.0

繁體中文、手機大字、可安裝與離線使用的 PWA。矩形平板鰭片的工程初估工具，支援直立、水平鰭片朝上及通道強制對流。

## 第一次啟用 GitHub Pages

已編譯靜態網站位於 `docs/`，不需伺服器、API 金鑰或付費平台。

1. 開啟 [Settings → Pages](https://github.com/pmebruce/heatsink-sizing/settings/pages)。
2. **Build and deployment → Source** 選 **Deploy from a branch**。
3. Branch 選 **main**，資料夾選 **/docs**，按 **Save**。
4. 等 GitHub 顯示部署完成，開啟 **https://pmebruce.github.io/heatsink-sizing/**。

建立 repository 不會自動啟用 Pages；上述設定完成前，預定網址可能顯示 404。

## 12 項功能

| 功能 | 使用位置 |
| --- | --- |
| 熱負載、設計裕量與容量判定 | 設計評估 |
| 需求熱阻、功率反算根部溫度 | 工作點與熱阻 |
| 材料導熱係數、密度、鰭片效率 | 材料與鰭片效率 |
| 直立／水平朝上並排比較 | 方案比較 |
| 淨空警告、遮蔽面、自訂對流折減 | 淨空、遮蔽與海拔 |
| N、H、L 尺寸網格搜尋 | 尺寸搜尋 |
| W/kg、增加一片的容量與重量效益 | 工作點、鰭片數曲線 |
| 海拔／實際氣壓與空氣密度 | 淨空、遮蔽與海拔 |
| 熱源面積、TIM、接觸與一維基板熱阻 | 熱源、TIM 與接觸熱阻 |
| 換熱係數情境上下限、溫度範圍 | 不確定度情境 |
| 通道風速／有效 CFM | 強制對流 |
| 本機方案、CSV 比較、JSON 備份與匯入 | 方案比較 |

## 計算原則

- 輸入長度為 mm、溫度 °C；內部用 SI。H 始終為通道方向，L 是鰭片從基板伸出的高度。
- `Pd = P × (1 + margin/100)`。依根部與熱源外殼溫度上限取可用根部溫度，在此溫度求容量。反算工作溫度仍使用實際 P。
- 機殼可不計、理想同溫並联，或独立指定溫度。獨立模式僅加總容量，停用功率判定、溫度反算和尺寸推薦。
- 鰭片 `η = tanh(mLc)/(mLc)`。對流與線性化輻射按幾何分配後求等效有限導熱；不是完整非等溫輻射解。
- TIM、接觸及基板一維厚度熱阻串聯；不含熱擴散、晶片 Rjc、多熱源與局部熱點。熱源溫度不是晶片接面溫度。
- 水平採 Tari–Mehrtash：檢核 S/L、L/H、S/H 與修正 Ra。範圍外顯示外推警告，尺寸搜尋不推薦外推點。
- 強制通道採 Teertstra 組合式，以实际穿過通道的流量為前提；已含空氣升溫，不重複套 NTU。未求風扇工作點、旁通、壓降、紊流、混合對流。
- 淨空只作幾何警示，對流保留係數由使用者指定。±20% 預設情境不是經驗證誤差或信賴區間。
- 參考圖片缺少原始公式；不能用圖片的 156.9 W 作為本程式準確度驗證。舊等溫模型約 161.8 W，新版預設加入鰭片效率與理想同溫機殼，結果不同。
- 重量僅含散熱片本體；若總容量含機殼，W/kg 的分母仍不含機殼重量。

完整公式與適用範圍可離線查看 App 的「模型說明」。結果用於早期設計，需實測或詳細模擬驗證。

## 開發與更新

使用 Node.js **24 LTS** 和 npm。原有相依版本與 lockfile 保留，GitHub 入口改用靜態 Vite build。

```sh
npm ci
npm run check
npm test
npm run build:pages
npm run test:pages
```

提交修改後的原始碼及新產生的 **整個 `docs/`**，包含刪除舊 hash 資源。main 更新會由 GitHub 的 branch publishing 自動重新發布，無需自訂 Actions workflow。

```sh
git add pages lib components app/globals.css scripts tests docs package.json package-lock.json
git commit -m "Update heatsink sizing"
git push
```

- `pages/design-app.tsx`：介面與本機方案。
- `lib/design.ts`：12 項功能的計算、反算、搜尋與匯出。
- `lib/thermal.ts`：原自然對流／輻射基礎式。
- `scripts/finalize-pages.mjs`：子路徑 manifest 與版本化 Service Worker。
- `tests/`：物理不變量、舊模型回歸、求解平衡、輸入檢核及離線資源測試。

手機安裝：iOS Safari 分享 → 加入主畫面；Android Chrome 選單 → 安裝 App。第一次須連線等待離線快取完成。新版下載後先儲存方案，關閉所有 App 視窗再重新開啟；不強制刷新未儲存輸入。

## 資料與隱私

沒有帳號、分析追蹤或輸入資料上傳。方案只存在該 origin 的 localStorage，最多 30 個。跨裝置、跨網址不共用；清除網站資料會移除方案，請先匯出 JSON。CSV 匯出含所有輸入、模式、計算版本和主要結果，文字欄位防止公式注入。

此 repo 為公開程式碼與通用範例。**不要把公司設計資料、JSON 或 CSV 備份提交到 repo。**

## 主要參考

- [MIT：Heat Transfer From a Fin](https://web.mit.edu/16.unified/www/FALL/thermodynamics/notes/node128.html)
- [Tari & Mehrtash, 2013](https://doi.org/10.1016/j.applthermaleng.2013.09.003)
- [González Gallero et al., 2019, Table 4](https://doi.org/10.1016/j.applthermaleng.2019.04.086)
- [Liou et al., 2022](https://www.sciencedirect.com/science/article/abs/pii/S1290072921003938)
- [Simons, 2003：Teertstra 通道強制對流與鰭片熱阻](https://www.electronics-cooling.com/2003/02/estimating-parallel-plate-fin-heat-sink-thermal-resistance/)
- [NASA：標準大氣](https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html)
