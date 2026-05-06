import { spawn } from 'child_process'

const child = spawn('bunx', ['electronmon', '.'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    RV_INSIGHTS_USE_DEV_SERVER: '1',
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

for (const event of ['SIGINT', 'SIGTERM'] as const) {
  process.on(event, () => {
    child.kill(event)
  })
}
