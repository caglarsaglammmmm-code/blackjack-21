// Firebase emülatörünü JDK 21 ile açar ve skor denemesini içinde çalıştırır.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const env = { ...process.env, JAVA_HOME: process.env.JAVA_HOME || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'jdk-21') };
env.PATH = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env.PATH}`;
const result = spawnSync('npx', ['firebase', 'emulators:exec', '--project', 'demo-tokatlik', '--only', 'auth,firestore', '"node tools/score-e2e.mjs"'], { env, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
