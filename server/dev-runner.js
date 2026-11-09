import { spawn } from 'node:child_process';

console.log('Iniciando ambiente de desenvolvimento (Backend API + Frontend Vite)...');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const nodeCmd = isWin ? 'node.exe' : 'node';

const server = spawn(nodeCmd, ['--watch', 'server/index.js'], {
  stdio: 'inherit',
  shell: true
});

const client = spawn(npmCmd, ['run', 'client'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  server.kill();
  client.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
