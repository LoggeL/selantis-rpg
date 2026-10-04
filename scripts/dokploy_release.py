"""Read Selantis deployment status. Production releases come only from GitHub pushes.

The API key stays in macOS Keychain and is passed on stdin to curl.
This tool has no upload, provider mutation, or deployment command.
"""
import argparse
import json
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://dokploy.logge.top/api/"
META = ROOT / "output/deployment/dokploy.json"


def api(endpoint):
    key = subprocess.check_output(
        ["security", "find-generic-password", "-s", "dokploy.logge.top API Key", "-w"],
        text=True, stderr=subprocess.DEVNULL,
    ).strip()
    config = "header = " + json.dumps("x-api-key: " + key) + "\n"
    args = ["curl", "--config", "-", "-sS", "--max-time", "120", "-w", "\n%{http_code}"]
    args.append(BASE + endpoint)
    result = subprocess.run(args, input=config, text=True, capture_output=True)
    body, _, status = result.stdout.rpartition("\n")
    if result.returncode or status not in {"200", "201"}:
        raise RuntimeError(f"{endpoint.split('?')[0]} failed (HTTP {status}, curl {result.returncode})")
    return json.loads(body) if body.strip() else {}



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status"])
    parser.parse_args()
    meta = json.loads(META.read_text())
    query = urllib.parse.urlencode({"applicationId": meta["applicationId"]})
    app = api("application.one?" + query)
    settings = ("name", "sourceType", "owner", "repository", "branch", "autoDeploy", "triggerType")
    rows = api("deployment.all?" + query)
    fields = ("deploymentId", "status", "title", "description", "createdAt", "finishedAt")
    print(json.dumps({
        "application": {key: app.get(key) for key in settings},
        "deployments": [{key: row.get(key) for key in fields} for row in rows],
    }, indent=2))


if __name__ == "__main__":
    main()
