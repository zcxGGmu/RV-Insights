# RISC-V Kernel Patch Review Checklist

## Build Verification
- [ ] Compiles with `ARCH=riscv` for both 32-bit and 64-bit
- [ ] No new warnings with `W=1`
- [ ] Module builds work if applicable

## Code Quality
- [ ] Passes `scripts/checkpatch.pl --strict`
- [ ] Uses kernel coding conventions (tabs, braces, naming)
- [ ] No magic numbers — uses defines/enums
- [ ] Error paths properly handle cleanup

## Architecture Specific
- [ ] CSR accesses use arch/riscv/include/asm/csr.h macros
- [ ] Memory ordering is correct (fence, barriers)
- [ ] SMP safety verified
- [ ] Works with and without the target extension

## Testing Evidence
- [ ] Boot tested on QEMU (rv32 and/or rv64)
- [ ] Tested on real hardware if applicable
- [ ] Unit tests added or updated

## Commit Quality
- [ ] Subject line ≤ 72 chars, prefixed with subsystem
- [ ] Body explains WHY, not just WHAT
- [ ] Signed-off-by present
- [ ] Fixes/Cc tags if addressing a bug
