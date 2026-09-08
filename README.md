# 散熱片計算 · HS 2.0

繁體中文、手機大字、可安裝與離線使用的 PWA，用來估算矩形平板鰭片在自然對流下的散熱能力。

線上版：<https://pmebruce.github.io/heatsink-sizing/>

## 2.0 功能

- 直立擺放、通道垂直。
- 水平擺放、鰭片朝上。
- 輸入鰭片數、放射率、W／H／L／X、基板與鰭片厚度。
- 輸入環境、散熱片與機殼表面溫度。
- 選擇「散熱片＋機殼」或「僅散熱片」。
- 輸出總散熱量、自然對流、熱輻射、輻射占比、間距與重量。
- 比較目前片數前後各 5 片，顯示範圍內的建議點。
- 顯示計算公式、適用範圍與外推警告。
- 保留 HS 桌面圖示，可加入手機主畫面並離線使用。

## 模型限制

- 鰭片及基板採等溫表面近似，材料密度固定為鋁 2,700 kg/m³。
- 自然對流使用乾空氣 1 atm，環境溫度也作為周圍輻射溫度。
- 直立通道採 Elenbaas 類組合式，外側採垂直平板關係式。
- 水平鰭片朝上採 Tari–Mehrtash 關係式；超出 S/L、L/H、S/H 或修正 Rayleigh 數範圍時會標示外推估算。
- 輻射使用灰體 U 型通道開口近似，未解完整視角係數。
- 結果用於早期尺寸比較，仍需實測或 CFD 驗證。

參考圖片沒有提供原始公式，因此圖片上的 156.9 W 不能作為準確度驗證。以圖片尺寸帶入本程式的直立等溫模型約為 161.8 W。

## 開發與發布

```sh
npm ci
npm run check
npm test
npm run build:pages
npm run test:pages
```

GitHub Pages 使用 `main` 分支的 `/docs` 資料夾。修改後需提交原始碼及重新產生的整個 `docs/`。

## 資料安全

程式沒有帳號、分析追蹤或輸入資料上傳。此 repository 是公開程式碼，請勿提交公司尺寸或其他機密資料。

## 參考資料

- [Tari & Mehrtash, 2013](https://doi.org/10.1016/j.applthermaleng.2013.09.003)
- [González Gallero et al., 2019, Table 4](https://doi.org/10.1016/j.applthermaleng.2019.04.086)
- [Liou et al., 2022](https://www.sciencedirect.com/science/article/abs/pii/S1290072921003938)
- [COMSOL：Sutherland 空氣物性](https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html)
