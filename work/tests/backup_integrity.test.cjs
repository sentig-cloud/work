const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('work_service.js', 'utf8');
const code = source.slice(source.indexOf('window.isBackupIntegrityEnabled ='), source.indexOf('window.uploadBackupBlob ='));
let files = {}, checks = true, badPhoto = false, corrupt = false, saved = 0, message = '';
let scope = 'all', year = '2026', month = '11';
class MockZip {
  file(name, value) {
    if (arguments.length === 2) { files[name] = value; return this; }
    if (!(name in files)) return null;
    return { async: async type => type === 'string' ? files[name] : new Uint8Array(await files[name].arrayBuffer()) };
  }
  async generateAsync() { return new Blob(['simulated zip']); }
  static async loadAsync(_, options) {
    assert.equal(options.checkCRC32, true);
    if (corrupt) throw new Error('CRC32 오류');
    return new MockZip();
  }
}
const logs = [{ id: '1', y: 2026, m: 11, imgs: [{ id: 'a', src: 'photo' }] }, { id: '3', y: 2025, m: 10, imgs: [] }];
const trash = [{ id: '2', imgs: [{ id: 'b', src: 'trash-photo' }] }];
const window = {
  logs, trash,
  loadJSZip: async () => MockZip,
  getMasterBackupData: () => ({ groups: [{ id: 'g', tags: [] }] }),
  getUiSettingsPayload: () => ({ example: true }),
  getLocalSettingsSnapshot: () => ({ wm_test: '1' }),
  fetchBackupImage: async src => { if (badPhoto && src === 'photo') throw new Error('HTTP 404'); return new Blob(['picture'], { type: 'image/jpeg' }); },
  createImageBackupPath: (log, img) => `images/${log.id}_${img.id}.jpg`,
  showBackupProgress() {}, hideBackupProgress() {}, closeBackupDialog() {},
  downloadBlob: async () => { saved++; return true; },
  formatBackupDate: () => '',
};
const document = { getElementById: id => ({ backupScope: { value: scope }, backupYear: { value: year }, backupMonth: { value: month } })[id] || null };
const context = { window, document, localStorage: { getItem: () => checks ? null : '0' }, Blob, alert: text => { message = text; }, confirm: () => false, console: { error() {} } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('window.getSelectedBackupLogs ='), source.indexOf('window.createImageBackupPath =')), context);
vm.runInContext(code, context);

(async () => {
  await window.startZipBackup();
  const backup = JSON.parse(files['backup.json']);
  assert.equal(saved, 1);
  assert.equal(backup.data.logs.length, 2);
  assert.equal(backup.data.trash.length, 1);
  assert.equal(backup.images.length, 2);
  assert.equal(backup.localSettings.wm_test, '1');

  files = {}; scope = 'year';
  await window.startZipBackup();
  assert.equal(saved, 2);
  assert.equal(JSON.parse(files['backup.json']).data.logs.length, 1);
  assert.equal('trash' in JSON.parse(files['backup.json']).data, false);
  assert.equal(JSON.parse(files['backup.json']).backupScope, '2026');
  files = {}; scope = 'month'; month = '11';
  await window.startZipBackup();
  assert.equal(saved, 3);
  assert.equal(JSON.parse(files['backup.json']).backupScope, '2026-11');
  files = {}; month = '10';
  await window.startZipBackup();
  assert.equal(saved, 3);
  assert.match(message, /기록이 없습니다/);
  month = '13';
  await window.startZipBackup();
  assert.equal(saved, 3);
  assert.match(message, /범위/);
  scope = 'all'; month = '11';

  files = {}; badPhoto = true;
  await window.startZipBackup();
  assert.equal(saved, 3);
  assert.match(message, /사진 1개/);
  assert.equal(window.lastBackupFailures[0].logId, '1');

  files = {}; badPhoto = false; corrupt = true;
  await window.startZipBackup();
  assert.equal(saved, 3);
  assert.match(message, /CRC32/);

  files = {}; corrupt = false; badPhoto = true; checks = false;
  await window.startZipBackup();
  assert.equal(saved, 4);
  assert.match(message, /누락된 사진/);

  assert.throws(() => window.verifyBackupStructure({ logs: [{ id: 'a' }, { id: 'a' }], trash: [], groups: [] }), /중복/);
  const backupSource = fs.readFileSync('work_backup.js', 'utf8');
  const verifier = backupSource.slice(backupSource.indexOf('window.verifyServerBackupResult ='), backupSource.indexOf('    // ─── 백업 파일 받기'));
  vm.runInContext(verifier, context);
  const serverBackup = { kind: 'full', data: { logs: [{ id: 'a' }], trash: [], groups: [{ id: 'g', tags: [] }] } };
  window.verifyServerBackupResult({ logs: 1, trash: 0, groups: 1 }, serverBackup, 'full');
  assert.throws(() => window.verifyServerBackupResult({ logs: 2, trash: 0, groups: 1 }, serverBackup, 'full'), /항목 수/);
  assert.throws(() => window.verifyServerBackupResult({ logs: 1, trash: 0, groups: 1 }, null, 'full'), /필요한/);
  console.log('백업 검사 성공, 사진 실패, ZIP 오류, 검사 해제 및 중복 ID 확인');
})().catch(error => { console.error(error); process.exitCode = 1; });
