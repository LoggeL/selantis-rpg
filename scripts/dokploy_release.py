"""Package the public Selantis build and deploy it through Dokploy Drop.

The API key is read from macOS Keychain, passed on stdin to curl, and never saved.
Only generated public media and the built game enter the release ZIP.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import urllib.parse
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://dokploy.logge.top/api/"
OUT = ROOT / "output/deployment"
META = OUT / "dokploy.json"
RELEASE = OUT / "release.json"
DOMAIN = "selantis.logge.top"


def api(endpoint, payload=None, form=None):
    key = subprocess.check_output(
        ["security", "find-generic-password", "-s", "dokploy.logge.top API Key", "-w"],
        text=True, stderr=subprocess.DEVNULL,
    ).strip()
    config = "header = " + json.dumps("x-api-key: " + key) + "\n"
    if payload is not None:
        config += 'request = "POST"\nheader = "Content-Type: application/json"\n'
        config += "data = " + json.dumps(json.dumps(payload)) + "\n"
    args = ["curl", "--config", "-", "-sS", "--max-time", "120", "-w", "\n%{http_code}"]
    for field, value in (form or {}).items():
        args.extend(["--form", f"{field}={value}"])
    args.append(BASE + endpoint)
    result = subprocess.run(args, input=config, text=True, capture_output=True)
    body, _, status = result.stdout.rpartition("\n")
    if result.returncode or status not in {"200", "201"}:
        raise RuntimeError(f"{endpoint.split('?')[0]} failed (HTTP {status}, curl {result.returncode})")
    return json.loads(body) if body.strip() else {}


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def prepare():
    source = ROOT / "game/dist"
    if not (source / "index.html").is_file():
        raise RuntimeError("Run npm run build in game/ first")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    release = "selantis-" + stamp
    stage = OUT / release
    stage.mkdir(parents=True, exist_ok=False)
    public = stage / "dist"
    shutil.copytree(source, public)
    media = ["output/imagegen/lia-pixel-film-look.png",
             "output/imagegen/tutorial-valentus-battle-film-look.png",
             "output/audio/rauberlied-lyria-3-5.mp3"]
    for relative in media:
        target = public / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    # Publish the visual overview, not manuscript excerpts or research documents.
    concept = (ROOT / "konzept.html").read_text()
    concept = re.sub(r"<details\b.*?</details>", "", concept, flags=re.DOTALL)
    concept = concept.replace("Konzept und Medien, noch kein Spielbuild.",
                              'Visuelles Konzept. <a href="/">Spielbaren Prolog öffnen</a>.')
    (public / "konzept.html").write_text(concept)
    files = sorted(p for p in public.rglob("*") if p.is_file())
    manifest = {"release": release, "domain": DOMAIN,
                "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "files": {str(p.relative_to(public)): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in files}}
    save(RELEASE, manifest)
    save(public / "release.json", manifest)
    archive = OUT / (release + ".zip")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(ROOT / "deploy/Dockerfile.artifact", "Dockerfile")
        z.write(ROOT / "deploy/nginx.conf", "nginx.conf")
        for p in sorted(public.rglob("*")):
            if p.is_file():
                z.write(p, "dist/" + str(p.relative_to(public)))
    print(json.dumps({"release": release, "files": len(files), "bytes": archive.stat().st_size}))


def ensure():
    projects = api("project.all")
    matches = [p for p in projects if p["name"] == "Selantis"]
    if len(matches) > 1:
        raise RuntimeError("Multiple Selantis projects; refusing an ambiguous update")
    if not matches:
        api("project.create", {"name": "Selantis", "description": "Selantis browser RPG and visual concept"})
        matches = [p for p in api("project.all") if p["name"] == "Selantis"]
    project = matches[0]
    envs = [e for e in project["environments"] if e["name"] == "production"]
    if not envs:
        api("environment.create", {"name": "production", "projectId": project["projectId"]})
        project = next(p for p in api("project.all") if p["projectId"] == project["projectId"])
        envs = [e for e in project["environments"] if e["name"] == "production"]
    env = envs[0]
    apps = [a for a in env["applications"] if a["name"] == "Selantis RPG"]
    if not apps:
        api("application.create", {"name": "Selantis RPG", "appName": "selantis-rpg-web",
                                    "environmentId": env["environmentId"], "sourceType": "drop"})
        project = next(p for p in api("project.all") if p["projectId"] == project["projectId"])
        env = next(e for e in project["environments"] if e["environmentId"] == env["environmentId"])
        apps = [a for a in env["applications"] if a["name"] == "Selantis RPG"]
    if len(apps) != 1:
        raise RuntimeError("Multiple Selantis applications; refusing an ambiguous update")
    app = api("application.one?" + urllib.parse.urlencode({"applicationId": apps[0]["applicationId"]}))
    if app["sourceType"] != "drop":
        raise RuntimeError("Existing application uses a different provider")
    meta = {"projectId": project["projectId"], "environmentId": env["environmentId"],
            "applicationId": app["applicationId"], "appName": app["appName"], "domain": DOMAIN}
    save(META, meta)
    api("application.saveBuildType", {"applicationId": meta["applicationId"], "buildType": "dockerfile",
        "dockerfile": "Dockerfile", "dockerContextPath": ".", "dockerBuildStage": None,
        "herokuVersion": None, "railpackVersion": None})
    if not any(d["host"] == DOMAIN for d in app.get("domains", [])):
        api("domain.create", {"host": DOMAIN, "applicationId": meta["applicationId"],
            "domainType": "application", "port": 80, "https": True,
            "certificateType": "letsencrypt", "path": "/"})
    print(json.dumps(meta))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["prepare", "ensure", "deploy", "status"])
    args = p.parse_args()
    if args.command == "prepare":
        return prepare()
    if args.command == "ensure":
        return ensure()
    meta = json.loads(META.read_text())
    if args.command == "deploy":
        release = json.loads(RELEASE.read_text())
        archive = OUT / (release["release"] + ".zip")
        response = api("application.dropDeployment", form={"applicationId": meta["applicationId"],
                       "dropBuildPath": "/", "zip": "@" + str(archive)})
        print(json.dumps({"uploadedRelease": release["release"], "accepted": response is not None}))
    else:
        data = api("deployment.all?" + urllib.parse.urlencode({"applicationId": meta["applicationId"]}))
        fields = {"deploymentId", "status", "title", "createdAt", "finishedAt"}
        print(json.dumps([{k: v for k, v in d.items() if k in fields} for d in data], indent=2))


if __name__ == "__main__":
    main()
