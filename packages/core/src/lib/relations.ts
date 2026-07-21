/**
 * 刑冲合会 — 天干/地支 pair-wise relations.
 *
 * Faithful port of shunshi `services/bazi_service.py` (lines ~35-175):
 *   _GAN_HE / _GAN_CHONG / _GAN_KE
 *   _ZHI_LIU_HE / _ZHI_CHONG / _ZHI_XING / _ZHI_HAI / _ZHI_PO
 *   _find_gan_relations / _find_zhi_relations
 *
 * Only pair-wise relations are computed — matching the shunshi backend.
 * 三合/三会 are intentionally NOT included (the backend doesn't compute them,
 * and the frontend "四柱關係圖示" only renders pair-wise lines).
 */

// ─── 天干关系表 ──────────────────────────────────────────────────

// 天干五合
const GAN_HE: Record<string, string> = {
  甲己: '中正之合', 己甲: '中正之合',
  乙庚: '仁义之合', 庚乙: '仁义之合',
  丙辛: '威制之合', 辛丙: '威制之合',
  丁壬: '淫慝之合', 壬丁: '淫慝之合',
  戊癸: '无情之合', 癸戊: '无情之合',
};

// 天干相冲 (同性相克 = 七杀对冲)
const GAN_CHONG: Set<string> = new Set([
  '甲庚', '庚甲',
  '乙辛', '辛乙',
  '丙壬', '壬丙',
  '丁癸', '癸丁',
]);

// 天干相克 (克者 → 被克者)
const GAN_KE: Record<string, string> = {
  甲: '戊', 乙: '己', 丙: '庚', 丁: '辛', 戊: '壬',
  己: '癸', 庚: '甲', 辛: '乙', 壬: '丙', 癸: '丁',
};

// ─── 地支关系表 ──────────────────────────────────────────────────

// 地支六合
const ZHI_LIU_HE: Record<string, string> = {
  子丑: '土', 丑子: '土',
  寅亥: '木', 亥寅: '木',
  卯戌: '火', 戌卯: '火',
  辰酉: '金', 酉辰: '金',
  巳申: '水', 申巳: '水',
  午未: '火', 未午: '火',
};

// 地支六冲
const ZHI_CHONG: Set<string> = new Set([
  '子午', '午子',
  '丑未', '未丑',
  '寅申', '申寅',
  '卯酉', '酉卯',
  '辰戌', '戌辰',
  '巳亥', '亥巳',
]);

// 地支三刑 (简化为两两关系)
const ZHI_XING: Set<string> = new Set([
  '寅巳', '巳寅',
  '巳申', '申巳',
  '寅申', '申寅',
  '丑戌', '戌丑',
  '戌未', '未戌',
  '丑未', '未丑',
  '子卯', '卯子',
]);

// 地支六害
const ZHI_HAI: Set<string> = new Set([
  '子未', '未子',
  '丑午', '午丑',
  '寅巳', '巳寅',
  '卯辰', '辰卯',
  '申亥', '亥申',
  '酉戌', '戌酉',
]);

// 地支六破
const ZHI_PO: Set<string> = new Set([
  '子酉', '酉子',
  '丑辰', '辰丑',
  '寅亥', '亥寅',
  '卯午', '午卯',
  '巳申', '申巳',
  '未戌', '戌未',
]);

// ─── 关系计算 ──────────────────────────────────────────────────

/**
 * 找出天干之间的合、冲、克关系。
 * short=true → 简洁文案 ("甲己相合" / "甲庚相冲" / "甲克戊")
 * short=false → 完整文案 ("年干甲与月干己相合(中正之合)")
 */
export function findGanRelations(
  gans: string[],
  short: boolean = true,
  labels: string[] = ['年干', '月干', '日干', '时干'],
): string[] {
  const notes: string[] = [];
  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const gi = gans[i];
      const gj = gans[j];
      const pair = gi + gj;

      if (pair in GAN_HE) {
        notes.push(
          short
            ? `${gi}${gj}相合`
            : `${labels[i]}${gi}与${labels[j]}${gj}相合(${GAN_HE[pair]})`,
        );
      }
      if (GAN_CHONG.has(pair)) {
        notes.push(
          short
            ? `${gi}${gj}相冲`
            : `${labels[i]}${gi}与${labels[j]}${gj}相冲`,
        );
      }
      if (GAN_KE[gi] === gj) {
        notes.push(
          short ? `${gi}克${gj}` : `${labels[i]}${gi}克${labels[j]}${gj}`,
        );
      } else if (GAN_KE[gj] === gi) {
        notes.push(
          short ? `${gj}克${gi}` : `${labels[j]}${gj}克${labels[i]}${gi}`,
        );
      }
    }
  }
  return notes;
}

/**
 * 找出地支之间的合、冲、刑、害、破关系。
 * short=true → 简洁文案 ("午子相冲" / "子丑暗合")
 */
export function findZhiRelations(
  zhis: string[],
  short: boolean = true,
  labels: string[] = ['年支', '月支', '日支', '时支'],
): string[] {
  const notes: string[] = [];
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      const zi = zhis[i];
      const zj = zhis[j];
      const pair = zi + zj;

      if (pair in ZHI_LIU_HE) {
        notes.push(
          short
            ? `${zi}${zj}暗合`
            : `${labels[i]}${zi}与${labels[j]}${zj}六合化${ZHI_LIU_HE[pair]}`,
        );
      }
      if (ZHI_CHONG.has(pair)) {
        notes.push(
          short
            ? `${zi}${zj}相冲`
            : `${labels[i]}${zi}与${labels[j]}${zj}相冲`,
        );
      }
      if (ZHI_XING.has(pair)) {
        notes.push(
          short
            ? `${zi}${zj}相刑`
            : `${labels[i]}${zi}与${labels[j]}${zj}相刑`,
        );
      }
      if (ZHI_HAI.has(pair)) {
        notes.push(
          short
            ? `${zi}${zj}相害`
            : `${labels[i]}${zi}与${labels[j]}${zj}相害`,
        );
      }
      if (ZHI_PO.has(pair)) {
        notes.push(
          short
            ? `${zi}${zj}相破`
            : `${labels[i]}${zi}与${labels[j]}${zj}相破`,
        );
      }
    }
  }
  return notes;
}
