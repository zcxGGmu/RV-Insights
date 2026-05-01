from __future__ import annotations

import asyncio
import re
from typing import Any, Callable, Dict, List, Optional

import structlog

logger = structlog.get_logger()


class TUToolSpec:
    def __init__(
        self,
        name: str,
        description: str,
        category: str,
        category_zh: str,
        parameters: Dict[str, Any],
        test_examples: List[Dict[str, Any]],
        return_schema: Dict[str, Any],
        run_fn: Callable,
    ) -> None:
        self.name = name
        self.description = description
        self.category = category
        self.category_zh = category_zh
        self.parameters = parameters
        self.test_examples = test_examples
        self.return_schema = return_schema
        self.run_fn = run_fn

    def to_list_item(self, lang: str = "en") -> Dict[str, Any]:
        props = self.parameters.get("properties", {})
        required = self.parameters.get("required", [])
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "category_zh": self.category_zh if lang == "zh" else None,
            "param_count": len(props),
            "required_params": required,
            "has_examples": len(self.test_examples) > 0,
            "has_return_schema": bool(self.return_schema),
        }

    def to_spec(self, lang: str = "en") -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "test_examples": self.test_examples,
            "return_schema": self.return_schema,
            "category": self.category,
            "category_zh": self.category_zh if lang == "zh" else None,
            "source_file": f"builtin/{self.name}",
        }


class ToolUniverseRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, TUToolSpec] = {}

    def register(self, spec: TUToolSpec) -> None:
        self._tools[spec.name] = spec

    def list_tools(
        self,
        search: str = "",
        category: str = "",
        lang: str = "en",
    ) -> Dict[str, Any]:
        results = list(self._tools.values())
        if category:
            results = [t for t in results if t.category == category]
        if search:
            q = search.lower()
            results = [
                t for t in results
                if q in t.name.lower() or q in t.description.lower()
            ]
        categories = sorted({t.category for t in self._tools.values()})
        return {
            "tools": [t.to_list_item(lang) for t in results],
            "total": len(results),
            "categories": categories,
        }

    def get_tool(self, name: str, lang: str = "en") -> Optional[Dict[str, Any]]:
        spec = self._tools.get(name)
        if spec is None:
            return None
        return spec.to_spec(lang)

    async def run_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        spec = self._tools.get(name)
        if spec is None:
            raise ToolNotFoundError(name)
        try:
            if asyncio.iscoroutinefunction(spec.run_fn):
                coro = spec.run_fn(arguments)
            else:
                loop = asyncio.get_event_loop()
                coro = loop.run_in_executor(None, spec.run_fn, arguments)
            result = await asyncio.wait_for(coro, timeout=30.0)
            return result
        except asyncio.TimeoutError:
            raise
        except ToolNotFoundError:
            raise
        except Exception as exc:
            raise ToolRunError(str(exc)) from exc

    def list_categories(self, lang: str = "en") -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        zh_map: Dict[str, str] = {}
        for t in self._tools.values():
            counts[t.category] = counts.get(t.category, 0) + 1
            if t.category_zh:
                zh_map[t.category] = t.category_zh
        cats = []
        for name in sorted(counts.keys()):
            entry: Dict[str, Any] = {"name": name, "count": counts[name]}
            if lang == "zh" and name in zh_map:
                entry["name_zh"] = zh_map[name]
            cats.append(entry)
        return {"categories": cats}


class ToolNotFoundError(Exception):
    pass


class ToolRunError(Exception):
    pass


# ── Built-in RISC-V tools ───────────────────────────────────────────────

RISCV_OPCODES = {
    0b0110011: "R-type (OP)",
    0b0010011: "I-type (OP-IMM)",
    0b0000011: "I-type (LOAD)",
    0b0100011: "S-type (STORE)",
    0b1100011: "B-type (BRANCH)",
    0b0110111: "U-type (LUI)",
    0b0010111: "U-type (AUIPC)",
    0b1101111: "J-type (JAL)",
    0b1100111: "I-type (JALR)",
    0b1110011: "I-type (SYSTEM)",
}


async def _decode_instruction(args: Dict[str, Any]) -> Dict[str, Any]:
    raw = args.get("instruction", "")
    try:
        value = int(raw, 0)
    except (ValueError, TypeError):
        return {"error": f"Invalid instruction: {raw}"}
    opcode = value & 0x7F
    rd = (value >> 7) & 0x1F
    funct3 = (value >> 12) & 0x7
    rs1 = (value >> 15) & 0x1F
    rs2 = (value >> 20) & 0x1F
    funct7 = (value >> 25) & 0x7F
    fmt = RISCV_OPCODES.get(opcode, "Unknown")
    return {
        "hex": f"0x{value:08x}",
        "binary": f"0b{value:032b}",
        "opcode": f"0b{opcode:07b}",
        "format": fmt,
        "rd": rd,
        "funct3": funct3,
        "rs1": rs1,
        "rs2": rs2,
        "funct7": funct7,
    }


