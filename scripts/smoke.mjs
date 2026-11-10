// Live smoke for the API client shipped in the add-on (no generation): wrong key -> auth, no key -> wall -> auth.
import { credits, submit } from '../build/api.js';
let fail = 0;
const expectAuth = async (name, fn) => {
  try { await fn(); console.log(`FAIL ${name}: no error`); fail++; }
  catch (e) { const ok = e.kind === 'auth'; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${e.kind} ${e.message}`); if (!ok) fail++; }
};
await expectAuth('wrong key credits()', () => credits('sk-invalidtest000'));
await expectAuth('no key submit()', () => submit('', 'smoke test'));
process.exit(fail ? 1 : 0);
