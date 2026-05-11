from __future__ import annotations

import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException


MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024
SUPPORTED_RUNTIME_PROFILES = {"light"}
ALLOWED_TEXT_EXTENSIONS = {
    ".md",
    ".txt",
    ".py",
    ".sh",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".js",
    ".ts",
    ".mjs",
    ".cjs",
    ".tsx",
    ".jsx",
    ".html",
    ".css",
    ".csv",
}


@dataclass(slots=True)
class GithubPluginSource:
    owner: str
    repo: str
    ref: str
    subdir: str
    source_url: str


@dataclass(slots=True)
class InstalledPluginSnapshot:
    commit_sha: str
    entry_hint: str
    detected_files: list[str]
    root_relpath: str


def parse_github_plugin_source(source_url: str) -> GithubPluginSource:
    parsed = urlparse(source_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="插件来源必须是合法的 GitHub URL。")

    host = parsed.netloc.lower()
    path_parts = [part for part in parsed.path.strip("/").split("/") if part]
    if host == "github.com":
        if len(path_parts) < 2:
            raise HTTPException(status_code=400, detail="GitHub 仓库 URL 不完整。")
        owner, repo = path_parts[0], path_parts[1].removesuffix(".git")
        if len(path_parts) == 2:
            return GithubPluginSource(owner=owner, repo=repo, ref="main", subdir="", source_url=source_url)

        if len(path_parts) >= 4 and path_parts[2] == "tree":
            return GithubPluginSource(
                owner=owner,
                repo=repo,
                ref=path_parts[3],
                subdir="/".join(path_parts[4:]),
                source_url=source_url,
            )

        if len(path_parts) >= 5 and path_parts[2] == "archive" and path_parts[3] == "refs":
            ref = path_parts[5] if len(path_parts) >= 6 else path_parts[4]
            ref = ref.removesuffix(".zip").removesuffix(".tar.gz")
            return GithubPluginSource(owner=owner, repo=repo, ref=ref, subdir="", source_url=source_url)

        raise HTTPException(status_code=400, detail="暂不支持该 GitHub URL 形式。")

    if host == "codeload.github.com":
        if len(path_parts) < 4:
            raise HTTPException(status_code=400, detail="GitHub 归档 URL 不完整。")
        owner, repo = path_parts[0], path_parts[1]
        ref = path_parts[3]
        return GithubPluginSource(owner=owner, repo=repo, ref=ref, subdir="", source_url=source_url)

    raise HTTPException(status_code=400, detail="目前只允许 GitHub 公共仓库或 GitHub 官方归档链接。")


def resolve_github_commit_sha(source: GithubPluginSource) -> str:
    url = f"https://api.github.com/repos/{source.owner}/{source.repo}/commits/{source.ref}"
    try:
        response = httpx.get(url, headers={"Accept": "application/vnd.github+json"}, timeout=20)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"解析 GitHub commit 失败：{exc}") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail="无法解析 GitHub 仓库或指定分支/标签。")
    payload = response.json()
    sha = str(payload.get("sha", "")).strip()
    if not sha:
        raise HTTPException(status_code=400, detail="GitHub 未返回有效 commit_sha。")
    return sha


def install_snapshot_from_github(
    source: GithubPluginSource,
    commit_sha: str,
    destination_dir: Path,
) -> InstalledPluginSnapshot:
    destination_dir.mkdir(parents=True, exist_ok=True)
    if any(destination_dir.iterdir()):
        shutil.rmtree(destination_dir)
        destination_dir.mkdir(parents=True, exist_ok=True)

    archive_url = f"https://codeload.github.com/{source.owner}/{source.repo}/zip/{commit_sha}"
    with TemporaryDirectory(prefix="newsroom_plugin_install_") as temp_dir:
        archive_path = Path(temp_dir) / f"{source.repo}-{commit_sha}.zip"
        _download_archive(archive_url, archive_path)
        extracted_root = _extract_archive(archive_path, Path(temp_dir))
        selected_root = _resolve_selected_root(extracted_root, source.subdir)
        entry_hint, detected_files = _validate_and_discover_entries(selected_root)
        shutil.copytree(selected_root, destination_dir, dirs_exist_ok=True)
    root_relpath = source.subdir.strip("/")
    return InstalledPluginSnapshot(
        commit_sha=commit_sha,
        entry_hint=entry_hint,
        detected_files=detected_files,
        root_relpath=root_relpath,
    )