RISCV_CSRS = {
    "mstatus": {"addr": 0x300, "priv": "M", "desc": "Machine status register"},
    "misa": {"addr": 0x301, "priv": "M", "desc": "Machine ISA register"},
    "mie": {"addr": 0x304, "priv": "M", "desc": "Machine interrupt enable"},
    "mtvec": {"addr": 0x305, "priv": "M", "desc": "Machine trap vector base"},
    "mepc": {"addr": 0x341, "priv": "M", "desc": "Machine exception PC"},
    "mcause": {"addr": 0x342, "priv": "M", "desc": "Machine trap cause"},
    "mtval": {"addr": 0x343, "priv": "M", "desc": "Machine trap value"},
    "mip": {"addr": 0x344, "priv": "M", "desc": "Machine interrupt pending"},
    "sstatus": {"addr": 0x100, "priv": "S", "desc": "Supervisor status register"},
    "sie": {"addr": 0x104, "priv": "S", "desc": "Supervisor interrupt enable"},
    "stvec": {"addr": 0x105, "priv": "S", "desc": "Supervisor trap vector base"},
    "sepc": {"addr": 0x141, "priv": "S", "desc": "Supervisor exception PC"},
    "scause": {"addr": 0x142, "priv": "S", "desc": "Supervisor trap cause"},
    "stval": {"addr": 0x143, "priv": "S", "desc": "Supervisor trap value"},
    "sip": {"addr": 0x144, "priv": "S", "desc": "Supervisor interrupt pending"},
    "satp": {"addr": 0x180, "priv": "S", "desc": "Supervisor address translation and protection"},
    "cycle": {"addr": 0xC00, "priv": "U", "desc": "Cycle counter (read-only)"},
    "time": {"addr": 0xC01, "priv": "U", "desc": "Timer (read-only)"},
    "instret": {"addr": 0xC02, "priv": "U", "desc": "Instructions retired (read-only)"},
}


async def _csr_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("name", "").lower().strip()
    if not query:
        return {"error": "Please provide a CSR name or hex address"}
    for name, info in RISCV_CSRS.items():
        addr_hex = f"0x{info['addr']:03x}"
        if query == name or query == addr_hex or query == str(info["addr"]):
            return {
                "name": name,
                "address": addr_hex,
                "privilege": info["priv"],
                "description": info["desc"],
            }
    return {"error": f"CSR not found: {query}", "available": sorted(RISCV_CSRS.keys())}


async def _check_kernel_config(args: Dict[str, Any]) -> Dict[str, Any]:
    config_text = args.get("config_text", "")
    option = args.get("option", "").strip()
    if not option.startswith("CONFIG_"):
        option = f"CONFIG_{option}"
    for line in config_text.split("\n"):
        line = line.strip()
        if line.startswith(f"{option}="):
            value = line.split("=", 1)[1]
            return {"option": option, "set": True, "value": value}
        if line == f"# {option} is not set":
            return {"option": option, "set": False, "value": None}
    return {"option": option, "set": False, "value": None, "note": "Not found in config"}


async def _validate_patch_format(args: Dict[str, Any]) -> Dict[str, Any]:
    patch = args.get("patch", "")
    issues: List[str] = []
    lines = patch.split("\n")
    subject_line = ""
    has_sob = False
    has_diff = False
    for line in lines:
        if line.startswith("Subject:"):
            subject_line = line[8:].strip()
            subject_line = re.sub(r"^\[PATCH[^\]]*\]\s*", "", subject_line)
        if line.startswith("Signed-off-by:"):
            has_sob = True
        if line.startswith("diff --git"):
            has_diff = True
    if subject_line and len(subject_line) > 72:
        issues.append(f"Subject line too long ({len(subject_line)} > 72 chars)")
    if not has_sob:
        issues.append("Missing Signed-off-by tag")
    if not has_diff:
        issues.append("No diff content found")
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "subject": subject_line or "(not found)",
        "has_signed_off_by": has_sob,
        "has_diff": has_diff,
    }


def create_default_registry() -> ToolUniverseRegistry:
    registry = ToolUniverseRegistry()

    registry.register(TUToolSpec(
        name="riscv_instruction_decoder",
        description="Decode a RISC-V binary instruction into its fields",
        category="ISA Utilities",
        category_zh="ISA 工具",
        parameters={
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Instruction as hex (0x00000033) or decimal",
                },
            },
            "required": ["instruction"],
        },
        test_examples=[{"instruction": "0x00000033"}],
        return_schema={"type": "object"},
        run_fn=_decode_instruction,
    ))

    registry.register(TUToolSpec(
        name="riscv_csr_lookup",
        description="Look up a RISC-V CSR by name or address",
        category="ISA Utilities",
        category_zh="ISA 工具",
        parameters={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "CSR name (e.g. mstatus) or hex address (e.g. 0x300)",
                },
            },
            "required": ["name"],
        },
        test_examples=[{"name": "mstatus"}, {"name": "0x300"}],
        return_schema={"type": "object"},
        run_fn=_csr_lookup,
    ))

    registry.register(TUToolSpec(
        name="kernel_config_checker",
        description="Check if a CONFIG_ option is set in a kernel .config",
        category="Kernel Development",
        category_zh="内核开发",
        parameters={
            "type": "object",
            "properties": {
                "config_text": {
                    "type": "string",
                    "description": "Contents of the .config file",
                },
                "option": {
                    "type": "string",
                    "description": "Config option name (e.g. CONFIG_RISCV or RISCV)",
                },
            },
            "required": ["config_text", "option"],
        },
        test_examples=[{
            "config_text": "CONFIG_RISCV=y\nCONFIG_64BIT=y",
            "option": "RISCV",
        }],
        return_schema={"type": "object"},
        run_fn=_check_kernel_config,
    ))

    registry.register(TUToolSpec(
        name="patch_format_validator",
        description="Validate a kernel patch format (subject, Signed-off-by, diff)",
        category="Contribution",
        category_zh="贡献工具",
        parameters={
            "type": "object",
            "properties": {
                "patch": {
                    "type": "string",
                    "description": "Full patch text (git format-patch output)",
                },
            },
            "required": ["patch"],
        },
        test_examples=[{
            "patch": (
                "Subject: [PATCH] riscv: Add Zicbom support\n\n"
                "Signed-off-by: Dev <dev@example.com>\n\n"
                "diff --git a/arch/riscv/Kconfig b/arch/riscv/Kconfig\n"
            ),
        }],
        return_schema={"type": "object"},
        run_fn=_validate_patch_format,
    ))

    return registry
