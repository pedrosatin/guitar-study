"""Copy tracked application files into the GitHub Pages artifact."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
DESTINATION = ROOT / "_site"
EXTENSIONS = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".webp", ".woff2", ".mp3", ".wav"}


def main():
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "index.html", "shared/", "poc/"], cwd=ROOT
    ).decode().split("\0")
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    DESTINATION.mkdir()
    count = 0
    for name in filter(None, tracked):
        source = ROOT / name
        if source.suffix not in EXTENSIONS:
            continue
        if source.is_symlink():
            raise ValueError(f"Symbolic links are not supported: {name}")
        target = DESTINATION / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        count += 1
    if not (DESTINATION / "index.html").is_file():
        raise ValueError("Missing index.html")
    (DESTINATION / ".nojekyll").touch()
    print(f"Packaged {count} application files in {DESTINATION.name}/")


if __name__ == "__main__":
    main()
