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
6. 示範病例：8 例（低、中、高、極高風險與 BCG-unresponsive），工具結果由引擎即時算出，可帶入工具並標示「示範病例」
7. 考題：基礎 10 題、高階 10 題，固定順序，A–D 各 5 題，附解析與出處，作答不儲存
8. 心智圖：8 個分支，可收合
9. 參考文獻

網址可加 `#cases`、`#quiz`、`#map` 等直接開啟分頁。

## v2.0 修正（2026-11-05）

- 曾接受 BCG 後高惡性度復發時，不再把 BCG 標為建議，改先做失敗分類，也不再列 BCG-naïve 才適用的免疫合併療法
- 改回初發後，先前勾選的復發史不再影響 IBCG、AUA 與治療
- 門診電燒、主動監測只列給 LG Ta；小型晚期復發的單次灌注會檢查大小與復發史（≥3 cm 不算小，EAU 未定義「小」，這是工具的假設）
- 復發 >1 次／年 標示單獨單次灌注無效；膀胱內化療失敗的中度風險改以 BCG 為首選
- AUA 的「HG Ta 考慮再切除」只在 AUA 高風險時出現；無逼尿肌的 re-TURBT 豁免只限原發 CIS
- 單純 CIS 不再詢問乳突狀腫瘤數目與大小
- 只有 WHO 1973 的 Ta G2 使用中度 Ta 追蹤排程；進展機率依所用的 WHO 系統顯示
- BCG 失敗：未選療程時不分類，負值月數視為未輸入；BCG 日期早於 TURBT 會提示日期錯誤
- 待回報：全部待回報時不再顯示「資料已齊全」，填寫後自動解除，並列入摘要
- 不合理年齡視為未知；localStorage 損毀不再讓頁面出錯；紀錄加上日期；深色模式極高風險標籤對比修正

## 開發

決策邏輯集中在 `index.html` 的 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊，可在 Node 單獨測試：

```bash
node tests.cjs
```

測試含 77,760 種輸入組合的安全檢查，並用引擎核對病例與考題答案。教學內容在 `/*TEACH-START*/ … /*TEACH-END*/`。

## 主要參考

- EAU Guidelines on Non-muscle-invasive Bladder Cancer, 2026（2026 年 3 月更新）
- Sylvester RJ, et al. EAU NMIBC prognostic factor risk groups. Eur Urol 2021;79:480–488
- AUA/SUO Diagnosis and Treatment of NMIBC Guideline, 2024 Amendment（2026 年修訂全文須登入；摘要指出風險分層有更新，本頁尚未依此修改）
- IBCG intermediate-risk consensus, Eur Urol Oncol 2022
- SWOG 8507 maintenance BCG, J Urol 2000

## 醫療安全聲明

本工具供醫療專業人員教育與流程輔助使用，不取代臨床判斷、多專科團隊討論與院內規範。資料只存在使用者瀏覽器的 localStorage，不會上傳；請勿輸入可識別病人身分的資訊。