def _download_archive(archive_url: str, archive_path: Path) -> None:
    total_size = 0
    try:
        with httpx.stream("GET", archive_url, follow_redirects=True, timeout=60) as response:
            if response.status_code >= 400:
                raise HTTPException(status_code=400, detail="下载 GitHub 归档失败。")
            with archive_path.open("wb") as file_obj:
                for chunk in response.iter_bytes():
                    total_size += len(chunk)
                    if total_size > MAX_ARCHIVE_BYTES:
                        raise HTTPException(status_code=400, detail="插件归档过大，超过安全阈值。")
                    file_obj.write(chunk)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"下载 GitHub 归档失败：{exc}") from exc


def _extract_archive(archive_path: Path, temp_root: Path) -> Path:
    extract_dir = temp_root / "extract"
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(extract_dir)
    entries = [item for item in extract_dir.iterdir() if item.is_dir()]
    if not entries:
        raise HTTPException(status_code=400, detail="插件归档内容为空。")
    return entries[0]


def _resolve_selected_root(extracted_root: Path, subdir: str) -> Path:
    if not subdir:
        return extracted_root
    requested = PurePosixPath(subdir.strip("/"))
    if ".." in requested.parts:
        raise HTTPException(status_code=400, detail="插件子目录非法。")
    selected = extracted_root.joinpath(*requested.parts)
    if not selected.exists() or not selected.is_dir():
        raise HTTPException(status_code=400, detail="GitHub 仓库中未找到指定插件目录。")
    if extracted_root.resolve() not in selected.resolve().parents and selected.resolve() != extracted_root.resolve():
        raise HTTPException(status_code=400, detail="插件目录越界。")
    return selected


def _validate_and_discover_entries(root: Path) -> tuple[str, list[str]]:
    detected_files: list[str] = []
    entry_hint = ""
    for path in sorted(root.rglob("*")):
        relpath = path.relative_to(root).as_posix()
        if path.is_symlink():
            target = path.resolve(strict=False)
            if root.resolve() != target and root.resolve() not in target.parents:
                raise HTTPException(status_code=400, detail=f"检测到越界符号链接：{relpath}")
            continue
        if path.is_dir():
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail=f"检测到超限文件：{relpath}")
        _validate_possible_binary(path, relpath)
        detected_files.append(relpath)

    preferred_candidates = ["SKILL.md", "README.md"]
    for preferred in preferred_candidates:
        if preferred in detected_files and preferred == "SKILL.md":
            entry_hint = preferred
            break

    if not entry_hint:
        script_candidates = [
            relpath
            for relpath in detected_files
            if relpath.endswith(".py")
            or relpath.endswith(".sh")
            or relpath == "package.json"
        ]
        if script_candidates:
            entry_hint = script_candidates[0]

    if not entry_hint:
        raise HTTPException(status_code=400, detail="插件缺少 SKILL.md 或可识别脚本入口。")

    return entry_hint, detected_files


def _validate_possible_binary(path: Path, relpath: str) -> None:
    suffix = path.suffix.lower()
    if suffix in ALLOWED_TEXT_EXTENSIONS:
        return
    with path.open("rb") as file_obj:
        sample = file_obj.read(1024)
    if b"\x00" in sample:
        raise HTTPException(status_code=400, detail=f"检测到未允许的二进制文件：{relpath}")
