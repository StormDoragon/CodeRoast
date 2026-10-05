import { appendFileSync, readFileSync } from 'node:fs';
import { run } from './run';

run(
  { get: (name) => process.env[name] },
  {
    readFile: (p) => readFileSync(p, 'utf8'),
    appendFile: (p, d) => appendFileSync(p, d),
    log: (m) => console.log(m),
  },
)
  .then((r) => {
    console.log(r.message);
    if (r.failed) {
      console.log(`::error title=CodeRoast::${r.message}`);
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.log(`::error title=CodeRoast::${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
