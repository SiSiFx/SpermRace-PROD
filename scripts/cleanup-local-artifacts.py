#!/usr/bin/env python3
from __future__ import annotations

import argparse
import glob
import os
import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def within_repo(path: Path) -> bool:
    try:
        path.resolve().relative_to(REPO_ROOT)
        return True
    except Exception:
        return False


def remove_path(path: Path, apply: bool) -> tuple[bool, int, str]:
    """
    Returns (removed, bytes_estimate, kind)
    """
    if not path.exists() and not path.is_symlink():
        return (False, 0, "missing")

    if not within_repo(path):
        return (False, 0, "outside_repo")

    size = 0
    kind = "unknown"
    try:
        if path.is_file() or path.is_symlink():
            kind = "file"
            try:
                size = path.stat().st_size
            except Exception:
                size = 0
            if apply:
                path.unlink(missing_ok=True)
            return (True, size, kind)

        if path.is_dir():
            kind = "dir"
            # best-effort size estimate (fast-ish)
            try:
                for p in path.rglob("*"):
                    if p.is_file():
                        try:
                            size += p.stat().st_size
                        except Exception:
                            pass
            except Exception:
                pass
            if apply:
                shutil.rmtree(path, ignore_errors=False)
            return (True, size, kind)
    except Exception as e:
        return (False, 0, f"error:{e.__class__.__name__}:{e}")

    return (False, 0, "unknown")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clean local/dev artifacts (safe, re-generated). Defaults to dry-run."
    )
    parser.add_argument("--apply", action="store_true", help="Actually delete files.")
    parser.add_argument(
        "--include-node-modules",
        action="store_true",
        help="Also remove repo root node_modules/ and .pnpm-store/ (forces reinstall).",
    )
    args = parser.parse_args()

    # Only target known generated artifacts. Do NOT touch packages/**/data/* or env files.
    targets: list[Path] = []

    # Common output/artifact directories
    targets += [
        REPO_ROOT / "packages" / "client" / "dist",
        REPO_ROOT / "packages" / "client" / "coverage",
        REPO_ROOT / "packages" / "server" / "dist",
        REPO_ROOT / "test-results",
        REPO_ROOT / "playwright-report",
        REPO_ROOT / "playwright-screenshots",
        REPO_ROOT / "playwright" / "playwright-report",
    ]

    # Local logs at repo root
    targets += [
        REPO_ROOT / "client-dev.log",
        REPO_ROOT / "client-dev-specific.log",
    ]

    # Vite / tooling caches that get noisy
    targets += [
        REPO_ROOT / "packages" / "client" / "node_modules" / ".vite",
        REPO_ROOT / "packages" / "server" / "node_modules" / ".vite",
        REPO_ROOT / "packages" / "server" / "node_modules" / ".vite-temp",
    ]

    # Ignored SQLite test artifacts (historically left behind)
    for p in glob.glob(str(REPO_ROOT / "packages" / "server" / "test-*.db*")):
        targets.append(Path(p))

    # Ignored Vite timestamp artifacts
    for p in glob.glob(str(REPO_ROOT / "packages" / "**" / "*.timestamp-*.mjs"), recursive=True):
        targets.append(Path(p))

    # Optional: wipe install state
    if args.include_node_modules:
        targets += [
            REPO_ROOT / "node_modules",
            REPO_ROOT / ".pnpm-store",
        ]

    removed = 0
    bytes_removed = 0
    results: list[tuple[str, Path, int]] = []

    # De-dupe while preserving stable ordering
    seen: set[Path] = set()
    for t in targets:
        tr = t.resolve() if t.exists() else t
        if tr in seen:
            continue
        seen.add(tr)

        ok, size, kind = remove_path(t, apply=args.apply)
        if ok:
            removed += 1
            bytes_removed += size
        results.append((kind, t, size))

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[cleanup] mode={mode} repo={REPO_ROOT}")
    for kind, p, size in results:
        if kind in ("missing",):
            continue
        rel = str(p.relative_to(REPO_ROOT)) if within_repo(p) else str(p)
        suffix = f" ({size} bytes est.)" if size else ""
        print(f" - {kind}: {rel}{suffix}")
    print(f"[cleanup] removed={removed} approx_bytes={bytes_removed}")
    if not args.apply:
        print("[cleanup] Re-run with --apply to delete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

