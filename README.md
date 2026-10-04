# 非肌肉侵犯性膀胱癌（NMIBC）決策台

單一檔案的靜態網頁（`index.html`），從 TURBT 病理一路引導到風險分層、re-TURBT、術後灌注、BCG 排程與追蹤。

## 設計原則：從病理報告開始

- 初次接觸只需要 T 分期與分級。系統在「下一步」卡片逐項提示：是否合併 CIS、EAU 臨床風險因子（年齡 >70、多發、直徑 ≥3 cm）、初發或復發、高危病理特徵（攝護腺尿道 CIS、組織亞型、LVI）、切除品質、復發史。
- 資料未齊時，系統列出所有可能的分組，先以較高的一組顯示並標「暫定」。
- WHO 2004/2016 與 1973 分級擇一即可；兩者都填且結果不同時，取較高一組並提示。

## 分頁

1. 引導評估：EAU 2021 風險分組（低、中、高、極高）與進展機率、AUA/SUO 分層、IBCG 中度風險細分、re-TURBT 判斷、術後灌注與輔助治療、追蹤排程
2. 風險分層對照：EAU 2026 Table 6.2、進展機率表、AUA 2024 Table 4、IBCG、re-TURBT 適應症（目前病人所在列會高亮）
3. BCG 排程：輸入誘導第一劑日期，算出誘導 6 週與 SWOG 維持（第 3、6、12、18、24、30、36 個月）的每一劑日期；TURBT 後未滿 2 週會警示
4. BCG 失敗分類：依 EAU 2026 Table 7.2 判斷 refractory、relapsing、unresponsive、exposed，並列出 Table 7.5 的處置選項
5. 追蹤排程：EAU 2026 與 AUA 2024 膀胱鏡與上泌尿道影像
6. 示例病例（虛構教學資料）
7. 參考文獻

## 開發

決策邏輯集中在 `index.html` 的 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊，可在 Node 單獨測試：

```bash
node tests.cjs
```

## 主要參考

- EAU Guidelines on Non-muscle-invasive Bladder Cancer, 2026（2026 年 3 月更新）
- Sylvester RJ, et al. EAU NMIBC prognostic factor risk groups. Eur Urol 2021;79:480–488
- AUA/SUO Diagnosis and Treatment of NMIBC Guideline, 2024 Amendment（2026 年修訂全文須會員登入，未核對）
- IBCG intermediate-risk consensus, Eur Urol Oncol 2022
- SWOG 8507 maintenance BCG, J Urol 2000

## 醫療安全聲明

本工具供醫療專業人員教育與流程輔助使用，不取代臨床判斷、多專科團隊討論與院內規範。資料只存在使用者瀏覽器的 localStorage，不會上傳；請勿輸入可識別病人身分的資訊。
