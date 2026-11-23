// 올리기 전 점검 (GitHub Actions가 main에 올릴 때마다 자동으로 돌려요)
// 1) 각 페이지에 꼭 있어야 하는 화면 요소  2) 페이지가 부르는 파일이 실제로 있는지  3) js/ · data/ 스크립트 문법  4) 어휘 퀴즈 낱말(data/vocab.js)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";

const PAGES = {
  "index.html": ["levels", "levelList", "setup", "sessions", "cards", "flip", "quiz", "choices", "next", "result", "score"],
  "hanja.html": ["lock", "lockForm", "pw", "map", "hoeList", "stages", "stageList", "study", "quiz", "choices", "next", "result", "score"],
};
const errors = [];
for (const [file, ids] of Object.entries(PAGES)) {
  if (!existsSync(file)) { errors.push(`${file} 이 없어요.`); continue; }
  const html = readFileSync(file, "utf8");
  for (const id of ids) if (!html.includes(`id="${id}"`)) errors.push(`${file}: 화면 요소 #${id} 가 없어요.`);
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: <title> 이 없어요.`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) errors.push(`${file}: 페이지 안에 스크립트를 직접 쓰지 말고 js/ 폴더 파일로 빼 주세요.`);
  for (const [, src] of html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+)"/g)) {
    if (/^https:\/\//.test(src)) {
      if (!/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)(\/|$)/.test(src)) errors.push(`${file}: 알 수 없는 외부 주소: ${src}`);
    } else if (!existsSync(src.split("?")[0])) errors.push(`${file}: 부르는 파일이 없어요: ${src}`);
  }
}
for (const dir of ["js", "data"]) {
  for (const f of readdirSync(dir).filter(f => f.endsWith(".js"))) {
    try { new vm.Script(readFileSync(`${dir}/${f}`, "utf8"), { filename: `${dir}/${f}` }); }
    catch (e) { errors.push(`${dir}/${f}: 문법 오류: ${e.message}`); }
  }
}
function loadData(path, key) {
  try { const window = {}; vm.runInNewContext(readFileSync(path, "utf8"), { window }); return window[key]; }
  catch (e) { errors.push(`${path} 를 읽지 못했어요: ${e.message}`); return null; }
}
// data/vocab.js: 월호 → 단계 → 차시 → 낱말. 최근 2개 월호만. 빈칸 예문에는 [정답]이 한 번
const vocab = loadData("data/vocab.js", "VOCAB");
if (vocab) {
  let n = 0;
  for (const [mon, m] of Object.entries(vocab)) {
    if (!/^\d{4}-\d{2}$/.test(mon) || !m.label || !m.levels) { errors.push(`data/vocab.js: 월호 '${mon}'는 "2027-01": { label, levels } 모양이어야 해요.`); continue; }
    for (const [lv, sessions] of Object.entries(m.levels)) for (const s of sessions) for (const w of s.words) {
      n++;
      if (!w.w || !w.m) errors.push(`data/vocab.js: ${m.label} ${lv} ${s.session}에 낱말이나 뜻이 빈 칸이 있어요.`);
      if (w.ex && (w.ex.match(/\[[^\]]+\]/g) || []).length !== 1) errors.push(`data/vocab.js: ${m.label} ${lv} ${s.session} '${w.w}' 예문에 [정답]이 한 번만 있어야 해요.`);
    }
  }
  const months = Object.keys(vocab).sort();
  if (months.length > 2) errors.push(`data/vocab.js: 어휘 퀴즈는 최근 2개 월호만 올려요. 가장 오래된 월호(${months.slice(0, months.length - 2).join(", ")})를 지워 주세요.`);
  console.log(`어휘 퀴즈: ${months.length}개 월호, 낱말 ${n}개`);
}
if (!existsSync("data/hanja.enc.js")) errors.push("data/hanja.enc.js 가 없어요.");

if (errors.length) { console.error("점검 실패:\n- " + errors.join("\n- ")); process.exit(1); }
console.log("점검 통과");
